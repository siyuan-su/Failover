const express = require("express");

const app = express();

app.use(express.json());

const PORT = 3000;

const backendHosts = (
  process.env.BACKENDS || ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

let currentIndex = 0;

async function checkBackend(host) {
  try {
    const response = await fetch(
      `http://${host}:3000/health`,
      {
        signal: AbortSignal.timeout(700),
      }
    );

    if (!response.ok) {
      return false;
    }

    const health = await response.json();

    return health.status === "Healthy";
  } catch {
    return false;
  }
}

async function getHealthyBackends() {
  const results = await Promise.all(
    backendHosts.map(async (host) => ({
      host,
      healthy: await checkBackend(host),
    }))
  );

  return results;
}

async function chooseBackend() {
  const backendStates =
    await getHealthyBackends();

  const healthyBackends =
    backendStates.filter(
      (backend) => backend.healthy
    );

  if (healthyBackends.length === 0) {
    return null;
  }

  const selected =
    healthyBackends[
      currentIndex %
        healthyBackends.length
    ];

  currentIndex =
    (currentIndex + 1) %
    healthyBackends.length;

  return selected.host;
}

app.get("/health", async (req, res) => {
  const backendStates =
    await getHealthyBackends();

  const healthyCount =
    backendStates.filter(
      (backend) => backend.healthy
    ).length;

  let status = "Failed";

  if (
    healthyCount ===
    backendStates.length &&
    healthyCount > 0
  ) {
    status = "Healthy";
  } else if (healthyCount > 0) {
    status = "Degraded";
  }

  res.json({
    service:
      process.env.SERVICE_NAME ||
      "Load Balancer",

    status,

    activeBackends: healthyCount,

    totalBackends:
      backendStates.length,

    backends: backendStates,

    timestamp:
      new Date().toISOString(),
  });
});

app.all("/proxy/*path", async (req, res) => {
  const backend =
    await chooseBackend();

  if (!backend) {
    return res.status(503).json({
      error:
        "No healthy API servers available",
    });
  }

  const path = req.params.path;

  try {
    const response = await fetch(
      `http://${backend}:3000/${path}`,
      {
        method: req.method,

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          req.method === "GET" ||
          req.method === "HEAD"
            ? undefined
            : JSON.stringify(req.body),

        signal:
          AbortSignal.timeout(1500),
      }
    );

    const text =
      await response.text();

    res
      .status(response.status)
      .type(
        response.headers.get(
          "content-type"
        ) || "text/plain"
      )
      .send(text);
  } catch {
    res.status(502).json({
      error:
        "Selected backend failed during request",
    });
  }
});

app.get("/", async (req, res) => {
  const backend =
    await chooseBackend();

  if (!backend) {
    return res.status(503).json({
      status: "Unavailable",
      message:
        "No healthy API servers are available",
    });
  }

  res.json({
    status: "Available",
    routedTo: backend,
  });
});

app.listen(PORT, () => {
  console.log(
    `Load balancer running on port ${PORT}`
  );

  console.log(
    "Configured backends:",
    backendHosts
  );
});