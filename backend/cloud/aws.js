const {
  ECRClient,
  DescribeRepositoriesCommand,
  CreateRepositoryCommand,
  GetAuthorizationTokenCommand,
} = require("@aws-sdk/client-ecr");

const {
  ECSClient,
  DescribeClustersCommand,
  CreateClusterCommand,
  RegisterTaskDefinitionCommand,
  DescribeServicesCommand,
  CreateServiceCommand,
  UpdateServiceCommand,
} = require("@aws-sdk/client-ecs");

const {
  STSClient,
  GetCallerIdentityCommand,
} = require("@aws-sdk/client-sts");

const {
  execFile,
  spawn,
} = require("child_process");

const {
  promisify,
} = require("util");

const execFileAsync =
  promisify(execFile);


/*CLIENTS*/

function getAwsClients(region) {
  return {
    ecr: new ECRClient({
      region,
    }),

    ecs: new ECSClient({
      region,
    }),

    sts: new STSClient({
      region,
    }),
  };
}


/*ACCOUNT INFO*/

async function getAwsAccountId(region) {
  const {
    sts,
  } = getAwsClients(region);

  const response =
    await sts.send(
      new GetCallerIdentityCommand({})
    );

  return response.Account;
}


/*ECR REPOSITORY*/

async function ensureEcrRepository(
  repositoryName,
  region
) {
  const {
    ecr,
  } = getAwsClients(region);

  try {
    const response =
      await ecr.send(
        new DescribeRepositoriesCommand({
          repositoryNames: [
            repositoryName,
          ],
        })
      );

    return response.repositories?.[0];
  } catch (error) {
    if (
      error.name !==
      "RepositoryNotFoundException"
    ) {
      throw error;
    }
  }

  const response =
    await ecr.send(
      new CreateRepositoryCommand({
        repositoryName,

        imageScanningConfiguration: {
          scanOnPush: true,
        },
      })
    );

  return response.repository;
}


/*ECR DOCKER LOGIN*/

async function loginToEcr(region) {
  const {
    ecr,
  } = getAwsClients(region);

  const response =
    await ecr.send(
      new GetAuthorizationTokenCommand({})
    );

  const authData =
    response.authorizationData?.[0];

  if (!authData) {
    throw new Error(
      "AWS ECR did not return an authorization token"
    );
  }

  const decoded =
    Buffer.from(
      authData.authorizationToken,
      "base64"
    ).toString("utf8");

  const separatorIndex =
    decoded.indexOf(":");

  const username =
    decoded.slice(
      0,
      separatorIndex
    );

  const password =
    decoded.slice(
      separatorIndex + 1
    );

  const registry =
    authData.proxyEndpoint.replace(
      "https://",
      ""
    );

  await new Promise(
    (resolve, reject) => {
      const child = spawn(
        "docker",
        [
          "login",
          "--username",
          username,
          "--password-stdin",
          registry,
        ],
        {
          stdio: [
            "pipe",
            "inherit",
            "inherit",
          ],
        }
      );

      child.on(
        "error",
        reject
      );

      child.stdin.write(
        password
      );

      child.stdin.end();

      child.on(
        "close",
        (code) => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              `Docker ECR login failed with exit code ${code}`
            )
          );
        }
      );
    }
  );

  return registry;
}


/*PUSH LOCAL DOCKER IMAGE TO ECR*/

async function pushDockerImageToEcr({
  localImage,
  repositoryName,
  region,
}) {
  const repository =
    await ensureEcrRepository(
      repositoryName,
      region
    );

  if (!repository?.repositoryUri) {
    throw new Error(
      `Could not determine ECR URI for ${repositoryName}`
    );
  }

  await loginToEcr(
    region
  );

  const remoteImage =
    `${repository.repositoryUri}:latest`;

  console.log(
    `Tagging ${localImage} as ${remoteImage}`
  );

  await execFileAsync(
    "docker",
    [
      "tag",
      localImage,
      remoteImage,
    ]
  );

  console.log(
    `Pushing ${remoteImage}`
  );

  await execFileAsync(
    "docker",
    [
      "push",
      remoteImage,
    ]
  );

  return {
    repositoryName,
    repositoryUri:
      repository.repositoryUri,

    image:
      remoteImage,
  };
}


/*ECS CLUSTER*/

async function ensureEcsCluster(
  clusterName,
  region
) {
  const {
    ecs,
  } = getAwsClients(region);

  const existing =
    await ecs.send(
      new DescribeClustersCommand({
        clusters: [
          clusterName,
        ],
      })
    );

  const cluster =
    existing.clusters?.find(
      (current) =>
        current.status === "ACTIVE"
    );

  if (cluster) {
    return cluster;
  }

  console.log(
    `Creating ECS cluster ${clusterName}`
  );

  const response =
    await ecs.send(
      new CreateClusterCommand({
        clusterName,
      })
    );

  return response.cluster;
}


