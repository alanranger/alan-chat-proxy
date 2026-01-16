/* eslint-disable */
if (!window.ARSiteSearch) {
  const API_BASE = "https://alan-chat-proxy.vercel.app";
  const ENDPOINT = `${API_BASE}/api/search/query`;
  const PLACEHOLDER_IMAGE = "https://www.alanranger.com/s/default-image.jpg";
  const IMAGE_REFERRER_POLICY = "";

  const instances = new Map();
  let lastInstance = null;

  function ensureCssLoaded() {
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some(link => (link.getAttribute("href") || "").includes("/ar-site-search.css"));
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://alan-chat-proxy.vercel.app/ar-site-search.css";
    document.head.appendChild(link);
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getText(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  function firstNonEmpty(values) {
    for (const value of values) {
      if (value) return value;
    }
    return "";
  }

  function formatDateRange(ds, de) {
    if (!ds) return "";
    if (de && ds !== de) return `${ds} – ${de}`;
    return ds;
  }

  function fmtDateRange(item) {
    if (item.when) return item.when;
    const ds = item.date_start || item.date || "";
    const de = item.date_end || "";
    return formatDateRange(ds, de);
  }

  function ensureHttpUrl(value) {
    const url = getText(value);
    if (!url) return "";
    if (url.startsWith("https://")) return url;
    if (url.startsWith("http://")) return `https://${url.substring(7)}`;
    return "";
  }

  function addSquarespaceFormat(url) {
    if (!url || !url.includes("squarespace") || url.includes("format=")) return url;
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}format=300w`;
  }

  function normalizeImageUrl(value) {
    const url = ensureHttpUrl(value);
    return addSquarespaceFormat(url);
  }

  function pickImage(item) {
    return normalizeImageUrl(item.image_url);
  }

  function pickDescription(item, type) {
    const desc = firstNonEmpty([
      getText(item.excerpt),
      getText(item.meta_description),
      getText(item.description)
    ]);
    return desc || generateSummaryFallback(item, type);
  }

  function buildSummary(prefix, parts) {
    const filtered = parts.filter(Boolean);
    return filtered.length ? `${prefix}${filtered.join(" • ")}` : "";
  }

  function generateEventSummary(item) {
    const loc = getText(item.location || item.event_location || item.location_name || "");
    const dr = fmtDateRange(item);
    const exp = getText(item.experience_level || "");
    return buildSummary("Workshop in ", [loc, dr, exp]);
  }

  function generateGuideSummary(item) {
    const tags = [].concat(item.tags || [], item.categories || [])
      .map(getText)
      .filter(Boolean);
    if (!tags.length) return "";
    return `Guide covering ${tags.slice(0, 3).join(", ")}`;
  }

  function generateSummaryFallback(item, type) {
    if (type === "event") return generateEventSummary(item);
    if (type === "guide" || type === "service") return generateGuideSummary(item);
    return "";
  }

  function normalizePills(pills) {
    const seen = new Set();
    const out = [];
    for (const p of pills) {
      if (!p) continue;
      const s = String(p).trim().replace(/\s+/g, " ");
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  function splitPills(pills) {
    const pricePills = [];
    const otherPills = [];
    for (const p of pills) {
      if (p.startsWith("£")) {
        pricePills.push(p);
      } else {
        otherPills.push(p);
      }
    }
    return { pricePills, otherPills };
  }

  function renderPillSpans(pills, className) {
    return pills.map(p => `<span class="ar-pill${className}">${esc(p)}</span>`).join("");
  }

  function renderPills(pills, maxCount = 4) {
    const normalized = normalizePills(pills);
    const { pricePills, otherPills } = splitPills(normalized);
    const slotsForOthers = pricePills.length ? maxCount - 1 : maxCount;
    const toShow = otherPills.slice(0, slotsForOthers);
    const remaining = otherPills.length - slotsForOthers;
    let html = renderPillSpans(toShow, "");
    html += renderPillSpans(pricePills, " price");
    if (remaining > 0) {
      html += `<span class="ar-pill">+${remaining}</span>`;
    }
    return html;
  }

  function getPageUrl(item) {
    return item.page_url || item.event_url || item.href || item.url || "";
  }

  function renderThumb(item, type, title) {
    const resolvedUrl = pickImage(item);
    const dataSrc = resolvedUrl || PLACEHOLDER_IMAGE;
    const pageUrl = getPageUrl(item);
    return (
      '<div class="ar-thumb">' +
        '<img class="ar-thumb-img" data-src="' + esc(dataSrc) + '"' +
        ' data-page-url="' + esc(pageUrl) + '"' +
        ' alt="' + esc(title) + '"' +
        ' loading="lazy" decoding="async">' +
      "</div>"
    );
  }

  function buildFallbackImageUrl(url) {
    if (!url) return "";
    const fallback = addSquarespaceFormat(url);
    return fallback && fallback !== url ? fallback : "";
  }

  function initThumbImages(rootEl) {
    const imgs = rootEl.querySelectorAll(".ar-thumb-img");
    imgs.forEach((img) => {
      const dataSrc = (img.getAttribute("data-src") || "").trim();
      const resolvedUrl = dataSrc && dataSrc !== "null" && dataSrc !== "undefined"
        ? dataSrc
        : PLACEHOLDER_IMAGE;
      if (IMAGE_REFERRER_POLICY) {
        img.referrerPolicy = IMAGE_REFERRER_POLICY;
      }
      img.onerror = () => {
        if (!img.dataset.triedFallback) {
          const fallback = buildFallbackImageUrl(dataSrc);
          if (fallback) {
            img.dataset.triedFallback = "1";
            img.src = fallback;
            return;
          }
        }
        img.onerror = null;
        img.src = PLACEHOLDER_IMAGE;
      };
      img.src = resolvedUrl;
    });
  }

  function getPriceLabel(item) {
    if (item.price_gbp) return `£${item.price_gbp}`;
    if (item.price) return `£${item.price}`;
    return "";
  }

  function buildSubtitle(item, kind) {
    const parts = [];
    const dr = fmtDateRange(item);
    const loc = getText(item.location || item.event_location || item.location_name || "");
    const price = getPriceLabel(item);
    if (dr) parts.push(dr);
    if (loc) parts.push(loc);
    if (price && kind === "event") parts.push(price);
    return parts.join(" · ");
  }

  function collectEventPills(item) {
    const candidates = ["event"];
    const loc = getText(item.location || item.event_location || item.location_name || "");
    if (loc) candidates.push(loc);
    const price = getPriceLabel(item);
    if (price) candidates.push(price);
    if (item.participants) candidates.push(`${item.participants} people`);
    if (item.fitness_level) candidates.push(item.fitness_level);
    if (item.experience_level) candidates.push(item.experience_level);
    return candidates;
  }

  function collectGuidePills(item, kind) {
    const kindLabel = kind === "service" ? "service" : "guide";
    const candidates = [kindLabel];
    (item.tags || []).forEach(t => candidates.push(t));
    (item.categories || []).forEach(c => candidates.push(c));
    return candidates;
  }

  function collectPillCandidates(item, kind) {
    return kind === "event" ? collectEventPills(item) : collectGuidePills(item, kind);
  }

  function buildActions(item, kind, href) {
    const actions = [];
    actions.push(`<a class="ar-btn more" href="${esc(href)}">More info →</a>`);
    if (kind === "event" && item.product_url) {
      actions.push(`<a class="ar-btn book" href="${esc(item.product_url)}">Book now</a>`);
    }
    return actions;
  }

  function getCardTitle(item) {
    return item.title || item.event_title || item.product_title || "Untitled";
  }

  function getCardHref(item) {
    return item.href || item.page_url || item.event_url || "#";
  }

  function resolveDescription(item, kind) {
    const desc = pickDescription(item, kind);
    const showDesc = kind === "event" ? true : Boolean(desc);
    return { desc, showDesc };
  }

  function buildCardHtml(card) {
    return (
      '<div class="ar-card">' +
        card.thumb +
        '<div class="ar-body">' +
          '<div class="ar-title">' + esc(card.title) + "</div>" +
          (card.subtitle ? '<div class="ar-sub">' + esc(card.subtitle) + "</div>" : "") +
          (card.showDesc ? '<div class="ar-desc">' + esc(card.desc) + "</div>" : "") +
          (card.pillsHtml ? '<div class="ar-pills">' + card.pillsHtml + "</div>" : "") +
          (card.actions.length ? '<div class="ar-actions">' + card.actions.join("") + "</div>" : "") +
        "</div>" +
      "</div>"
    );
  }

  function renderCard(item, kind) {
    const title = getCardTitle(item);
    const href = getCardHref(item);
    const thumb = renderThumb(item, kind, title);
    const subtitle = buildSubtitle(item, kind);
    const { desc, showDesc } = resolveDescription(item, kind);
    const pillsHtml = renderPills(collectPillCandidates(item, kind), 4);
    const actions = buildActions(item, kind, href);
    return buildCardHtml({
      title,
      subtitle,
      desc,
      showDesc,
      pillsHtml,
      actions,
      thumb
    });
  }

  function renderSection(config) {
    const arr = dedupe(config.items || [], config.keyFn);
    const count = arr.length;
    let html = '<div class="ar-ss-section">';
    const headClass = config.headClass ? ` ${config.headClass}` : "";
    html += '<div class="ar-ss-section-head' + headClass + '"><h3>' + esc(config.label) + "</h3>" +
      '<div class="ar-ss-count">' + count + " matches</div></div>";
    if (!count) {
      html += '<div class="ar-empty">No matches.</div></div>';
      return html;
    }
    html += '<div class="ar-ss-grid">';
    for (const item of arr) {
      html += renderCard(item, config.kind);
    }
    html += "</div></div>";
    return html;
  }

  function dedupe(arr, keyFn) {
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      const k = keyFn(x);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  function ensureRootMarkup(rootEl) {
    if (rootEl.children.length > 0) return;
    rootEl.innerHTML = "" +
      '<div class="ar-ss-wrap">' +
        '<div class="ar-ss-searchcard">' +
          '<div class="ar-ss-row">' +
            '<input class="ar-ss-input" type="text" inputmode="search" placeholder="Search Courses, Workshops, Private Lessons and Other Services or Articles & Topics for Advice on Gear and Photography" />' +
            '<button class="ar-ss-btn" type="button">Search</button>' +
          "</div>" +
          '<div class="ar-ss-meta">' +
            '<div class="ar-ss-chip">' +
              '<span class="ar-ss-dot"></span>' +
              '<span class="ar-ss-status-text">Type a query and press Enter.</span>' +
            "</div>" +
            '<div class="ar-ss-chip ar-ss-chip-muted ar-ss-confidence">Confidence: —</div>' +
          "</div>" +
        "</div>" +
        '<div class="ar-ss-results"></div>' +
      "</div>";
  }

  function createElements(containerEl) {
    ensureRootMarkup(containerEl);
    return {
      rootEl: containerEl,
      input: containerEl.querySelector(".ar-ss-input"),
      button: containerEl.querySelector(".ar-ss-btn"),
      results: containerEl.querySelector(".ar-ss-results"),
      statusText: containerEl.querySelector(".ar-ss-status-text"),
      confidence: containerEl.querySelector(".ar-ss-confidence")
    };
  }

  function setStatus(elements, msg) {
    elements.statusText.textContent = msg;
  }

  function setConfidence(elements, val) {
    if (typeof val === "number" && Number.isFinite(val)) {
      const pct = Math.round(val * 100);
      elements.confidence.textContent = `Confidence: ${pct}%`;
    } else {
      elements.confidence.textContent = "Confidence: —";
    }
  }

  function resetResults(elements, msg) {
    setStatus(elements, msg);
    setConfidence(elements, null);
    elements.results.innerHTML = "";
  }

  function updateUrl(query, settings) {
    if (!settings.updateUrl) return;
    const url = new URL(window.location.href);
    url.searchParams.set("q", query);
    window.history.replaceState({}, "", url.toString());
  }

  async function fetchResults(query) {
    const r = await fetch(`${ENDPOINT}?q=${encodeURIComponent(query)}&limit=24`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    return r.json();
  }

  function isValidResponse(data) {
    return data && data.ok === true;
  }

  function renderAll(elements, structured) {
    const events = structured && structured.events ? structured.events : [];
    const services = structured && structured.services ? structured.services : [];
    const articles = structured && structured.articles ? structured.articles : [];
    let html = "";
    html += renderSection({
      label: "Events",
      items: events,
      kind: "event",
      headClass: "ar-ss-head-events",
      keyFn: (e) => ((e.event_url || e.page_url || e.href || "") + "|" + (e.date_start || e.date || ""))
    });
    html += renderSection({
      label: "Services",
      items: services,
      kind: "service",
      headClass: "ar-ss-head-services",
      keyFn: (s) => (s.page_url || s.href || "")
    });
    html += renderSection({
      label: "Guides",
      items: articles,
      kind: "guide",
      headClass: "ar-ss-head-guides",
      keyFn: (a) => (a.page_url || a.href || "")
    });
    elements.results.innerHTML = html;
    initThumbImages(elements.rootEl);
  }

  function normalizeQuery(query) {
    return (query || "").trim();
  }

  function setInputValue(elements, query) {
    elements.input.value = query;
  }

  async function runSearch(state, query) {
    const q = normalizeQuery(query);
    if (!q) {
      resetResults(state.elements, "Type a query and press Enter.");
      return;
    }

    setInputValue(state.elements, q);
    setStatus(state.elements, `Searching for "${q}"…`);
    setConfidence(state.elements, null);
    updateUrl(q, state.settings);

    try {
      const data = await fetchResults(q);
      if (!isValidResponse(data)) {
        resetResults(state.elements, "Search failed. Please try again.");
        return;
      }
      setStatus(state.elements, `Results for "${q}"`);
      setConfidence(state.elements, data.confidence);
      renderAll(state.elements, data.structured || {});
    } catch (error) {
      void error;
      resetResults(state.elements, "Search failed. Please try again.");
    }
  }

  function bindHandlers(state) {
    const elements = state.elements;
    const handleSubmit = () => runSearch(state, elements.input.value);
    elements.button.addEventListener("click", handleSubmit);
    elements.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSubmit();
    });
    if (state.settings.autoFocus) {
      elements.input.focus();
    }
  }

  function createInstance(containerEl, settings) {
    const elements = createElements(containerEl);
    return {
      containerEl: elements.rootEl,
      runSearch: (query) => runSearch({ elements, settings }, query),
      bind: () => bindHandlers({ elements, settings }),
      setQuery: (query) => setInputValue(elements, query || ""),
      getQuery: () => elements.input.value || ""
    };
  }

  function resolveUpdateUrl(containerEl, opts) {
    if (typeof opts.updateUrl === "boolean") return opts.updateUrl;
    const pageRoot = document.getElementById("ar-site-search");
    return containerEl === pageRoot;
  }

  function mount(containerEl, opts = {}) {
    if (!containerEl) return null;
    ensureCssLoaded();
    const settings = {
      initialQuery: opts.initialQuery || "",
      autoSearch: Boolean(opts.autoSearch),
      autoFocus: Boolean(opts.autoFocus),
      updateUrl: resolveUpdateUrl(containerEl, opts)
    };
    let instance = instances.get(containerEl);
    if (!instance) {
      instance = createInstance(containerEl, settings);
      instances.set(containerEl, instance);
      instance.bind();
    }
    lastInstance = instance;
    if (settings.initialQuery) {
      instance.setQuery(settings.initialQuery);
      if (settings.autoSearch) {
        instance.runSearch(settings.initialQuery);
      }
    }
    return instance;
  }

  function unmount(containerEl) {
    const instance = instances.get(containerEl);
    if (!instance) return;
    instances.delete(containerEl);
    if (containerEl) {
      containerEl.innerHTML = "";
    }
    if (lastInstance === instance) {
      lastInstance = null;
    }
  }

  function setQuery(query) {
    if (!lastInstance) return;
    lastInstance.setQuery(query);
  }

  function run() {
    if (!lastInstance) return;
    lastInstance.runSearch(lastInstance.getQuery());
  }

  window.ARSiteSearch = { mount, unmount, setQuery, run };
}
if (!window.ARSiteSearch) {
  const API_BASE = "https://alan-chat-proxy.vercel.app";
  const ENDPOINT = `${API_BASE}/api/search/query`;
  const PLACEHOLDER_IMAGE = "https://www.alanranger.com/s/default-image.jpg";
  const IMAGE_REFERRER_POLICY = "";

  const instances = new Map();
  let lastInstance = null;

  function ensureCssLoaded() {
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some(link => (link.getAttribute("href") || "").includes("/ar-site-search.css"));
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/ar-site-search.css";
    document.head.appendChild(link);
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getText(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  function firstNonEmpty(values) {
    for (const value of values) {
      if (value) return value;
    }
    return "";
  }

  function formatDateRange(ds, de) {
    if (!ds) return "";
    if (de && ds !== de) return `${ds} – ${de}`;
    return ds;
  }

  function fmtDateRange(item) {
    if (item.when) return item.when;
    const ds = item.date_start || item.date || "";
    const de = item.date_end || "";
    return formatDateRange(ds, de);
  }

  function ensureHttpUrl(value) {
    const url = getText(value);
    if (!url) return "";
    if (url.startsWith("https://")) return url;
    if (url.startsWith("http://")) return `https://${url.substring(7)}`;
    return "";
  }

  function pickImage(item) {
    return ensureHttpUrl(item.image_url);
  }

  function pickDescription(item, type) {
    const desc = firstNonEmpty([
      getText(item.excerpt),
      getText(item.meta_description),
      getText(item.description)
    ]);
    return desc || generateSummaryFallback(item, type);
  }

  function buildSummary(prefix, parts) {
    const filtered = parts.filter(Boolean);
    return filtered.length ? `${prefix}${filtered.join(" • ")}` : "";
  }

  function generateEventSummary(item) {
    const loc = getText(item.location || item.event_location || item.location_name || "");
    const dr = fmtDateRange(item);
    const exp = getText(item.experience_level || "");
    return buildSummary("Workshop in ", [loc, dr, exp]);
  }

  function generateGuideSummary(item) {
    const tags = [].concat(item.tags || [], item.categories || [])
      .map(getText)
      .filter(Boolean);
    if (!tags.length) return "";
    return `Guide covering ${tags.slice(0, 3).join(", ")}`;
  }

  function generateSummaryFallback(item, type) {
    if (type === "event") return generateEventSummary(item);
    if (type === "guide" || type === "service") return generateGuideSummary(item);
    return "";
  }

  function normalizePills(pills) {
    const seen = new Set();
    const out = [];
    for (const p of pills) {
      if (!p) continue;
      const s = String(p).trim().replace(/\s+/g, " ");
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  function splitPills(pills) {
    const pricePills = [];
    const otherPills = [];
    for (const p of pills) {
      if (p.startsWith("£")) {
        pricePills.push(p);
      } else {
        otherPills.push(p);
      }
    }
    return { pricePills, otherPills };
  }

  function renderPillSpans(pills, className) {
    return pills.map(p => `<span class="ar-pill${className}">${esc(p)}</span>`).join("");
  }

  function renderPills(pills, maxCount = 4) {
    const normalized = normalizePills(pills);
    const { pricePills, otherPills } = splitPills(normalized);
    const slotsForOthers = pricePills.length ? maxCount - 1 : maxCount;
    const toShow = otherPills.slice(0, slotsForOthers);
    const remaining = otherPills.length - slotsForOthers;
    let html = renderPillSpans(toShow, "");
    html += renderPillSpans(pricePills, " price");
    if (remaining > 0) {
      html += `<span class="ar-pill">+${remaining}</span>`;
    }
    return html;
  }

  function getPageUrl(item) {
    return item.page_url || item.event_url || item.href || item.url || "";
  }

  function renderThumb(item, type, title) {
    const resolvedUrl = pickImage(item);
    const dataSrc = resolvedUrl || PLACEHOLDER_IMAGE;
    const pageUrl = getPageUrl(item);
    return (
      '<div class="ar-thumb">' +
        '<img class="ar-thumb-img" data-src="' + esc(dataSrc) + '"' +
        ' data-page-url="' + esc(pageUrl) + '"' +
        ' alt="' + esc(title) + '"' +
        ' loading="lazy" decoding="async">' +
      "</div>"
    );
  }

  function initThumbImages(rootEl) {
    const imgs = rootEl.querySelectorAll(".ar-thumb-img");
    imgs.forEach((img) => {
      const dataSrc = (img.getAttribute("data-src") || "").trim();
      const resolvedUrl = dataSrc && dataSrc !== "null" && dataSrc !== "undefined"
        ? dataSrc
        : PLACEHOLDER_IMAGE;
      if (IMAGE_REFERRER_POLICY) {
        img.referrerPolicy = IMAGE_REFERRER_POLICY;
      }
      img.onerror = () => {
        img.onerror = null;
        img.src = PLACEHOLDER_IMAGE;
      };
      img.src = resolvedUrl;
    });
  }

  function getPriceLabel(item) {
    if (item.price_gbp) return `£${item.price_gbp}`;
    if (item.price) return `£${item.price}`;
    return "";
  }

  function buildSubtitle(item, kind) {
    const parts = [];
    const dr = fmtDateRange(item);
    const loc = getText(item.location || item.event_location || item.location_name || "");
    const price = getPriceLabel(item);
    if (dr) parts.push(dr);
    if (loc) parts.push(loc);
    if (price && kind === "event") parts.push(price);
    return parts.join(" · ");
  }

  function collectEventPills(item) {
    const candidates = ["event"];
    const loc = getText(item.location || item.event_location || item.location_name || "");
    if (loc) candidates.push(loc);
    const price = getPriceLabel(item);
    if (price) candidates.push(price);
    if (item.participants) candidates.push(`${item.participants} people`);
    if (item.fitness_level) candidates.push(item.fitness_level);
    if (item.experience_level) candidates.push(item.experience_level);
    return candidates;
  }

  function collectGuidePills(item, kind) {
    const kindLabel = kind === "service" ? "service" : "guide";
    const candidates = [kindLabel];
    (item.tags || []).forEach(t => candidates.push(t));
    (item.categories || []).forEach(c => candidates.push(c));
    return candidates;
  }

  function collectPillCandidates(item, kind) {
    return kind === "event" ? collectEventPills(item) : collectGuidePills(item, kind);
  }

  function buildActions(item, kind, href) {
    const actions = [];
    actions.push(`<a class="ar-btn more" href="${esc(href)}">More info →</a>`);
    if (kind === "event" && item.product_url) {
      actions.push(`<a class="ar-btn book" href="${esc(item.product_url)}">Book now</a>`);
    }
    return actions;
  }

  function getCardTitle(item) {
    return item.title || item.event_title || item.product_title || "Untitled";
  }

  function getCardHref(item) {
    return item.href || item.page_url || item.event_url || "#";
  }

  function resolveDescription(item, kind) {
    const desc = pickDescription(item, kind);
    const showDesc = kind === "event" ? true : Boolean(desc);
    return { desc, showDesc };
  }

  function buildCardHtml(card) {
    return (
      '<div class="ar-card">' +
        card.thumb +
        '<div class="ar-body">' +
          '<div class="ar-title">' + esc(card.title) + "</div>" +
          (card.subtitle ? '<div class="ar-sub">' + esc(card.subtitle) + "</div>" : "") +
          (card.showDesc ? '<div class="ar-desc">' + esc(card.desc) + "</div>" : "") +
          (card.pillsHtml ? '<div class="ar-pills">' + card.pillsHtml + "</div>" : "") +
          (card.actions.length ? '<div class="ar-actions">' + card.actions.join("") + "</div>" : "") +
        "</div>" +
      "</div>"
    );
  }

  function renderCard(item, kind) {
    const title = getCardTitle(item);
    const href = getCardHref(item);
    const thumb = renderThumb(item, kind, title);
    const subtitle = buildSubtitle(item, kind);
    const { desc, showDesc } = resolveDescription(item, kind);
    const pillsHtml = renderPills(collectPillCandidates(item, kind), 4);
    const actions = buildActions(item, kind, href);
    return buildCardHtml({
      title,
      subtitle,
      desc,
      showDesc,
      pillsHtml,
      actions,
      thumb
    });
  }

  function renderSection(config) {
    const arr = dedupe(config.items || [], config.keyFn);
    const count = arr.length;
    let html = '<div class="ar-ss-section">';
    html += '<div class="ar-ss-section-head"><h3>' + esc(config.label) + "</h3>" +
      '<div class="ar-ss-count">' + count + " matches</div></div>";
    if (!count) {
      html += '<div class="ar-empty">No matches.</div></div>';
      return html;
    }
    html += '<div class="ar-ss-grid">';
    for (const item of arr) {
      html += renderCard(item, config.kind);
    }
    html += "</div></div>";
    return html;
  }

  function dedupe(arr, keyFn) {
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      const k = keyFn(x);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  function ensureRootMarkup(rootEl) {
    if (rootEl.children.length > 0) return;
    rootEl.innerHTML = "" +
      '<div class="ar-ss-wrap">' +
        '<div class="ar-ss-searchcard">' +
          '<div class="ar-ss-row">' +
            '<input class="ar-ss-input" type="text" inputmode="search" placeholder="Search workshops, guides, services, landing pages…" />' +
            '<button class="ar-ss-btn" type="button">Search</button>' +
          "</div>" +
          '<div class="ar-ss-meta">' +
            '<div class="ar-ss-chip">' +
              '<span class="ar-ss-dot"></span>' +
              '<span class="ar-ss-status-text">Type a query and press Enter.</span>' +
            "</div>" +
            '<div class="ar-ss-chip ar-ss-chip-muted ar-ss-confidence">Confidence: —</div>' +
          "</div>" +
        "</div>" +
        '<div class="ar-ss-results"></div>' +
      "</div>";
  }

  function createElements(containerEl) {
    ensureRootMarkup(containerEl);
    return {
      rootEl: containerEl,
      input: containerEl.querySelector(".ar-ss-input"),
      button: containerEl.querySelector(".ar-ss-btn"),
      results: containerEl.querySelector(".ar-ss-results"),
      statusText: containerEl.querySelector(".ar-ss-status-text"),
      confidence: containerEl.querySelector(".ar-ss-confidence")
    };
  }

  function setStatus(elements, msg) {
    elements.statusText.textContent = msg;
  }

  function setConfidence(elements, val) {
    if (typeof val === "number" && Number.isFinite(val)) {
      const pct = Math.round(val * 100);
      elements.confidence.textContent = `Confidence: ${pct}%`;
    } else {
      elements.confidence.textContent = "Confidence: —";
    }
  }

  function resetResults(elements, msg) {
    setStatus(elements, msg);
    setConfidence(elements, null);
    elements.results.innerHTML = "";
  }

  function updateUrl(query, settings) {
    if (!settings.updateUrl) return;
    const url = new URL(window.location.href);
    url.searchParams.set("q", query);
    window.history.replaceState({}, "", url.toString());
  }

  async function fetchResults(query) {
    const r = await fetch(`${ENDPOINT}?q=${encodeURIComponent(query)}&limit=24`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    return r.json();
  }

  function isValidResponse(data) {
    return data && data.ok === true;
  }

  function renderAll(elements, structured) {
    const events = structured && structured.events ? structured.events : [];
    const services = structured && structured.services ? structured.services : [];
    const articles = structured && structured.articles ? structured.articles : [];
    let html = "";
    html += renderSection({
      label: "Workshops",
      items: events,
      kind: "event",
      keyFn: (e) => ((e.event_url || e.page_url || e.href || "") + "|" + (e.date_start || e.date || ""))
    });
    html += renderSection({
      label: "Services",
      items: services,
      kind: "service",
      keyFn: (s) => (s.page_url || s.href || "")
    });
    html += renderSection({
      label: "Guides",
      items: articles,
      kind: "guide",
      keyFn: (a) => (a.page_url || a.href || "")
    });
    elements.results.innerHTML = html;
    initThumbImages(elements.rootEl);
  }

  function normalizeQuery(query) {
    return (query || "").trim();
  }

  function setInputValue(elements, query) {
    elements.input.value = query;
  }

  async function runSearch(state, query) {
    const q = normalizeQuery(query);
    if (!q) {
      resetResults(state.elements, "Type a query and press Enter.");
      return;
    }

    setInputValue(state.elements, q);
    setStatus(state.elements, `Searching for "${q}"…`);
    setConfidence(state.elements, null);
    updateUrl(q, state.settings);

    try {
      const data = await fetchResults(q);
      if (!isValidResponse(data)) {
        resetResults(state.elements, "Search failed. Please try again.");
        return;
      }
      setStatus(state.elements, `Results for "${q}"`);
      setConfidence(state.elements, data.confidence);
      renderAll(state.elements, data.structured || {});
    } catch (error) {
      void error;
      resetResults(state.elements, "Search failed. Please try again.");
    }
  }

  function bindHandlers(state) {
    const elements = state.elements;
    const handleSubmit = () => runSearch(state, elements.input.value);
    elements.button.addEventListener("click", handleSubmit);
    elements.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSubmit();
    });
    if (state.settings.autoFocus) {
      elements.input.focus();
    }
  }

  function createInstance(containerEl, settings) {
    const elements = createElements(containerEl);
    return {
      containerEl: elements.rootEl,
      runSearch: (query) => runSearch({ elements, settings }, query),
      bind: () => bindHandlers({ elements, settings }),
      setQuery: (query) => setInputValue(elements, query || ""),
      getQuery: () => elements.input.value || ""
    };
  }

  function resolveUpdateUrl(containerEl, opts) {
    if (typeof opts.updateUrl === "boolean") return opts.updateUrl;
    const pageRoot = document.getElementById("ar-site-search");
    return containerEl === pageRoot;
  }

  function mount(containerEl, opts = {}) {
    if (!containerEl) return null;
    ensureCssLoaded();
    const settings = {
      initialQuery: opts.initialQuery || "",
      autoSearch: Boolean(opts.autoSearch),
      autoFocus: Boolean(opts.autoFocus),
      updateUrl: resolveUpdateUrl(containerEl, opts)
    };
    let instance = instances.get(containerEl);
    if (!instance) {
      instance = createInstance(containerEl, settings);
      instances.set(containerEl, instance);
      instance.bind();
    }
    lastInstance = instance;
    if (settings.initialQuery) {
      instance.setQuery(settings.initialQuery);
      if (settings.autoSearch) {
        instance.runSearch(settings.initialQuery);
      }
    }
    return instance;
  }

  function unmount(containerEl) {
    const instance = instances.get(containerEl);
    if (!instance) return;
    instances.delete(containerEl);
    if (containerEl) {
      containerEl.innerHTML = "";
    }
    if (lastInstance === instance) {
      lastInstance = null;
    }
  }

  function setQuery(query) {
    if (!lastInstance) return;
    lastInstance.setQuery(query);
  }

  function run() {
    if (!lastInstance) return;
    lastInstance.runSearch(lastInstance.getQuery());
  }

  window.ARSiteSearch = { mount, unmount, setQuery, run };
}
if (!window.ARSiteSearch) {
  const API_BASE = "https://alan-chat-proxy.vercel.app";
  const ENDPOINT = `${API_BASE}/api/search/query`;
  const PLACEHOLDER_IMAGE = "https://www.alanranger.com/s/default-image.jpg";
  const IMAGE_REFERRER_POLICY = "";

  const instances = new Map();
  let lastInstance = null;

  function ensureCssLoaded() {
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some(link => (link.getAttribute("href") || "").includes("/ar-site-search.css"));
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/ar-site-search.css";
    document.head.appendChild(link);
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getText(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  function firstNonEmpty(values) {
    for (const value of values) {
      if (value) return value;
    }
    return "";
  }

  function formatDateRange(ds, de) {
    if (!ds) return "";
    if (de && ds !== de) return `${ds} – ${de}`;
    return ds;
  }

  function fmtDateRange(item) {
    if (item.when) return item.when;
    const ds = item.date_start || item.date || "";
    const de = item.date_end || "";
    return formatDateRange(ds, de);
  }

  function ensureHttpUrl(value) {
    const url = getText(value);
    if (!url) return "";
    if (url.startsWith("https://")) return url;
    if (url.startsWith("http://")) return `https://${url.substring(7)}`;
    return "";
  }

  function pickImage(item) {
    return ensureHttpUrl(item.image_url);
  }

  function pickDescription(item, type) {
    const desc = firstNonEmpty([
      getText(item.excerpt),
      getText(item.meta_description),
      getText(item.description)
    ]);
    return desc || generateSummaryFallback(item, type);
  }

  function buildSummary(prefix, parts) {
    const filtered = parts.filter(Boolean);
    return filtered.length ? `${prefix}${filtered.join(" • ")}` : "";
  }

  function generateEventSummary(item) {
    const loc = getText(item.location || item.event_location || item.location_name || "");
    const dr = fmtDateRange(item);
    const exp = getText(item.experience_level || "");
    return buildSummary("Workshop in ", [loc, dr, exp]);
  }

  function generateGuideSummary(item) {
    const tags = [].concat(item.tags || [], item.categories || [])
      .map(getText)
      .filter(Boolean);
    if (!tags.length) return "";
    return `Guide covering ${tags.slice(0, 3).join(", ")}`;
  }

  function generateSummaryFallback(item, type) {
    if (type === "event") return generateEventSummary(item);
    if (type === "guide" || type === "service") return generateGuideSummary(item);
    return "";
  }

  function normalizePills(pills) {
    const seen = new Set();
    const out = [];
    for (const p of pills) {
      if (!p) continue;
      const s = String(p).trim().replace(/\s+/g, " ");
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  function splitPills(pills) {
    const pricePills = [];
    const otherPills = [];
    for (const p of pills) {
      if (p.startsWith("£")) {
        pricePills.push(p);
      } else {
        otherPills.push(p);
      }
    }
    return { pricePills, otherPills };
  }

  function renderPillSpans(pills, className) {
    return pills.map(p => `<span class="ar-pill${className}">${esc(p)}</span>`).join("");
  }

  function renderPills(pills, maxCount = 4) {
    const normalized = normalizePills(pills);
    const { pricePills, otherPills } = splitPills(normalized);
    const slotsForOthers = pricePills.length ? maxCount - 1 : maxCount;
    const toShow = otherPills.slice(0, slotsForOthers);
    const remaining = otherPills.length - slotsForOthers;
    let html = renderPillSpans(toShow, "");
    html += renderPillSpans(pricePills, " price");
    if (remaining > 0) {
      html += `<span class="ar-pill">+${remaining}</span>`;
    }
    return html;
  }

  function getPageUrl(item) {
    return item.page_url || item.event_url || item.href || item.url || "";
  }

  function renderThumb(item, type, title) {
    const resolvedUrl = pickImage(item);
    const dataSrc = resolvedUrl || PLACEHOLDER_IMAGE;
    const pageUrl = getPageUrl(item);
    return (
      '<div class="ar-thumb">' +
        '<img class="ar-thumb-img" data-src="' + esc(dataSrc) + '"' +
        ' data-page-url="' + esc(pageUrl) + '"' +
        ' alt="' + esc(title) + '"' +
        ' loading="lazy" decoding="async">' +
      "</div>"
    );
  }

  function initThumbImages(rootEl) {
    const imgs = rootEl.querySelectorAll(".ar-thumb-img");
    imgs.forEach((img) => {
      const dataSrc = (img.getAttribute("data-src") || "").trim();
      const resolvedUrl = dataSrc && dataSrc !== "null" && dataSrc !== "undefined"
        ? dataSrc
        : PLACEHOLDER_IMAGE;
      if (IMAGE_REFERRER_POLICY) {
        img.referrerPolicy = IMAGE_REFERRER_POLICY;
      }
      img.onerror = () => {
        img.onerror = null;
        img.src = PLACEHOLDER_IMAGE;
      };
      img.src = resolvedUrl;
    });
  }

  function getPriceLabel(item) {
    if (item.price_gbp) return `£${item.price_gbp}`;
    if (item.price) return `£${item.price}`;
    return "";
  }

  function buildSubtitle(item, kind) {
    const parts = [];
    const dr = fmtDateRange(item);
    const loc = getText(item.location || item.event_location || item.location_name || "");
    const price = getPriceLabel(item);
    if (dr) parts.push(dr);
    if (loc) parts.push(loc);
    if (price && kind === "event") parts.push(price);
    return parts.join(" · ");
  }

  function collectEventPills(item) {
    const candidates = ["event"];
    const loc = getText(item.location || item.event_location || item.location_name || "");
    if (loc) candidates.push(loc);
    const price = getPriceLabel(item);
    if (price) candidates.push(price);
    if (item.participants) candidates.push(`${item.participants} people`);
    if (item.fitness_level) candidates.push(item.fitness_level);
    if (item.experience_level) candidates.push(item.experience_level);
    return candidates;
  }

  function collectGuidePills(item, kind) {
    const kindLabel = kind === "service" ? "service" : "guide";
    const candidates = [kindLabel];
    (item.tags || []).forEach(t => candidates.push(t));
    (item.categories || []).forEach(c => candidates.push(c));
    return candidates;
  }

  function collectPillCandidates(item, kind) {
    return kind === "event" ? collectEventPills(item) : collectGuidePills(item, kind);
  }

  function buildActions(item, kind, href) {
    const actions = [];
    actions.push(`<a class="ar-btn more" href="${esc(href)}">More info →</a>`);
    if (kind === "event" && item.product_url) {
      actions.push(`<a class="ar-btn book" href="${esc(item.product_url)}">Book now</a>`);
    }
    return actions;
  }

  function getCardTitle(item) {
    return item.title || item.event_title || item.product_title || "Untitled";
  }

  function getCardHref(item) {
    return item.href || item.page_url || item.event_url || "#";
  }

  function resolveDescription(item, kind) {
    const desc = pickDescription(item, kind);
    const showDesc = kind === "event" ? true : Boolean(desc);
    return { desc, showDesc };
  }

  function buildCardHtml(card) {
    return (
      '<div class="ar-card">' +
        card.thumb +
        '<div class="ar-body">' +
          '<div class="ar-title">' + esc(card.title) + "</div>" +
          (card.subtitle ? '<div class="ar-sub">' + esc(card.subtitle) + "</div>" : "") +
          (card.showDesc ? '<div class="ar-desc">' + esc(card.desc) + "</div>" : "") +
          (card.pillsHtml ? '<div class="ar-pills">' + card.pillsHtml + "</div>" : "") +
          (card.actions.length ? '<div class="ar-actions">' + card.actions.join("") + "</div>" : "") +
        "</div>" +
      "</div>"
    );
  }

  function renderCard(item, kind) {
    const title = getCardTitle(item);
    const href = getCardHref(item);
    const thumb = renderThumb(item, kind, title);
    const subtitle = buildSubtitle(item, kind);
    const { desc, showDesc } = resolveDescription(item, kind);
    const pillsHtml = renderPills(collectPillCandidates(item, kind), 4);
    const actions = buildActions(item, kind, href);
    return buildCardHtml({
      title,
      subtitle,
      desc,
      showDesc,
      pillsHtml,
      actions,
      thumb
    });
  }

  function renderSection(config) {
    const arr = dedupe(config.items || [], config.keyFn);
    const count = arr.length;
    let html = '<div class="ar-ss-section">';
    html += '<div class="ar-ss-section-head"><h3>' + esc(config.label) + "</h3>" +
      '<div class="ar-ss-count">' + count + " matches</div></div>";
    if (!count) {
      html += '<div class="ar-empty">No matches.</div></div>';
      return html;
    }
    html += '<div class="ar-ss-grid">';
    for (const item of arr) {
      html += renderCard(item, config.kind);
    }
    html += "</div></div>";
    return html;
  }

  function dedupe(arr, keyFn) {
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      const k = keyFn(x);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  function ensureRootMarkup(rootEl) {
    if (rootEl.children.length > 0) return;
    rootEl.innerHTML = "" +
      '<div class="ar-ss-wrap">' +
        '<div class="ar-ss-searchcard">' +
          '<div class="ar-ss-row">' +
            '<input class="ar-ss-input" type="text" inputmode="search" placeholder="Search workshops, guides, services, landing pages…" />' +
            '<button class="ar-ss-btn" type="button">Search</button>' +
          "</div>" +
          '<div class="ar-ss-meta">' +
            '<div class="ar-ss-chip">' +
              '<span class="ar-ss-dot"></span>' +
              '<span class="ar-ss-status-text">Type a query and press Enter.</span>' +
            "</div>" +
            '<div class="ar-ss-chip ar-ss-chip-muted ar-ss-confidence">Confidence: —</div>' +
          "</div>" +
        "</div>" +
        '<div class="ar-ss-results"></div>' +
      "</div>";
  }

  function createElements(containerEl) {
    ensureRootMarkup(containerEl);
    return {
      rootEl: containerEl,
      input: containerEl.querySelector(".ar-ss-input"),
      button: containerEl.querySelector(".ar-ss-btn"),
      results: containerEl.querySelector(".ar-ss-results"),
      statusText: containerEl.querySelector(".ar-ss-status-text"),
      confidence: containerEl.querySelector(".ar-ss-confidence")
    };
  }

  function setStatus(elements, msg) {
    elements.statusText.textContent = msg;
  }

  function setConfidence(elements, val) {
    if (typeof val === "number" && Number.isFinite(val)) {
      const pct = Math.round(val * 100);
      elements.confidence.textContent = `Confidence: ${pct}%`;
    } else {
      elements.confidence.textContent = "Confidence: —";
    }
  }

  function resetResults(elements, msg) {
    setStatus(elements, msg);
    setConfidence(elements, null);
    elements.results.innerHTML = "";
  }

  function updateUrl(query, settings) {
    if (!settings.updateUrl) return;
    const url = new URL(window.location.href);
    url.searchParams.set("q", query);
    window.history.replaceState({}, "", url.toString());
  }

  async function fetchResults(query) {
    const r = await fetch(`${ENDPOINT}?q=${encodeURIComponent(query)}&limit=24`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    return r.json();
  }

  function isValidResponse(data) {
    return data && data.ok === true;
  }

  function renderAll(elements, structured) {
    const events = structured && structured.events ? structured.events : [];
    const services = structured && structured.services ? structured.services : [];
    const articles = structured && structured.articles ? structured.articles : [];
    let html = "";
    html += renderSection({
      label: "Workshops",
      items: events,
      kind: "event",
      keyFn: (e) => ((e.event_url || e.page_url || e.href || "") + "|" + (e.date_start || e.date || ""))
    });
    html += renderSection({
      label: "Services",
      items: services,
      kind: "service",
      keyFn: (s) => (s.page_url || s.href || "")
    });
    html += renderSection({
      label: "Guides",
      items: articles,
      kind: "guide",
      keyFn: (a) => (a.page_url || a.href || "")
    });
    elements.results.innerHTML = html;
    initThumbImages(elements.rootEl);
  }

  function normalizeQuery(query) {
    return (query || "").trim();
  }

  function setInputValue(elements, query) {
    elements.input.value = query;
  }

  async function runSearch(state, query) {
    const q = normalizeQuery(query);
    if (!q) {
      resetResults(state.elements, "Type a query and press Enter.");
      return;
    }

    setInputValue(state.elements, q);
    setStatus(state.elements, `Searching for "${q}"…`);
    setConfidence(state.elements, null);
    updateUrl(q, state.settings);

    try {
      const data = await fetchResults(q);
      if (!isValidResponse(data)) {
        resetResults(state.elements, "Search failed. Please try again.");
        return;
      }
      setStatus(state.elements, `Results for "${q}"`);
      setConfidence(state.elements, data.confidence);
      renderAll(state.elements, data.structured || {});
    } catch (error) {
      void error;
      resetResults(state.elements, "Search failed. Please try again.");
    }
  }

  function bindHandlers(state) {
    const elements = state.elements;
    const handleSubmit = () => runSearch(state, elements.input.value);
    elements.button.addEventListener("click", handleSubmit);
    elements.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSubmit();
    });
    if (state.settings.autoFocus) {
      elements.input.focus();
    }
  }

  function createInstance(containerEl, settings) {
    const elements = createElements(containerEl);
    return {
      containerEl: elements.rootEl,
      runSearch: (query) => runSearch({ elements, settings }, query),
      bind: () => bindHandlers({ elements, settings }),
      setQuery: (query) => setInputValue(elements, query || ""),
      getQuery: () => elements.input.value || ""
    };
  }

  function resolveUpdateUrl(containerEl, opts) {
    if (typeof opts.updateUrl === "boolean") return opts.updateUrl;
    const pageRoot = document.getElementById("ar-site-search");
    return containerEl === pageRoot;
  }

  function mount(containerEl, opts = {}) {
    if (!containerEl) return null;
    ensureCssLoaded();
    const settings = {
      initialQuery: opts.initialQuery || "",
      autoSearch: Boolean(opts.autoSearch),
      autoFocus: Boolean(opts.autoFocus),
      updateUrl: resolveUpdateUrl(containerEl, opts)
    };
    let instance = instances.get(containerEl);
    if (!instance) {
      instance = createInstance(containerEl, settings);
      instances.set(containerEl, instance);
      instance.bind();
    }
    lastInstance = instance;
    if (settings.initialQuery) {
      instance.setQuery(settings.initialQuery);
      if (settings.autoSearch) {
        instance.runSearch(settings.initialQuery);
      }
    }
    return instance;
  }

  function unmount(containerEl) {
    const instance = instances.get(containerEl);
    if (!instance) return;
    instances.delete(containerEl);
    if (containerEl) {
      containerEl.innerHTML = "";
    }
    if (lastInstance === instance) {
      lastInstance = null;
    }
  }

  function setQuery(query) {
    if (!lastInstance) return;
    lastInstance.setQuery(query);
  }

  function run() {
    if (!lastInstance) return;
    lastInstance.runSearch(lastInstance.getQuery());
  }

  window.ARSiteSearch = { mount, unmount, setQuery, run };
}
(() => {
  if (window.ARSiteSearch) return;

  const API_BASE = "https://alan-chat-proxy.vercel.app";
  const ENDPOINT = `${API_BASE}/api/search/query`;
  const PLACEHOLDER_IMAGE = "https://www.alanranger.com/s/default-image.jpg";
  const IMAGE_REFERRER_POLICY = "";

  const instances = new Map();
  let lastInstance = null;

  function ensureCssLoaded() {
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some(link => (link.getAttribute("href") || "").includes("/ar-site-search.css"));
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/ar-site-search.css";
    document.head.appendChild(link);
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDateRange(item) {
    const ds = item.date_start || item.date || "";
    const de = item.date_end || "";
    if (item.when) return item.when;
    if (ds && de && ds !== de) return `${ds} – ${de}`;
    return ds || "";
  }

  function pickImage(item) {
    const url = item.image_url;
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return "";
    return trimmed.startsWith("http://") ? `https://${trimmed.substring(7)}` : trimmed;
  }

  function pickDescription(item, type) {
    if (item.excerpt && typeof item.excerpt === "string") {
      const trimmed = item.excerpt.trim();
      if (trimmed) return trimmed;
    }
    if (item.meta_description && typeof item.meta_description === "string") {
      const trimmed = item.meta_description.trim();
      if (trimmed) return trimmed;
    }
    if (item.description && typeof item.description === "string") {
      const trimmed = item.description.trim();
      if (trimmed) return trimmed;
    }
    return generateSummaryFallback(item, type);
  }

  function generateSummaryFallback(item, type) {
    if (type === "event") return generateEventSummary(item);
    if (type === "guide" || type === "service") return generateGuideSummary(item);
    return "";
  }

  function generateEventSummary(item) {
    const parts = [];
    const loc = item.location || item.event_location || item.location_name || "";
    const dr = fmtDateRange(item);
    const exp = item.experience_level || "";
    if (loc) parts.push(loc);
    if (dr) parts.push(dr);
    if (exp) parts.push(exp);
    return parts.length > 0 ? `Workshop in ${parts.join(" • ")}` : "";
  }

  function generateGuideSummary(item) {
    const tags = (item.tags || []).concat(item.categories || []);
    return tags.length > 0 ? `Guide covering ${tags.slice(0, 3).join(", ")}` : "";
  }

  function normalizePills(pills) {
    const seen = new Set();
    const out = [];
    for (const p of pills) {
      if (!p) continue;
      const s = String(p).trim().replace(/\s+/g, " ");
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  function renderPills(pills, maxCount = 4) {
    const normalized = normalizePills(pills);
    const pricePills = [];
    const otherPills = [];
    for (const p of normalized) {
      if (/^£/.test(p)) {
        pricePills.push(p);
      } else {
        otherPills.push(p);
      }
    }

    const slotsForOthers = pricePills.length > 0 ? maxCount - 1 : maxCount;
    const toShow = otherPills.slice(0, slotsForOthers);
    const remaining = otherPills.length - slotsForOthers;

    let html = "";
    for (const p of toShow) {
      html += `<span class="ar-pill">${esc(p)}</span>`;
    }
    for (const p of pricePills) {
      html += `<span class="ar-pill price">${esc(p)}</span>`;
    }
    if (remaining > 0) {
      html += `<span class="ar-pill">+${remaining}</span>`;
    }
    return html;
  }

  function renderThumb(item, type, title) {
    const resolvedUrl = pickImage(item);
    const safeUrl = resolvedUrl && resolvedUrl.startsWith("http://")
      ? `https://${resolvedUrl.substring(7)}`
      : resolvedUrl;

    const dataSrc = safeUrl && safeUrl.trim() ? safeUrl : PLACEHOLDER_IMAGE;
    const pageUrl = item.page_url || item.event_url || item.href || item.url || "";
    return (
      '<div class="ar-thumb">' +
        '<img class="ar-thumb-img" data-src="' + esc(dataSrc) + '"' +
        ' data-page-url="' + esc(pageUrl) + '"' +
        ' alt="' + esc(title) + '"' +
        ' loading="lazy" decoding="async">' +
      "</div>"
    );
  }

  function initThumbImages(rootEl) {
    const imgs = rootEl.querySelectorAll(".ar-thumb-img");
    imgs.forEach((img) => {
      const dataSrc = (img.getAttribute("data-src") || "").trim();
      const resolvedUrl = dataSrc && dataSrc !== "null" && dataSrc !== "undefined"
        ? dataSrc
        : PLACEHOLDER_IMAGE;

      if (IMAGE_REFERRER_POLICY) {
        img.referrerPolicy = IMAGE_REFERRER_POLICY;
      }

      img.onerror = () => {
        img.onerror = null;
        img.src = PLACEHOLDER_IMAGE;
      };

      img.src = resolvedUrl;
    });
  }

  function buildSubtitle(item, kind) {
    const subBits = [];
    const dr = fmtDateRange(item);
    const loc = item.location || item.event_location || item.location_name || "";
    const price = item.price_gbp ? `£${item.price_gbp}` : (item.price ? `£${item.price}` : "");
    if (dr) subBits.push(dr);
    if (loc) subBits.push(loc);
    if (price && kind === "event") subBits.push(price);
    return subBits.join(" · ");
  }

  function collectPillCandidates(item, kind) {
    const candidates = [];
    if (kind === "event") {
      candidates.push("event");
      const loc = item.location || item.event_location || item.location_name || "";
      if (loc) candidates.push(loc);
      const price = item.price_gbp ? `£${item.price_gbp}` : (item.price ? `£${item.price}` : "");
      if (price) candidates.push(price);
      if (item.participants) candidates.push(`${item.participants} people`);
      if (item.fitness_level) candidates.push(item.fitness_level);
      if (item.experience_level) candidates.push(item.experience_level);
    } else {
      const kindLabel = kind === "service" ? "service" : "guide";
      candidates.push(kindLabel);
      (item.tags || []).forEach(t => candidates.push(t));
      (item.categories || []).forEach(c => candidates.push(c));
    }
    return candidates;
  }

  function buildActions(item, kind, href) {
    const actions = [];
    actions.push(`<a class="ar-btn more" href="${esc(href)}">More info →</a>`);
    if (kind === "event" && item.product_url) {
      actions.push(`<a class="ar-btn book" href="${esc(item.product_url)}">Book now</a>`);
    }
    return actions;
  }

  function renderCard(item, kind) {
    const title = item.title || item.event_title || item.product_title || "Untitled";
    const href = item.href || item.page_url || item.event_url || "#";
    const thumb = renderThumb(item, kind, title);
    const subtitle = buildSubtitle(item, kind);
    let desc = item.excerpt;
    if (!desc || typeof desc !== "string" || desc.trim() === "") {
      desc = item.meta_description;
    }
    if (!desc || typeof desc !== "string" || desc.trim() === "") {
      desc = item.description;
    }
    if (!desc || typeof desc !== "string" || desc.trim() === "") {
      desc = pickDescription(item, kind);
    }
    const showDesc = kind === "event" ? true : (desc && desc.trim().length > 0);
    const pillsHtml = renderPills(collectPillCandidates(item, kind), 4);
    const actions = buildActions(item, kind, href);
    return (
      '<div class="ar-card">' +
        thumb +
        '<div class="ar-body">' +
          '<div class="ar-title">' + esc(title) + "</div>" +
          (subtitle ? '<div class="ar-sub">' + esc(subtitle) + "</div>" : "") +
          (showDesc ? '<div class="ar-desc">' + esc(desc) + "</div>" : "") +
          (pillsHtml ? '<div class="ar-pills">' + pillsHtml + "</div>" : "") +
          (actions.length ? '<div class="ar-actions">' + actions.join("") + "</div>" : "") +
        "</div>" +
      "</div>"
    );
  }

  function renderSection(label, items, kind, keyFn) {
    const arr = dedupe(items || [], keyFn);
    const count = arr.length;
    let html = '<div class="ar-ss-section">';
    html += '<div class="ar-ss-section-head"><h3>' + esc(label) + "</h3>" +
      '<div class="ar-ss-count">' + count + " matches</div></div>";
    if (!count) {
      html += '<div class="ar-empty">No matches.</div></div>';
      return html;
    }
    html += '<div class="ar-ss-grid">';
    for (const item of arr) {
      html += renderCard(item, kind);
    }
    html += "</div></div>";
    return html;
  }

  function dedupe(arr, keyFn) {
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      const k = keyFn(x);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  function ensureRootMarkup(rootEl) {
    if (rootEl.children.length > 0) return;
    rootEl.innerHTML = "" +
      '<div class="ar-ss-wrap">' +
        '<div class="ar-ss-searchcard">' +
          '<div class="ar-ss-row">' +
            '<input class="ar-ss-input" type="text" inputmode="search" placeholder="Search workshops, guides, services, landing pages…" />' +
            '<button class="ar-ss-btn" type="button">Search</button>' +
          "</div>" +
          '<div class="ar-ss-meta">' +
            '<div class="ar-ss-chip">' +
              '<span class="ar-ss-dot"></span>' +
              '<span class="ar-ss-status-text">Type a query and press Enter.</span>' +
            "</div>" +
            '<div class="ar-ss-chip ar-ss-chip-muted ar-ss-confidence">Confidence: —</div>' +
          "</div>" +
        "</div>" +
        '<div class="ar-ss-results"></div>' +
      "</div>";
  }

  function createInstance(containerEl, opts) {
    ensureRootMarkup(containerEl);
    const rootEl = containerEl;
    const $q = rootEl.querySelector(".ar-ss-input");
    const $btn = rootEl.querySelector(".ar-ss-btn");
    const $results = rootEl.querySelector(".ar-ss-results");
    const $statusText = rootEl.querySelector(".ar-ss-status-text");
    const $confidence = rootEl.querySelector(".ar-ss-confidence");
    const settings = opts || {};

    function setStatus(msg) {
      $statusText.textContent = msg;
    }

    function setConfidence(val) {
      if (typeof val === "number" && Number.isFinite(val)) {
        const pct = Math.round(val * 100);
        $confidence.textContent = `Confidence: ${pct}%`;
      } else {
        $confidence.textContent = "Confidence: —";
      }
    }

    function updateUrl(query) {
      if (!settings.updateUrl) return;
      const url = new URL(window.location.href);
      url.searchParams.set("q", query);
      window.history.replaceState({}, "", url.toString());
    }

    function renderAll(structured) {
      const events = structured && structured.events ? structured.events : [];
      const services = structured && structured.services ? structured.services : [];
      const articles = structured && structured.articles ? structured.articles : [];
      let html = "";
      html += renderSection(
        "Workshops",
        events,
        "event",
        (e) => ((e.event_url || e.page_url || e.href || "") + "|" + (e.date_start || e.date || ""))
      );
      html += renderSection(
        "Services",
        services,
        "service",
        (s) => (s.page_url || s.href || "")
      );
      html += renderSection(
        "Guides",
        articles,
        "guide",
        (a) => (a.page_url || a.href || "")
      );
      $results.innerHTML = html;
      initThumbImages(rootEl);
    }

    async function runSearch(query) {
      const q = (query || "").trim();
      if (!q) {
        setStatus("Type a query and press Enter.");
        setConfidence(null);
        $results.innerHTML = "";
        return;
      }

      $q.value = q;
      setStatus(`Searching for "${q}"…`);
      setConfidence(null);
      updateUrl(q);

      try {
        const r = await fetch(`${ENDPOINT}?q=${encodeURIComponent(q)}&limit=24`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });
        const data = await r.json();
        if (!data || data.ok !== true) {
          setStatus("Search failed. Please try again.");
          setConfidence(null);
          $results.innerHTML = "";
          return;
        }
        setStatus(`Results for "${q}"`);
        setConfidence(data.confidence);
        renderAll(data.structured || {});
      } catch (_err) {
        setStatus("Search failed. Please try again.");
        setConfidence(null);
        $results.innerHTML = "";
      }
    }

    function onSubmit() {
      runSearch($q.value);
    }

    function bind() {
      $btn.addEventListener("click", onSubmit);
      $q.addEventListener("keydown", (e) => {
        if (e.key === "Enter") onSubmit();
      });
      if (settings.autoFocus) {
        $q.focus();
      }
    }

    return {
      containerEl: rootEl,
      runSearch,
      bind,
      setQuery: (q) => { $q.value = q || ""; },
      getQuery: () => $q.value || ""
    };
  }

  function resolveUpdateUrl(containerEl, opts) {
    if (typeof opts.updateUrl === "boolean") return opts.updateUrl;
    const pageRoot = document.getElementById("ar-site-search");
    return containerEl === pageRoot;
  }

  function mount(containerEl, opts = {}) {
    if (!containerEl) return null;
    ensureCssLoaded();
    const settings = {
      initialQuery: opts.initialQuery || "",
      autoSearch: Boolean(opts.autoSearch),
      autoFocus: Boolean(opts.autoFocus),
      updateUrl: resolveUpdateUrl(containerEl, opts)
    };
    let instance = instances.get(containerEl);
    if (!instance) {
      instance = createInstance(containerEl, settings);
      instances.set(containerEl, instance);
      instance.bind();
    }
    lastInstance = instance;
    if (settings.initialQuery) {
      instance.setQuery(settings.initialQuery);
      if (settings.autoSearch) {
        instance.runSearch(settings.initialQuery);
      }
    }
    return instance;
  }

  function unmount(containerEl) {
    const instance = instances.get(containerEl);
    if (!instance) return;
    instances.delete(containerEl);
    if (containerEl) {
      containerEl.innerHTML = "";
    }
    if (lastInstance === instance) {
      lastInstance = null;
    }
  }

  function setQuery(q) {
    if (!lastInstance) return;
    lastInstance.setQuery(q);
  }

  function run() {
    if (!lastInstance) return;
    lastInstance.runSearch(lastInstance.getQuery());
  }

  window.ARSiteSearch = { mount, unmount, setQuery, run };
})();
