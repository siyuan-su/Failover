const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const { execFile } = require("child_process");
const { promisify } = require("util");

dotenv.config();

const execFileAsync = promisify(execFile);

const db = require("./db");

const app = express();

const crypto = require("crypto");

function normalizeComponentType(componentType) {
  switch (componentType) {
    case "API Server":
      return "api-server";

    case "Load Balancer":
      return "load-balancer";

    case "MySQL Database":
      return "mysql";

    case "Redis Cache":
      return "redis";

    case "Worker":
      return "worker";

    default:
      return "unknown";
  }
}

app.use(cors());
app.use(express.json());

function getArchitectureNodes(architectureId) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        id,
        component_type,
        label,
        provider,
        region,
        capacity,
        status
      FROM nodes
      WHERE architecture_id = ?
    `;

    db.query(sql, [architectureId], (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

function getArchitectureConnections(architectureId) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        source_node_id,
        target_node_id
      FROM connections
      WHERE architecture_id = ?
    `;

    db.query(sql, [architectureId], (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

function getNodeDependencies(
  node,
  allNodes,
  connections
) {
  const connectedNodeIds = connections
    .filter(
      (connection) =>
        connection.source_node_id === node.id ||
        connection.target_node_id === node.id
    )
    .map((connection) =>
      connection.source_node_id === node.id
        ? connection.target_node_id
        : connection.source_node_id
    );

  return connectedNodeIds
    .map((connectedNodeId) =>
      allNodes.find(
        (candidate) =>
          candidate.id === connectedNodeId
      )
    )
  .filter(
    (candidate) =>
      candidate &&
      (
        candidate.component_type ===
          "MySQL Database" ||
        candidate.component_type ===
          "Redis Cache" ||
        candidate.component_type ===
          "API Server"
      )
  );
}

async function runDockerApiContainer(
  architectureId,
  node
) {
  const shortId = node.id
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8);

  const containerName =
    `failover-${architectureId}-${shortId}`.toLowerCase();

  // Remove an old container with the same name if one exists.
  try {
    await execFileAsync("docker", [
      "rm",
      "-f",
      containerName,
    ]);
  } catch {
    // Fine if the container didn't already exist.
  }

  const serviceName =
    node.label || node.component_type;

  const capacity =
    String(node.capacity || 500);

  await execFileAsync("docker", [
    "run",
    "-d",

    "--name",
    containerName,

    "-p",
    "127.0.0.1::3000",

    "-e",
    `SERVICE_NAME=${serviceName}`,

    "-e",
    `CAPACITY=${capacity}`,

    "failover-api-server",
  ]);

  // Ask Docker which random host port it assigned.
  const { stdout } = await execFileAsync("docker", [
    "port",
    containerName,
    "3000/tcp",
  ]);

  const portMatch = stdout.trim().match(/:(\d+)$/);

  if (!portMatch) {
    throw new Error(
      `Could not determine port for ${containerName}`
    );
  }

  const hostPort = Number(portMatch[1]);

  return {
    nodeId: node.id,
    containerName,
    serviceName,
    hostPort,
  };
}

async function getContainerStatus(containerName) {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "-f",
      "{{.State.Status}}",
      containerName,
    ]);

    return stdout.trim();
  } catch {
    return "missing";
  }
}

async function isMysqlReady(containerName) {
  try {
    await execFileAsync("docker", [
      "exec",
      containerName,
      "mysqladmin",
      "ping",
      "-uroot",
      "--silent",
    ]);

    return true;
  } catch {
    return false;
  }
}

async function isRedisReady(containerName) {
  try {
    const { stdout } =
      await execFileAsync("docker", [
        "exec",
        containerName,
        "redis-cli",
        "ping",
      ]);

    return stdout.trim() === "PONG";
  } catch {
    return false;
  }
}

async function waitForContainerReady(
  containerName,
  componentType,
  attempts = 30
) {
  for (
    let attempt = 0;
    attempt < attempts;
    attempt++
  ) {
    let ready = false;

    if (
      componentType === "MySQL Database"
    ) {
      ready =
        await isMysqlReady(containerName);
    }

    if (
      componentType === "Redis Cache"
    ) {
      ready =
        await isRedisReady(containerName);
    }

    if (ready) {
      return true;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 250)
    );
  }

  return false;
}

