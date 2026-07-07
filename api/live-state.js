const DEFAULT_STATE_KEY = "hangzhou-event-live-state-v1";
const DEFAULT_BLOB_API_URL = "https://vercel.com/api/blob";
const MAX_BODY_BYTES = 128 * 1024;

let memoryRecord = null;

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");

  if (request.method === "OPTIONS") {
    response.setHeader("Allow", "GET,POST,OPTIONS");
    response.status(204).end();
    return;
  }

  if (request.method === "GET") {
    const record = await readLiveState();
    response.status(200).json({
      ok: true,
      ...record
    });
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET,POST,OPTIONS");
    response.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (!isAuthorized(request)) {
    response.status(401).json({ ok: false, error: "Invalid live control key" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const state = body && typeof body.state === "object" ? body.state : null;
    if (!state) {
      response.status(400).json({ ok: false, error: "Missing state object" });
      return;
    }

    const previous = await readLiveState();
    const nextRecord = {
      state,
      revision: Number(previous.revision || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    const storage = await writeLiveState(nextRecord);
    response.status(200).json({
      ok: true,
      ...nextRecord,
      storage
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      ok: false,
      error: error.message || "Failed to write live state"
    });
  }
};

function isAuthorized(request) {
  const expected = String(process.env.LIVE_CONTROL_KEY || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production";

  const provided = String(
    headerValue(request, "x-live-control-key")
    || request.query?.controlKey
    || ""
  ).trim();
  return provided && provided === expected;
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return request.body.trim() ? JSON.parse(request.body) : {};
  if (Buffer.isBuffer(request.body)) {
    const rawBody = request.body.toString("utf8").trim();
    return rawBody ? JSON.parse(rawBody) : {};
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function headerValue(request, name) {
  const headers = request.headers || {};
  if (typeof headers.get === "function") return headers.get(name);
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "";
}

async function readLiveState() {
  const blob = blobConfig();
  if (blob) {
    const value = await readBlobState(blob);
    if (!value) return emptyRecord("blob");
    try {
      return {
        ...emptyRecord("blob"),
        ...JSON.parse(value)
      };
    } catch (error) {
      console.warn("Invalid live state in blob", error);
      return emptyRecord("blob");
    }
  }

  const redis = redisConfig();
  if (redis) {
    const value = await redisCommand(redis, ["GET", stateKey()]);
    if (!value) return emptyRecord("redis");
    try {
      return {
        ...emptyRecord("redis"),
        ...JSON.parse(value)
      };
    } catch (error) {
      console.warn("Invalid live state in redis", error);
      return emptyRecord("redis");
    }
  }

  return {
    ...emptyRecord("memory"),
    ...(memoryRecord || {})
  };
}

async function writeLiveState(record) {
  const blob = blobConfig();
  if (blob) {
    await writeBlobState(blob, JSON.stringify(record));
    return "blob";
  }

  const redis = redisConfig();
  if (redis) {
    await redisCommand(redis, ["SET", stateKey(), JSON.stringify(record)]);
    return "redis";
  }

  memoryRecord = record;
  return "memory";
}

function emptyRecord(storage) {
  return {
    state: null,
    revision: 0,
    updatedAt: null,
    storage
  };
}

function stateKey() {
  return String(process.env.LIVE_STATE_KEY || DEFAULT_STATE_KEY).trim() || DEFAULT_STATE_KEY;
}

function blobConfig() {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) return null;

  const storeId = token.split("_")[3] || "";
  if (!storeId) throw new Error("Invalid BLOB_READ_WRITE_TOKEN");

  const pathname = String(process.env.BLOB_LIVE_STATE_PATH || `${stateKey()}.json`).trim();
  return {
    apiUrl: String(process.env.VERCEL_BLOB_API_URL || DEFAULT_BLOB_API_URL).replace(/\/+$/, ""),
    token,
    storeId,
    pathname
  };
}

async function readBlobState(blob) {
  const url = new URL(`https://${blob.storeId}.private.blob.vercel-storage.com/${blob.pathname}`);
  url.searchParams.set("cache", "0");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${blob.token}`,
      "Cache-Control": "no-cache"
    }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Blob read failed: HTTP ${response.status}`);
  }
  return response.text();
}

async function writeBlobState(blob, body) {
  const params = new URLSearchParams({ pathname: blob.pathname });
  const response = await fetch(`${blob.apiUrl}/?${params.toString()}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${blob.token}`,
      "Content-Type": "application/json",
      "x-api-version": "12",
      "x-vercel-blob-access": "private",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "1",
      "x-content-type": "application/json"
    },
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Blob write failed: HTTP ${response.status}`);
  }
  return payload;
}

function redisConfig() {
  const url = String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  return {
    url: url.replace(/\/+$/, ""),
    token
  };
}

async function redisCommand(redis, command) {
  const response = await fetch(redis.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Redis command failed: HTTP ${response.status}`);
  }
  return payload.result;
}
