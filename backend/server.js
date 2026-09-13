const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const { execFile } = require("child_process");
const { promisify } = require("util");

dotenv.config();

const execFileAsync = promisify(execFile);

const db = require("./db");

const app = express();

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

async function waitForHealthyService(
  hostPort,
  attempts = 10
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${hostPort}/health`
      );

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Container may still be starting.
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 500)
    );
  }

  throw new Error(
    `Service on port ${hostPort} failed its health check`
  );
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
                  target_node_id
                )
                VALUES (?, ?, ?, ?)
              `;

              db.query(
                sql,
                [
                  edge.id,
                  architectureId,
                  edge.source,
                  edge.target,
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
        await getArchitectureNodes(architectureId);

      const node = nodes.find(
        (currentNode) => currentNode.id === nodeId
      );

      if (!node) {
        return res.status(404).json({
          error: "Component not found",
        });
      }

      if (node.component_type !== "API Server") {
        return res.status(400).json({
          error:
            "Local deployment currently only supports API Server components",
        });
      }

      const deployment =
        await runDockerApiContainer(
          architectureId,
          node
        );

      try {
        const health =
          await waitForHealthyService(
            deployment.hostPort
          );

        return res.json({
          architectureId: Number(architectureId),

          deployment: {
            ...deployment,
            status: "Healthy",
            health,
          },
        });
      } catch (error) {
        return res.json({
          architectureId: Number(architectureId),

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

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});