function getRuntimeContainerName(
  architectureId,
  nodeId
) {
  const shortId = nodeId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8);

  return sanitizeDockerName(
    `failover-${architectureId}-${shortId}`
  );
}

function sanitizeDockerName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function removeContainerIfExists(containerName) {
  try {
    await execFileAsync("docker", [
      "rm",
      "-f",
      containerName,
    ]);
  } catch {
    // Container did not exist. That's fine.
  }
}

async function ensureDockerNetwork(architectureId) {
  const networkName =
    `failover-${architectureId}-network`;

  try {
    await execFileAsync("docker", [
      "network",
      "inspect",
      networkName,
    ]);
  } catch {
    await execFileAsync("docker", [
      "network",
      "create",
      networkName,
    ]);
  }

  return networkName;
}

async function getPublishedPort(
  containerName,
  containerPort
) {
  const { stdout } = await execFileAsync(
    "docker",
    [
      "port",
      containerName,
      `${containerPort}/tcp`,
    ]
  );

  const match = stdout.trim().match(/:(\d+)$/);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

async function deployNodeLocally(
  architectureId,
  node,
  networkName,
  dependencies = [],
  runtimeMysqlPassword = null
) {
  const shortId = node.id
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8);

  const containerName = sanitizeDockerName(
    `failover-${architectureId}-${shortId}`
  );

  const serviceName =
    node.label || node.component_type;

  await removeContainerIfExists(containerName);

  // API SERVER

  if (node.component_type === "API Server") {
    const dockerArgs = [
      "run",
      "-d",

      "--name",
      containerName,

      "--network",
      networkName,

      "--network-alias",
      sanitizeDockerName(serviceName),

      "-p",
      "127.0.0.1::3000",

      "-e",
      `SERVICE_NAME=${serviceName}`,

      "-e",
      `CAPACITY=${node.capacity || 500}`,
    ];

    for (const dependency of dependencies) {
      const dependencyHost =
        sanitizeDockerName(
          dependency.label ||
          dependency.component_type
        );

      if (
        dependency.component_type ===
        "MySQL Database"
      ) {
        dockerArgs.push(
          "-e",
          `DB_HOST=${dependencyHost}`,

          "-e",
          "DB_PORT=3306",

          "-e",
          `DB_PASSWORD=${runtimeMysqlPassword}`
        );
      }

      if (
        dependency.component_type ===
        "Redis Cache"
      ) {
        dockerArgs.push(
          "-e",
          `REDIS_HOST=${dependencyHost}`,

          "-e",
          "REDIS_PORT=6379"
        );
      }
    }

    dockerArgs.push("failover-api-server");

    await execFileAsync(
      "docker",
      dockerArgs
    );

    const hostPort =
      await getPublishedPort(
        containerName,
        3000
      );

    return {
      nodeId: node.id,
      type: node.component_type,
      serviceName,
      containerName,
      hostPort,
      status: "Starting",
    };
  }

  // MYSQL

  if (node.component_type === "MySQL Database") {
    await execFileAsync("docker", [
      "run",
      "-d",

      "--name",
      containerName,

      "--network",
      networkName,

      "--network-alias",
      sanitizeDockerName(serviceName),

      "-p",
      "127.0.0.1::3306",

      "-e",
      `MYSQL_ROOT_PASSWORD=${runtimeMysqlPassword}`,
      "-e",
      "MYSQL_DATABASE=failover_runtime",

      "mysql:8.4",
    ]);

    const hostPort = await getPublishedPort(
      containerName,
      3306
    );

    return {
      nodeId: node.id,
      type: node.component_type,
      serviceName,
      containerName,
      hostPort,
      status: "Starting",
    };
  }

  // REDIS

  if (node.component_type === "Redis Cache") {
    await execFileAsync("docker", [
      "run",
      "-d",

      "--name",
      containerName,

      "--network",
      networkName,

      "--network-alias",
      sanitizeDockerName(serviceName),

      "-p",
      "127.0.0.1::6379",

      "redis:7-alpine",
    ]);

    const hostPort = await getPublishedPort(
      containerName,
      6379
    );

    return {
      nodeId: node.id,
      type: node.component_type,
      serviceName,
      containerName,
      hostPort,
      status: "Starting",
    };
  }

  // LOAD BALANCER

  if (
    node.component_type ===
    "Load Balancer"
  ) {
    const apiDependencies =
      dependencies.filter(
        (dependency) =>
          dependency.component_type ===
          "API Server"
      );

    const backendHosts =
      apiDependencies.map(
        (dependency) =>
          sanitizeDockerName(
            dependency.label ||
              dependency.component_type
          )
      );

    if (backendHosts.length === 0) {
      throw new Error(
        "Load Balancer must be connected to at least one API Server"
      );
    }

    const dockerArgs = [
      "run",
      "-d",

      "--name",
      containerName,

      "--network",
      networkName,

      "--network-alias",
      sanitizeDockerName(serviceName),

      "-p",
      "127.0.0.1::3000",

      "-e",
      `SERVICE_NAME=${serviceName}`,

      "-e",
      `BACKENDS=${backendHosts.join(",")}`,

      "failover-load-balancer",
    ];

    await execFileAsync(
      "docker",
      dockerArgs
    );

    const hostPort =
      await getPublishedPort(
        containerName,
        3000
      );

    return {
      nodeId: node.id,
      type: node.component_type,
      serviceName,
      containerName,
      hostPort,
      status: "Starting",
    };
  }

  return {
    nodeId: node.id,
    type: node.component_type,
    serviceName,
    status: "Unsupported",
  };
}

