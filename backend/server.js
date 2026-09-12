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
    ORDER BY created_at DESC
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});