/*ECS FARGATE TASK DEFINITION*/

async function registerFargateTask({
  family,
  containerName,
  image,
  containerPort,
  region,
  executionRoleArn,
  environment = [],
}) {
  const {
    ecs,
  } = getAwsClients(region);

  const response =
    await ecs.send(
      new RegisterTaskDefinitionCommand({
        family,

        networkMode:
          "awsvpc",

        requiresCompatibilities: [
          "FARGATE",
        ],

        cpu:
          "256",

        memory:
          "512",

        executionRoleArn,

        containerDefinitions: [
          {
            name:
              containerName,

            image,

            essential:
              true,

            portMappings: [
              {
                containerPort,
                hostPort:
                  containerPort,

                protocol:
                  "tcp",
              },
            ],

            environment,
          },
        ],
      })
    );

  if (
    !response.taskDefinition
      ?.taskDefinitionArn
  ) {
    throw new Error(
      `Could not register ECS task definition for ${containerName}`
    );
  }

  return response.taskDefinition;
}


/*ECS SERVICE*/

async function createOrUpdateFargateService({
  clusterName,
  serviceName,
  taskDefinitionArn,
  region,
  subnetIds,
  securityGroupIds,
  desiredCount = 1,
}) {
  const {
    ecs,
  } = getAwsClients(region);

  const existing =
    await ecs.send(
      new DescribeServicesCommand({
        cluster:
          clusterName,

        services: [
          serviceName,
        ],
      })
    );

  const currentService =
    existing.services?.find(
      (service) =>
        service.status ===
        "ACTIVE"
    );

  if (currentService) {
    console.log(
      `Updating ECS service ${serviceName}`
    );

    const updated =
      await ecs.send(
        new UpdateServiceCommand({
          cluster:
            clusterName,

          service:
            serviceName,

          taskDefinition:
            taskDefinitionArn,

          desiredCount,

          forceNewDeployment:
            true,
        })
      );

    return updated.service;
  }

  console.log(
    `Creating ECS service ${serviceName}`
  );

  const response =
    await ecs.send(
      new CreateServiceCommand({
        cluster:
          clusterName,

        serviceName,

        taskDefinition:
          taskDefinitionArn,

        desiredCount,

        launchType:
          "FARGATE",

        networkConfiguration: {
          awsvpcConfiguration: {
            subnets:
              subnetIds,

            securityGroups:
              securityGroupIds,

            assignPublicIp:
              "ENABLED",
          },
        },
      })
    );

  return response.service;
}


/*FULL CONTAINER DEPLOYMENT*/

async function deployContainerToAws({
  architectureId,
  serviceName,
  localImage,
  region,
  clusterName,
  executionRoleArn,
  subnetIds,
  securityGroupIds,
  containerPort = 3000,
  environment = [],
}) {
  const safeServiceName =
    serviceName
      .toLowerCase()
      .replace(
        /[^a-z0-9-]/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      );

  const repositoryName =
    `failover-${architectureId}-${safeServiceName}`;

  const pushed =
    await pushDockerImageToEcr({
      localImage,
      repositoryName,
      region,
    });

  await ensureEcsCluster(
    clusterName,
    region
  );

  const family =
    `failover-${architectureId}-${safeServiceName}`;

  const taskDefinition =
    await registerFargateTask({
      family,

      containerName:
        safeServiceName,

      image:
        pushed.image,

      containerPort,

      region,

      executionRoleArn,

      environment,
    });

  const ecsService =
    await createOrUpdateFargateService({
      clusterName,

      serviceName:
        `${family}-service`,

      taskDefinitionArn:
        taskDefinition
          .taskDefinitionArn,

      region,

      subnetIds,

      securityGroupIds,

      desiredCount: 1,
    });

  return {
    provider:
      "AWS",

    serviceName,

    clusterName,

    image:
      pushed.image,

    repositoryUri:
      pushed.repositoryUri,

    taskDefinitionArn:
      taskDefinition
        .taskDefinitionArn,

    serviceArn:
      ecsService?.serviceArn,

    status:
      ecsService?.status ||
      "Deploying",
  };
}


/*EXPORTS*/

module.exports = {
  getAwsAccountId,

  ensureEcrRepository,

  loginToEcr,

  pushDockerImageToEcr,

  ensureEcsCluster,

  registerFargateTask,

  createOrUpdateFargateService,

  deployContainerToAws,
};