async function waitForHealthyService(
  hostPort,
  attempts = 40
) {
  for (
    let attempt = 0;
    attempt < attempts;
    attempt++
  ) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${hostPort}/health`,
        {
          signal: AbortSignal.timeout(750),
        }
      );

      const health =
        await response.json();

      // Do NOT finish deployment while
      // the API is still degraded.
      if (health.status === "Healthy") {
        return health;
      }
    } catch {
      // API may still be starting.
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 250)
    );
  }

  throw new Error(
    `Service on port ${hostPort} failed to become healthy`
  );
}

async function determineDeploymentStatus(
  deployment
) {
  if (deployment.status === "Unsupported") {
    return deployment;
  }

  if (
    (
      deployment.type === "API Server" ||
      deployment.type === "Load Balancer"
    ) &&
    deployment.hostPort
  ) {
    try {
      const health =
        await waitForHealthyService(
          deployment.hostPort
        );

      return {
        ...deployment,
        status:
          health.status || "Running",
        health,
      };
    } catch (error) {
      return {
        ...deployment,
        status: "Unhealthy",
        error: error.message,
      };
    }
  }

  return {
    ...deployment,
    status: "Running",
  };
}

// Test route
app.get("/", (req, res) => {
  res.send("Failover backend is running");
});

// Get all architectures
app.get("/api/architectures", (req, res) => {
  const sql = `
    SELECT id, name, status, created_at
    FROM architectures
    ORDER BY id ASC
  `;

  db.query(sql, (error, results) => {
    if (error) {
      console.error("Failed to retrieve architectures:", error);

      return res.status(500).json({
        error: "Failed to retrieve architectures",
      });
    }

    res.json(results);
  });
});

// Create architecture
app.post("/api/architectures", (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({
      error: "Architecture name is required",
    });
  }

  const sql = `
    INSERT INTO architectures (name)
    VALUES (?)
  `;

  db.query(sql, [name.trim()], (error, result) => {
    if (error) {
      console.error("Failed to create architecture:", error);

      return res.status(500).json({
        error: "Failed to create architecture",
      });
    }

    const newArchitecture = {
      id: result.insertId,
      name: name.trim(),
      status: "Ready",
    };

    res.status(201).json(newArchitecture);
  });
});

// Delete architecture
app.delete("/api/architectures/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
    DELETE FROM architectures
    WHERE id = ?
  `;

  db.query(sql, [id], (error, result) => {
    if (error) {
      console.error("Failed to delete architecture:", error);

      return res.status(500).json({
        error: "Failed to delete architecture",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Architecture not found",
      });
    }

    res.status(204).send();
  });
});

