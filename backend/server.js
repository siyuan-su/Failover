const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Failover backend is running");
});

const PORT = 5000;

const architectures = [
  {
    id: 1,
    name: "Black Friday Architecture",
    status: "Ready",
  },
  {
    id: 2,
    name: "Multi-Region Failover Test",
    status: "Ready",
  },
];

app.get("/api/architectures", (req, res) => {
  res.json(architectures);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.post("/api/architectures", (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() == "") {
    return res.status(400).json({
      error: "Architecture name is required",
    });
  }

  const newArchitecture = {
    id: Date.now(),
    name: name.trim(),
    status: "Ready",
  };

  architectures.push(newArchitecture);

  res.status(201).json(newArchitecture);
});