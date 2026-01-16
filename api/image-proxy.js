export const config = {
  runtime: "nodejs"
};

const ALLOWED_HOSTS = new Set([
  "images.squarespace-cdn.com",
  "static1.squarespace.com",
  "static2.squarespace.com",
  "static3.squarespace.com",
  "static4.squarespace.com"
]);

function getUrlParam(req) {
  const value = req.query && req.query.url;
  return typeof value === "string" ? value : "";
}

function isAllowedHost(url) {
  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(host)) return true;
  return host.endsWith(".squarespace-cdn.com") || host.endsWith(".squarespace.com");
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function parseUrl(raw, res) {
  try {
    return new URL(raw);
  } catch {
    sendJson(res, 400, { error: "bad_request", detail: "Invalid url" });
    return null;
  }
}

function validateRequest(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return null;
  }

  const raw = getUrlParam(req);
  if (!raw) {
    sendJson(res, 400, { error: "bad_request", detail: "Missing url param" });
    return null;
  }

  const url = parseUrl(raw, res);
  if (!url) return null;
  if (!isAllowedHost(url)) {
    sendJson(res, 403, { error: "forbidden", detail: "Host not allowed" });
    return null;
  }
  return url;
}

async function fetchImage(url) {
  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AlanRangerImageProxy/1.0)"
    }
  });
  if (!response.ok) {
    return { ok: false, status: response.status, statusText: response.statusText };
  }
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { ok: true, contentType, buffer };
}

function respondWithImage(res, result) {
  if (!result.ok) {
    sendJson(res, result.status, { error: "upstream_error", detail: result.statusText });
    return;
  }
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(result.buffer);
}

export default async function handler(req, res) {
  const url = validateRequest(req, res);
  if (!url) return;

  try {
    const result = await fetchImage(url);
    respondWithImage(res, result);
  } catch (error) {
    sendJson(res, 500, { error: "proxy_error", detail: String(error) });
  }
}