// Get one architecture
app.get("/api/architectures/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT id, name, status, created_at
    FROM architectures
    WHERE id = ?
  `;

  db.query(sql, [id], (error, results) => {
    if (error) {
      console.error("Failed to retrieve architecture:", error);

      return res.status(500).json({
        error: "Failed to retrieve architecture",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        error: "Architecture not found",
      });
    }

    res.json(results[0]);
  });
});

// Load architecture editor
app.get("/api/architectures/:id/editor", (req, res) => {
  const architectureId = req.params.id;

  const nodesSql = `
    SELECT *
    FROM nodes
    WHERE architecture_id = ?
  `;

  const edgesSql = `
    SELECT *
    FROM connections
    WHERE architecture_id = ?
  `;

  db.query(nodesSql, [architectureId], (error, nodeResults) => {
    if (error) {
      console.error("Failed to load nodes:", error);

      return res.status(500).json({
        error: "Failed to load nodes",
      });
    }

    db.query(edgesSql, [architectureId], (error, edgeResults) => {
      if (error) {
        console.error("Failed to load connections:", error);

        return res.status(500).json({
          error: "Failed to load connections",
        });
      }

      const nodes = nodeResults.map((node) => ({
        id: node.id,

        type: "cloudNode",

        position: {
          x: node.position_x,
          y: node.position_y,
        },

        data: {
          label: node.label || node.component_type,
          componentType: node.component_type,

          provider: node.provider,
          region: node.region,
          capacity: node.capacity,
          status: node.status,
        },
      }));

      const edges = edgeResults.map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        sourceHandle: edge.source_handle || undefined,
        targetHandle: edge.target_handle || undefined,
        type: "step",
      }));

      res.json({
        nodes,
        edges,
      });
    });
  });
});

// Save architecture editor
app.put("/api/architectures/:id/editor", (req, res) => {
  const architectureId = req.params.id;
  const { nodes, edges } = req.body;

  const deleteEdgesSql = `
    DELETE FROM connections
    WHERE architecture_id = ?
  `;

  const deleteNodesSql = `
    DELETE FROM nodes
    WHERE architecture_id = ?
  `;

  db.query(deleteEdgesSql, [architectureId], (error) => {
    if (error) {
      console.error("Failed to delete old connections:", error);

      return res.status(500).json({
        error: "Failed to save architecture",
      });
    }

    db.query(deleteNodesSql, [architectureId], (error) => {
      if (error) {
        console.error("Failed to delete old nodes:", error);

        return res.status(500).json({
          error: "Failed to save architecture",
        });
      }

      const nodePromises = nodes.map((node) => {
        return new Promise((resolve, reject) => {
          const sql = `
            INSERT INTO nodes
            (
              id,
              architecture_id,
              component_type,
              label,
              position_x,
              position_y,
              provider,
              region,
              capacity,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(
            sql,
            [
              node.id,
              architectureId,

              node.data.componentType,
              node.data.label,

              node.position.x,
              node.position.y,

              node.data.provider || "AWS",
              node.data.region || "us-east-1",
              node.data.capacity || 500,
              node.data.status || "Healthy",
            ],
            (error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            }
          );
        });
      });

      Promise.all(nodePromises)
        .then(() => {
          const edgePromises = edges.map((edge) => {
            return new Promise((resolve, reject) => {
              const sql = `
                INSERT INTO connections
                (
                  id,
                  architecture_id,
                  source_node_id,
                  target_node_id,
                  source_handle,
                  target_handle
                )
                VALUES (?, ?, ?, ?, ?, ?)
              `;

              db.query(
                sql,
                [
                  edge.id,
                  architectureId,
                  edge.source,
                  edge.target,
                  edge.sourceHandle || null,
                  edge.targetHandle || null,
                ],
                (error) => {
                  if (error) {
                    reject(error);
                  } else {
                    resolve();
                  }
                }
              );
            });
          });

          return Promise.all(edgePromises);
        })
        .then(() => {
          res.json({
            message: "Architecture saved",
          });
        })
        .catch((error) => {
          console.error("Failed to save architecture:", error);

          res.status(500).json({
            error: "Failed to save architecture",
          });
        });
    });
  });
});

app.get("/api/architectures/:id/runtime-spec", (req, res) => {
  const architectureId = req.params.id;

  const nodesSql = `
    SELECT
      id,
      component_type,
      label,
      provider,
      region,
      capacity,
      status
    FROM nodes
    WHERE architecture_id = ?
  `;

  const edgesSql = `
    SELECT
      source_node_id,
      target_node_id
    FROM connections
    WHERE architecture_id = ?
  `;

  db.query(nodesSql, [architectureId], (error, nodeResults) => {
    if (error) {
      console.error("Failed to load runtime nodes:", error);

      return res.status(500).json({
        error: "Failed to build runtime specification",
      });
    }

    db.query(edgesSql, [architectureId], (error, edgeResults) => {
      if (error) {
        console.error("Failed to load runtime connections:", error);

        return res.status(500).json({
          error: "Failed to build runtime specification",
        });
      }

      const services = nodeResults.map((node) => ({
        id: node.id,
        name: node.label || node.component_type,
        type: normalizeComponentType(node.component_type),
        provider: node.provider,
        region: node.region,
        capacity: node.capacity,
        status: node.status,
      }));

      const connections = edgeResults.map((edge) => ({
        source: edge.source_node_id,
        target: edge.target_node_id,
      }));

      res.json({
        architectureId: Number(architectureId),
        services,
        connections,
      });
    });
  });
});

