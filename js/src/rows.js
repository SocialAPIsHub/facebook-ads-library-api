// Turn Ads Library answers into flat rows (CSV, spreadsheets).
//
// Every field read here was checked against real `/facebook/ads/search`
// answers. `data.ads` is a list of GROUPS of near-identical ads (the same
// creative run in several versions): we keep the first ad of each group.

export const AD_COLUMNS = [
  "ad_archive_id",
  "advertiser",
  "headline",
  "text",
  "cta",
  "platforms",
  "start_date",
  "landing_domain",
  "ads_library_url",
];

const PLATFORMS = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  MESSENGER: "Messenger",
  AUDIENCE_NETWORK: "Audience Network",
  THREADS: "Threads",
  WHATSAPP: "WhatsApp",
};

function text(value, limit = 500) {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > limit ? `${t.slice(0, limit - 1)}…` : t;
}

/** Text without `{{product.name}}`-style catalog placeholders, else null. */
function realText(value, limit = 500) {
  const t = text(value, limit);
  return t && !/\{\{.*?\}\}/.test(t) ? t : null;
}

function isoDate(value) {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n > 1e12 ? n : n * 1000);
  const y = d.getUTCFullYear();
  return y >= 2004 && y <= 2100 ? d.toISOString().slice(0, 10) : null;
}

function host(value) {
  const t = text(value, 2000);
  const m = t && /^https?:\/\/([^/?#:]+)/i.exec(t);
  return m ? m[1].replace(/^www\./i, "").toLowerCase() : null;
}

/** The `{ ads, page_info }` part of a search answer, whatever the wrapping. */
export function adsBlock(body) {
  let node = body;
  for (let i = 0; i < 4; i++) {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node.ads)) return node;
    node = node.data;
  }
  return null;
}

/** One ad per group, in the order the API returned them. */
export function firstAds(body) {
  const block = adsBlock(body);
  if (!block) return [];
  return block.ads
    .map((group) => (Array.isArray(group) ? group[0] : group))
    .filter((ad) => ad && typeof ad === "object" && !Array.isArray(ad));
}

/** One ad → a flat object with the AD_COLUMNS keys (null if it has no id). */
export function adRow(ad) {
  if (!ad || typeof ad !== "object") return null;
  const id = typeof ad.ad_archive_id === "number" ? String(ad.ad_archive_id) : ad.ad_archive_id;
  if (typeof id !== "string" || !/^\d{1,30}$/.test(id)) return null;
  const snap = ad.snapshot && typeof ad.snapshot === "object" ? ad.snapshot : {};
  const card = Array.isArray(snap.cards) && snap.cards[0] && typeof snap.cards[0] === "object" ? snap.cards[0] : {};
  const catalog = ["DPA", "DCO"].includes(String(snap.display_format || "").toUpperCase());
  const bodyText = typeof snap.body === "string" ? snap.body : snap.body && snap.body.text;
  const platforms = [];
  for (const p of Array.isArray(ad.publisher_platform) ? ad.publisher_platform : []) {
    const label = PLATFORMS[String(p).toUpperCase()];
    if (label && !platforms.includes(label)) platforms.push(label);
  }
  return {
    ad_archive_id: id,
    advertiser: text(ad.page_name !== undefined ? ad.page_name : snap.page_name, 200),
    headline: (catalog ? realText(card.title, 200) : null) || realText(snap.title, 200) || realText(card.title, 200),
    text: (catalog ? realText(card.body) : null) || realText(bodyText) || realText(card.body),
    cta: realText(snap.cta_text !== undefined ? snap.cta_text : card.cta_text, 40),
    platforms: platforms.join(", "),
    start_date: isoDate(ad.start_date),
    landing_domain: host(snap.link_url !== undefined ? snap.link_url : card.link_url),
    ads_library_url: `https://www.facebook.com/ads/library/?id=${id}`,
  };
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows (objects with the AD_COLUMNS keys) → CSV text with a header line. */
export function toCsv(rows) {
  const lines = [AD_COLUMNS.join(",")];
  for (const row of rows) lines.push(AD_COLUMNS.map((c) => csvCell(row[c])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
