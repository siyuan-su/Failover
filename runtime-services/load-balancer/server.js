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


/*BACKEND HEALTH STATE*/

const backendState = new Map();

for (const host of backendHosts) {
  backendState.set(host, {
    healthy: true,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
  });
}


/*SINGLE HEALTH PROBE*/

async function probeBackend(host) {
  try {
    const response = await fetch(`http://${host}:3000/health`,{  signal:    AbortSignal.timeout(2000),}
    );

    if (!response.ok) {
      return false;
    }

    const health =
      await response.json();

    return health.status === "Healthy";
  } catch (error) {
    console.log(
      `Health probe failed for ${host}:`,
      error.message
    );

    return false;
  }
}


/*STABLE HEALTH CHECK*/

async function checkBackend(host) {
  const state =
    backendState.get(host);

  if (!state) {
    return {
      host,
      healthy: false,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    };
  }

  const probeHealthy =
    await probeBackend(host);

  if (probeHealthy) {
    state.consecutiveSuccesses += 1;
    state.consecutiveFailures = 0;

    /*
     * One successful health check is enough
     * to bring a recovered backend online.
     */
    if (
      state.consecutiveSuccesses >= 1
    ) {
      state.healthy = true;
    }
  } else {
    state.consecutiveFailures += 1;
    state.consecutiveSuccesses = 0;

    /*
     * Do not eject a backend because of one
     * temporary timeout.
     *
     * Require 3 consecutive failures.
     */
    if (
      state.consecutiveFailures >= 3
    ) {
      state.healthy = false;
    }
  }

  return {
    host,
    healthy: state.healthy,
    consecutiveFailures:
      state.consecutiveFailures,
    consecutiveSuccesses:
      state.consecutiveSuccesses,
  };
}


/*CHECK ALL BACKENDS*/

async function getBackendStates() {
  return Promise.all(
    backendHosts.map(
      (host) =>
        checkBackend(host)
    )
  );
}


/*GET HEALTHY BACKENDS*/

async function getHealthyBackends() {
  const backendStates =
    await getBackendStates();

  return backendStates.filter(
    (backend) => backend.healthy
  );
}


/*ROUND ROBIN BACKEND SELECTION*/

async function chooseBackend() {
  const healthyBackends =
    await getHealthyBackends();

  if (
    healthyBackends.length === 0
  ) {
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


/*LOAD BALANCER HEALTH*/

app.get("/health", async (req, res) => {
  const backendStates =
    await getBackendStates();

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

    activeBackends:
      healthyCount,

    totalBackends:
      backendStates.length,

    backends:
      backendStates,

    timestamp:
      new Date().toISOString(),
  });
});


/*PROXY REQUESTS*/

app.all(
  "/proxy/*path",
  async (req, res) => {
    const backend =
      await chooseBackend();

    if (!backend) {
      return res
        .status(503)
        .json({
          error:
            "No healthy API servers available",
        });
    }

    const path =
      req.params.path;

    try {
      const response =
        await fetch(
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
                : JSON.stringify(
                    req.body
                  ),

            signal:
              AbortSignal.timeout(
                2000
              ),
          }
        );

      const text =
        await response.text();

      res
        .status(response.status)
        .type(
          response.headers.get(
            "content-type"
          ) ||
            "text/plain"
        )
        .send(text);
    } catch (error) {
      console.log(
        `Proxy request to ${backend} failed:`,
        error.message
      );

      res
        .status(502)
        .json({
          error:
            "Selected backend failed during request",
        });
    }
  }
);


/*ROOT ROUTE*/

app.get("/", async (req, res) => {
  const backend =
    await chooseBackend();

  if (!backend) {
    return res
      .status(503)
      .json({
        status:
          "Unavailable",

        message:
          "No healthy API servers are available",
      });
  }

  res.json({
    status: "Available",
    routedTo: backend,
  });
});


/*START SERVER*/

app.listen(PORT, () => {
  console.log(
    `Load balancer running on port ${PORT}`
  );

  console.log(
    "Configured backends:",
    backendHosts
  );
});