app.get(
  "/api/architectures/:id/runtime-status",
  async (req, res) => {
    const architectureId = req.params.id;

    try {
      const nodes =
        await getArchitectureNodes(
          architectureId
        );

      const services = [];

      for (const node of nodes) {
        const containerName =
          getRuntimeContainerName(
            architectureId,
            node.id
          );

        const dockerStatus =
          await getContainerStatus(
            containerName
          );

        let status = "Not Deployed";
        let health = null;

        if (dockerStatus === "running") {
          status = "Running";

          // API Server has an HTTP health endpoint,
          // so use it for the real runtime status.
          if (
            node.component_type === "API Server"
          ) {
            const hostPort =
              await getPublishedPort(
                containerName,
                3000
              );

            if (hostPort) {
              try {
                const response = await fetch(
                  `http://127.0.0.1:${hostPort}/health`,
                  {
                    signal:
                      AbortSignal.timeout(750),
                  }
                );

                health =
                  await response.json();

                status =
                  health.status ||
                  "Running";
              } catch {
                status = "Unhealthy";
              }
            }
          }

          if (
            node.component_type ===
            "Load Balancer"
          ) {
            const hostPort =
              await getPublishedPort(
                containerName,
                3000
              );

            if (hostPort) {
              try {
                const response = await fetch(
                  `http://127.0.0.1:${hostPort}/health`,
                  {
                    signal:
                      AbortSignal.timeout(1000),
                  }
                );

                health =
                  await response.json();

                status =
                  health.status ||
                  "Running";
              } catch {
                status = "Unhealthy";
              }
            }
          }

          if (
            node.component_type ===
            "MySQL Database"
          ) {
            status = "Healthy";
          }

          if (
            node.component_type ===
            "Redis Cache"
          ) {
            const ready =
              await isRedisReady(
                containerName
              );

            status = ready
              ? "Healthy"
              : "Recovering";
          }
        }

        if (
          dockerStatus === "exited" ||
          dockerStatus === "dead"
        ) {
          status = "Failed";
        }

        services.push({
          nodeId: node.id,
          componentType:
            node.component_type,

          containerName,
          dockerStatus,
          status,
          health,
        });
      }

      res.json({
        architectureId:
          Number(architectureId),

        services,
      });
    } catch (error) {
      console.error(
        "Failed to retrieve runtime status:",
        error
      );

      res.status(500).json({
        error:
          "Failed to retrieve runtime status",
      });
    }
  }
);

app.post(
  "/api/architectures/:id/deploy-local",
  async (req, res) => {
    const architectureId = req.params.id;
    const { nodeId } = req.body;

    if (!nodeId) {
      return res.status(400).json({
        error: "A component must be selected",
      });
    }

    try {
      const nodes =
        await getArchitectureNodes(
          architectureId
        );

      const connections =
        await getArchitectureConnections(
          architectureId
        );

      const node = nodes.find(
        (currentNode) =>
          currentNode.id === nodeId
      );

      if (!node) {
        return res.status(404).json({
          error: "Component not found",
        });
      }

      if (
        node.component_type !==
        "API Server"
      ) {
        return res.status(400).json({
          error:
            "Local deployment currently only supports API Server components",
        });
      }

      const networkName =
        await ensureDockerNetwork(
          architectureId
        );

      const dependencies =
        getNodeDependencies(
          node,
          nodes,
          connections
        );

      const runtimeMysqlPassword =
        crypto
          .randomBytes(12)
          .toString("hex");

      const deployment =
        await deployNodeLocally(
          architectureId,
          node,
          networkName,
          dependencies,
          runtimeMysqlPassword
        );

      try {
        const health =
          await waitForHealthyService(
            deployment.hostPort
          );

        return res.json({
          architectureId:
            Number(architectureId),

          deployment: {
            ...deployment,
            status: "Healthy",
            health,
          },
        });
      } catch (error) {
        return res.json({
          architectureId:
            Number(architectureId),

          deployment: {
            ...deployment,
            status: "Unhealthy",
            error: error.message,
          },
        });
      }
    } catch (error) {
      console.error(
        "Local deployment failed:",
        error
      );

      res.status(500).json({
        error: "Local deployment failed",
        details: error.message,
      });
    }
  }
);

