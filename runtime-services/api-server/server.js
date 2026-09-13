const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const SERVICE_NAME =
  process.env.SERVICE_NAME || "Failover API Server";

const CAPACITY =
  Number(process.env.CAPACITY) || 500;

app.get("/", (req, res) => {
  res.json({
    service: SERVICE_NAME,
    message: "Failover runtime service is running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    service: SERVICE_NAME,
    status: "Healthy",
    capacity: CAPACITY,
    timestamp: new Date().toISOString(),
  });
});

app.get("/work", async (req, res) => {
  const start = Date.now();

  // Simulate the API doing some work.
  await new Promise((resolve) => {
    setTimeout(resolve, 50);
  });

  res.json({
    service: SERVICE_NAME,
    success: true,
    durationMs: Date.now() - start,
  });
});

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} running on port ${PORT}`);
});