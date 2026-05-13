function normalizeHost(host) {
  return String(host ?? "").trim().toLowerCase();
}

function isLocalHost(host) {
  const normalized = normalizeHost(host);
  return (
    normalized === "" ||
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

function parseConnectionUrl(connectionUrl) {
  if (!connectionUrl) {
    return null;
  }

  try {
    const url = new URL(connectionUrl);
    return {
      host: url.hostname,
      port: Number(url.port || "5432"),
      database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
    };
  } catch {
    return null;
  }
}

export function resolveTestDbMode(env = process.env) {
  const explicitMode = env.TEST_DB_MODE ?? env.TEST_DB_PREPARE_MODE;
  if (explicitMode === "remote") {
    return "remote";
  }

  if (explicitMode === "docker") {
    return "docker";
  }

  const testTarget = parseConnectionUrl(env.TEST_DATABASE_URL);
  const adminTarget = parseConnectionUrl(env.TEST_DB_ADMIN_URL);

  if ((testTarget && !isLocalHost(testTarget.host)) || (adminTarget && !isLocalHost(adminTarget.host))) {
    return "remote";
  }

  return "docker";
}

export function resolveDatabaseProbeTarget(env = process.env) {
  const testTarget = parseConnectionUrl(env.TEST_DATABASE_URL);
  if (testTarget) {
    return {
      host: testTarget.host,
      port: testTarget.port,
    };
  }

  const adminTarget = parseConnectionUrl(env.TEST_DB_ADMIN_URL);
  if (adminTarget) {
    return {
      host: adminTarget.host,
      port: adminTarget.port,
    };
  }

  return {
    host: env.TEST_DB_HOST ?? "127.0.0.1",
    port: Number(env.TEST_DB_PORT ?? "55432"),
  };
}

export function resolveTestDatabaseName(env = process.env, fallback = "prompt_management_test") {
  return parseConnectionUrl(env.TEST_DATABASE_URL)?.database || env.TEST_DB_DATABASE || fallback;
}

export function shouldRunDockerCleanup(env = process.env) {
  return resolveTestDbMode(env) === "docker";
}