app.post(
  "/api/architectures/:id/deploy-local-all",
  async (req, res) => {
    const architectureId = req.params.id;

    try {
      const nodes =
        await getArchitectureNodes(
          architectureId
        );
      const connections =
        await getArchitectureConnections(
          architectureId
        );

      const runtimeMysqlPassword =
        crypto.randomBytes(12).toString("hex");

      if (nodes.length === 0) {
        return res.status(400).json({
          error:
            "Architecture has no components to deploy",
        });
      }

      const networkName =
        await ensureDockerNetwork(
          architectureId
        );

      const deployments = [];

      const deploymentOrder = [
        ...nodes.filter(
          (node) =>
            node.component_type ===
            "MySQL Database"
        ),

        ...nodes.filter(
          (node) =>
            node.component_type ===
            "Redis Cache"
        ),

        ...nodes.filter(
          (node) =>
            node.component_type ===
            "API Server"
        ),

        ...nodes.filter(
          (node) =>
            node.component_type ===
            "Load Balancer"
        ),

        ...nodes.filter(
          (node) =>
            ![
              "MySQL Database",
              "Redis Cache",
              "API Server",
              "Load Balancer",
            ].includes(
              node.component_type
            )
        ),
      ];

      for (const node of deploymentOrder) {
        try {
          const dependencies =
            getNodeDependencies(
              node,
              nodes,
              connections
            );

          const deployment =
            await deployNodeLocally(
              architectureId,
              node,
              networkName,
              dependencies,
              runtimeMysqlPassword
            );

          // Databases/cache containers can be "running"
          // before they are actually ready.
          if (
            node.component_type ===
              "MySQL Database" ||
            node.component_type ===
              "Redis Cache"
          ) {
            const ready =
              await waitForContainerReady(
                deployment.containerName,
                node.component_type,
                runtimeMysqlPassword
              );

            if (!ready) {
              deployments.push({
                ...deployment,
                status: "Unhealthy",
                error:
                  `${node.component_type} failed to become ready`,
              });

              continue;
            }
          }

          const checkedDeployment =
            await determineDeploymentStatus(
              deployment
            );

          deployments.push(
            checkedDeployment
          );
        } catch (error) {
          console.error(
            `Failed to deploy ${node.label}:`,
            error
          );

          deployments.push({
            nodeId: node.id,
            type: node.component_type,
            serviceName:
              node.label ||
              node.component_type,
            status: "Failed",
            error: error.message,
          });
        }
      }

      res.json({
        architectureId:
          Number(architectureId),

        networkName,

        status: "Deployed",

        deployments,
      });
    } catch (error) {
      console.error(
        "Architecture deployment failed:",
        error
      );

      res.status(500).json({
        error:
          "Architecture deployment failed",
        details: error.message,
      });
    }
  }
);

app.post(
  "/api/architectures/:id/runtime/:nodeId/stop",
  async (req, res) => {
    const {
      id: architectureId,
      nodeId,
    } = req.params;

    const containerName =
      getRuntimeContainerName(
        architectureId,
        nodeId
      );

    try {
      await execFileAsync("docker", [
        "kill",
        containerName,
      ]);

      res.json({
        nodeId,
        containerName,
        status: "Failed",
      });
    } catch (error) {
      console.error(
        "Failed to stop container:",
        error
      );

      res.status(500).json({
        error: "Failed to stop service",
        details: error.message,
      });
    }
  }
);

app.post(
  "/api/architectures/:id/runtime/:nodeId/restart",
  async (req, res) => {
    const {
      id: architectureId,
      nodeId,
    } = req.params;

    const containerName =
      getRuntimeContainerName(
        architectureId,
        nodeId
      );

    try {
      await execFileAsync("docker", [
        "start",
        containerName,
      ]);

      res.json({
        nodeId,
        containerName,
        status: "Recovering",
      });
    } catch (error) {
      console.error(
        "Failed to restart container:",
        error
      );

      res.status(500).json({
        error: "Failed to restart service",
        details: error.message,
      });
    }
  }
);

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});