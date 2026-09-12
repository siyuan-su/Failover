const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const db = require("./db");

const app = express();

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

// Create an architecture
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

const PORT = 5000;

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
      return res.status(500).json({
        error: "Failed to load nodes",
      });
    }

    db.query(edgesSql, [architectureId], (error, edgeResults) => {
      if (error) {
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
          label: node.component_type,
          componentType: node.component_type,
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
      return res.status(500).json({
        error: "Failed to save architecture",
      });
    }

    db.query(deleteNodesSql, [architectureId], (error) => {
      if (error) {
        return res.status(500).json({
          error: "Failed to save architecture",
        });
      }

      const nodePromises = nodes.map((node) => {
        return new Promise((resolve, reject) => {
          const sql = `
            INSERT INTO nodes
            (id, architecture_id, component_type, position_x, position_y)
            VALUES (?, ?, ?, ?, ?)
          `;

          db.query(
            sql,
            [
              node.id,
              architectureId,
              node.data.label,
              node.position.x,
              node.position.y,
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
                (id, architecture_id, source_node_id, target_node_id)
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
          console.error(error);

          res.status(500).json({
            error: "Failed to save architecture",
          });
        });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});