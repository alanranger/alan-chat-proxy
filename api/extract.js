// /api/extract.js
// Unified JSON-LD extractor API.
//
// Query params:
//   ?type=events|articles|products|services|all   (default: all)
//   ?url=<absolute-url>
//
// Returns JSON with extracted items. "all" includes events + articles + products + services.

import { NextResponse } from "next/server";

// NOTE: our helpers live in /api/json/*
import { extractEventItemsFromUrl } from "./json/events-extract.js";
import {
  extractArticlesFromUrl,
  extractProductsFromUrl,
  extractServicesFromUrl,
  extractAllFromUrl as extractContentAllFromUrl,
} from "./json/content-extract.js";

// Small helper to send JSON nicely
function send(res, status, obj) {
  return new NextResponse(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// Edge/Node compatibility
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    // Support both Next 13+ (Edge/Node) and old Vercel style
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const type = (urlObj.searchParams.get("type") || "all").toLowerCase();
    const target = urlObj.searchParams.get("url");

    if (!target) {
      return send(res, 400, { error: "bad_request", detail: "Provide ?url=" });
    }

    // CORS (useful for our static tester pages)
    const origin = req.headers.get?.("origin") || req.headers.origin || "*";
    const baseHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers: baseHeaders });
    }
    if (req.method !== "GET") {
      return new NextResponse(
        JSON.stringify({ error: "method_not_allowed" }),
        { status: 405, headers: baseHeaders }
      );
    }

    // Route by type
    if (type === "events" || type === "event" || type === "courses") {
      const items = await extractEventItemsFromUrl(target);
      return send(res, 200, {
        ok: true,
        url: target,
        count: items.length,
        items,
      });
    }

    if (type === "articles") {
      const items = await extractArticlesFromUrl(target);
      return send(res, 200, { ok: true, url: target, articles: items, count: items.length });
    }

    if (type === "products") {
      const items = await extractProductsFromUrl(target);
      return send(res, 200, { ok: true, url: target, products: items, count: items.length });
    }

    if (type === "services") {
      const items = await extractServicesFromUrl(target);
      return send(res, 200, { ok: true, url: target, services: items, count: items.length });
    }

    // ---------- ALL (now includes EVENTS too) ----------
    // content-extract's extractAllFromUrl returns {articles,products,services}
    // add events from events-extract and return one combined object
    const [contentAll, events] = await Promise.all([
      extractContentAllFromUrl(target), // {articles,products,services}
      extractEventItemsFromUrl(target), // EventItem[]
    ]);

    const out = {
      ok: true,
      url: target,
      events,
      articles: contentAll.articles || [],
      products: contentAll.products || [],
      services: contentAll.services || [],
      counts: {
        events: (events || []).length,
        articles: (contentAll.articles || []).length,
        products: (contentAll.products || []).length,
        services: (contentAll.services || []).length,
      },
    };

    return send(res, 200, out);
  } catch (err) {
    return send(res, 500, {
      error: "server_error",
      detail: String(err?.message || err),
      stack:
        process.env.NODE_ENV === "production" ? undefined : String(err?.stack || ""),
    });
  }
}
