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