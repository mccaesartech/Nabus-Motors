import { performance } from "node:perf_hooks";

const DEFAULT_BASE_URL = "http://localhost:3000";
const PRODUCTION_HOSTS = new Set([
  "www.truegoshengh.com",
  "truegoshengh.com",
  "truegoshen.vercel.app",
  "truegoshen.com",
  "www.truegoshen.com",
  "truegoshenauto.com",
  "www.truegoshenauto.com",
  "truegoshenauto.vercel.app",
]);

const baseUrl = new URL(process.env.LOAD_BASE_URL || DEFAULT_BASE_URL);
const virtualUsers = boundedInteger("LOAD_VUS", 2, 1, 5);
const iterations = boundedInteger("LOAD_ITERATIONS", 2, 1, 10);
const timeoutMs = boundedInteger("LOAD_TIMEOUT_MS", 5_000, 500, 30_000);
const allowStaging = process.env.LOAD_ALLOW_STAGING === "true";
const runNegativeAuthProbes =
  process.env.LOAD_ENABLE_NEGATIVE_AUTH_PROBES === "true";

function boundedInteger(name, fallback, minimum, maximum) {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function assertSafeTarget() {
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("LOAD_BASE_URL must use http or https.");
  }
  if (PRODUCTION_HOSTS.has(baseUrl.hostname.toLowerCase())) {
    throw new Error("Refusing to load-test a production hostname.");
  }

  const loopback = ["localhost", "127.0.0.1", "::1"].includes(
    baseUrl.hostname.toLowerCase()
  );
  if (!loopback) {
    if (!allowStaging || process.env.LOAD_CONFIRM_NONPROD !== baseUrl.origin) {
      throw new Error(
        "Non-loopback targets require LOAD_ALLOW_STAGING=true and " +
          "LOAD_CONFIRM_NONPROD set to the exact target origin."
      );
    }
  }
}

const scenarios = [
  { name: "browse-home", method: "GET", path: "/", expected: [200] },
  {
    name: "browse-inventory",
    method: "GET",
    path: "/auto/inventory",
    expected: [200],
  },
  {
    name: "search-inventory",
    method: "GET",
    path: "/auto/inventory?q=phase6-smoke",
    expected: [200],
  },
  {
    name: "liveness",
    method: "GET",
    path: "/api/health/live",
    expected: [200],
  },
  { name: "register-page", method: "GET", path: "/register", expected: [200] },
  { name: "login-page", method: "GET", path: "/login", expected: [200] },
  {
    name: "password-reset-page",
    method: "GET",
    path: "/forgot-password",
    expected: [200],
  },
  {
    name: "pwa-manifest",
    method: "GET",
    path: "/manifest.webmanifest",
    expected: [200],
  },
  {
    name: "offline-fallback",
    method: "GET",
    path: "/offline",
    expected: [200],
  },
  {
    name: "service-worker",
    method: "GET",
    path: "/serwist/sw.js",
    expected: [200],
  },
];

if (runNegativeAuthProbes) {
  scenarios.push(
    {
      name: "listing-create-denied",
      method: "POST",
      path: "/api/admin/vehicles",
      expected: [401, 403],
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    },
    {
      name: "message-create-denied",
      method: "POST",
      path: "/api/customer/messages",
      expected: [401],
      body: JSON.stringify({ body: "" }),
      headers: { "content-type": "application/json" },
    },
    {
      name: "upload-denied",
      method: "POST",
      path: "/api/admin/vehicles/upload-image",
      expected: [401, 403],
    }
  );
}

async function executeScenario(scenario) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(scenario.path, baseUrl), {
      method: scenario.method,
      headers: scenario.headers,
      body: scenario.body,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const durationMs = performance.now() - started;
    await response.arrayBuffer();
    return {
      name: scenario.name,
      status: response.status,
      durationMs,
      ok: scenario.expected.includes(response.status),
    };
  } catch (error) {
    return {
      name: scenario.name,
      status: 0,
      durationMs: performance.now() - started,
      ok: false,
      error: error instanceof Error ? error.name : "RequestError",
    };
  }
}

function percentile(sortedValues, quantile) {
  if (!sortedValues.length) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil(sortedValues.length * quantile) - 1
  );
  return sortedValues[index];
}

async function main() {
  assertSafeTarget();
  const started = performance.now();
  const results = [];

  await Promise.all(
    Array.from({ length: virtualUsers }, async () => {
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        for (const scenario of scenarios) {
          results.push(await executeScenario(scenario));
        }
      }
    })
  );

  const durations = results
    .map((result) => result.durationMs)
    .sort((a, b) => a - b);
  const failures = results.filter((result) => !result.ok);
  const summary = {
    target: baseUrl.origin,
    mode: runNegativeAuthProbes ? "read-only-plus-denial-probes" : "read-only",
    virtualUsers,
    iterations,
    requests: results.length,
    failures: failures.length,
    errorRate: Number((failures.length / results.length).toFixed(4)),
    elapsedMs: Math.round(performance.now() - started),
    latencyMs: {
      p50: Math.round(percentile(durations, 0.5)),
      p95: Math.round(percentile(durations, 0.95)),
      max: Math.round(durations.at(-1) ?? 0),
    },
    byScenario: Object.fromEntries(
      scenarios.map((scenario) => {
        const matching = results.filter((result) => result.name === scenario.name);
        return [
          scenario.name,
          {
            requests: matching.length,
            failures: matching.filter((result) => !result.ok).length,
            statuses: [...new Set(matching.map((result) => result.status))].sort(),
          },
        ];
      })
    ),
  };

  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) process.exitCode = 1;
}

await main();
