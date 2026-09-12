const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

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

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});