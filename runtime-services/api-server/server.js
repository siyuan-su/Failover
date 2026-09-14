const express = require("express");
const mysql = require("mysql2/promise");
const { createClient } = require("redis");

const app = express();

app.use(express.json());

const PORT =
  process.env.PORT || 3000;

const SERVICE_NAME =
  process.env.SERVICE_NAME ||
  "Failover API Server";

const CAPACITY =
  Number(process.env.CAPACITY) || 500;

async function checkMySQL() {
  if (!process.env.DB_HOST) {
    return null;
  }

  try {
    const connection =
      await mysql.createConnection({
        host: process.env.DB_HOST,

        port:
          Number(process.env.DB_PORT) ||
          3306,

        user: "root",

        password:
          process.env.DB_PASSWORD,

        database:
          "failover_runtime",
          
        connectTimeout: 750,
      });

    await connection.ping();

    await connection.end();

    return {
      status: "Connected",
    };
  } catch (error) {
    return {
      status: "Disconnected",
      error: error.message,
    };
  }
}

async function checkRedis() {
  if (!process.env.REDIS_HOST) {
    return null;
  }

  const client = createClient({
    socket: {
      host: process.env.REDIS_HOST,

      port:
        Number(process.env.REDIS_PORT) ||
        6379,

      connectTimeout: 750,

      reconnectStrategy: false,
    },
  });
  
  try {
    await client.connect();

    await client.ping();

    await client.quit();

    return {
      status: "Connected",
    };
  } catch (error) {
    if (client.isOpen) {
      await client.quit();
    }

    return {
      status: "Disconnected",
      error: error.message,
    };
  }
}

app.get("/", (req, res) => {
  res.json({
    service: SERVICE_NAME,

    message:
      "Failover runtime service is running",
  });
});

app.get("/health", async (req, res) => {
  const mysqlStatus =
    await checkMySQL();

  const redisStatus =
    await checkRedis();

  const dependencies = {};

  if (mysqlStatus) {
    dependencies.mysql =
      mysqlStatus;
  }

  if (redisStatus) {
    dependencies.redis =
      redisStatus;
  }

  const failedDependency =
    Object.values(
      dependencies
    ).some(
      (dependency) =>
        dependency.status !==
        "Connected"
    );

  const status =
    failedDependency
      ? "Degraded"
      : "Healthy";

  res
    .status(
      failedDependency ? 503 : 200
    )
    .json({
      service: SERVICE_NAME,
      status,
      capacity: CAPACITY,
      dependencies,

      timestamp:
        new Date().toISOString(),
    });
});

app.get("/work", async (req, res) => {
  const start = Date.now();

  await new Promise((resolve) => {
    setTimeout(resolve, 50);
  });

  res.json({
    service: SERVICE_NAME,
    success: true,

    durationMs:
      Date.now() - start,
  });
});

app.listen(PORT, () => {
  console.log(
    `${SERVICE_NAME} running on port ${PORT}`
  );
});