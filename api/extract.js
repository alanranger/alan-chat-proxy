// /api/extract.js
// Unified JSON-LD extraction gateway with robust error responses.

export const config = { runtime: "nodejs" };

function sendJSON(res, status, obj) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).end(JSON.stringify(obj));
}

function badReq(res, msg) {
  sendJSON(res, 400, { ok: false, error: "bad_request", detail: msg });
}

export default async function handler(req, res) {
  // CORS (keep simple for the tester page)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return sendJSON(res, 405, { ok: false, error: "method_not_allowed" });

  const url = String(req.query.url || "").trim();
  const action = String(req.query.action || "").trim(); // e.g. events-extract, articles-extract, extract-all, ...

  if (!url) return badReq(res, 'Missing "url"');
  if (!action) return badReq(res, 'Missing "action"');

  let out = null;

  try {
    // Lazy import to keep cold start minimal
    const { extractEventsFromUrl } = await import("./json/events-extract.js");
    const {
      extractArticlesFromUrl,
      extractProductsFromUrl,
      extractServicesFromUrl,
      extractAllFromUrl,
    } = await import("./json/content-extract.js");

    switch (action) {
      case "events-extract": {
        const items = await extractEventsFromUrl(url);
        out = {
          ok: true,
          url,
          items,
          count: Array.isArray(items) ? items.length : 0,
        };
        break;
      }
      case "articles-extract": {
        const articles = await extractArticlesFromUrl(url);
        out = {
          ok: true,
          url,
          articles,
          counts: { articles: Array.isArray(articles) ? articles.length : 0 },
        };
        break;
      }
      case "products-extract": {
        const products = await extractProductsFromUrl(url);
        out = {
          ok: true,
          url,
          products,
          counts: { products: Array.isArray(products) ? products.length : 0 },
        };
        break;
      }
      case "services-extract": {
        const services = await extractServicesFromUrl(url);
        out = {
          ok: true,
          url,
          services,
          counts: { services: Array.isArray(services) ? services.length : 0 },
        };
        break;
      }
      case "extract-all": {
        // Use the generic "extractAllFromUrl" — this avoids importing missing per-type files.
        const all = await extractAllFromUrl(url);
        // Expected shape from content-extract: { articles:[], products:[], services:[] } (and optionally others)
        const articles = all?.articles || [];
        const products = all?.products || [];
        const services = all?.services || [];
        out = {
          ok: true,
          url,
          articles,
          products,
          services,
          counts: {
            articles: articles.length,
            products: products.length,
            services: services.length,
          },
        };
        break;
      }
      default: {
        return badReq(res, `Unknown action "${action}"`);
      }
    }

    return sendJSON(res, 200, out || { ok: true, url });
  } catch (err) {
    // Never crash the function; give a helpful JSON error out
    const detail =
      (err && (err.message || String(err))) ||
      "unexpected_error";
    return sendJSON(res, 500, {
      ok: false,
      error: "server_error",
      detail,
    });
  }
}
