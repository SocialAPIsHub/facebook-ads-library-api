// Meta (Facebook) Ads Library API client for Node.js.
//
// Search every ad running on Facebook, Instagram, Messenger and WhatsApp by
// keyword or advertiser, page through results, and export them to CSV. No Meta
// developer app, no access token review, no browser: the data comes from
// SocialAPIs (https://socialapis.io).
//
//     import { AdsLibrary } from "facebook-ads-library-api";
//
//     const lib = new AdsLibrary({ apiToken: process.env.SOCIALAPIS_TOKEN });
//     for await (const ad of lib.search("running shoes", { country: "US", pages: 2 })) {
//       console.log(ad.ad_archive_id, ad.page_name);
//     }
//
// Free API key (200 calls/month, no card): https://socialapis.io/auth/signup

import { Facebook } from "socialapis-sdk";
import { paginate } from "./paging.js";
import { adRow, firstAds } from "./rows.js";

export { nextCursor, paginate } from "./paging.js";
export { AD_COLUMNS, adRow, adsBlock, firstAds, toCsv } from "./rows.js";
export const VERSION = "0.1.0";

const STATUSES = { active: "Active", inactive: "Inactive", all: "ALL" };
const SORTS = ["impressions", "recent"];

function countryCode(value) {
  const code = String(value).trim().toUpperCase();
  if (!/^(ALL|[A-Z]{2})$/.test(code)) {
    throw new RangeError(`country must be a two-letter code (US, GB, DE…) or ALL, got "${value}"`);
  }
  return code;
}

function statusOf(value) {
  const status = STATUSES[String(value).trim().toLowerCase()];
  if (!status) throw new RangeError(`activeStatus must be Active, Inactive or ALL, got "${value}"`);
  return status;
}

export class AdsLibrary {
  /**
   * @param {{ apiToken?: string, fetch?: typeof fetch, client?: Facebook }} [opts]
   *   apiToken defaults to process.env.SOCIALAPIS_TOKEN.
   */
  constructor(opts = {}) {
    if (opts.client) {
      this.fb = opts.client;
      return;
    }
    const apiToken = opts.apiToken || (typeof process !== "undefined" ? process.env.SOCIALAPIS_TOKEN : undefined);
    if (!apiToken) {
      throw new Error(
        "Pass { apiToken } or set SOCIALAPIS_TOKEN. Get a free key at https://socialapis.io/auth/signup (200 calls/month, no card).",
      );
    }
    this.fb = new Facebook({ apiToken, fetch: opts.fetch });
  }

  /**
   * Raw search answers, one per page of results (each one is an API call, 1 credit).
   * Give `query` (a keyword) or `adPageId` (an advertiser). `country` defaults to
   * US for a keyword and ALL for an advertiser; `after` / `before` are YYYY-MM-DD.
   */
  async *searchPages({ query, adPageId, country, activeStatus = "Active", sort, after, before, pages = 1 } = {}) {
    if (!query && !adPageId) throw new RangeError("give a keyword (query) or an adPageId");
    if (sort !== undefined && !SORTS.includes(sort)) throw new RangeError(`sort must be one of ${SORTS.join(", ")}`);
    const params = {
      country: countryCode(country || (query ? "US" : "ALL")),
      activeStatus: statusOf(activeStatus),
      sort_data: sort || (query ? "impressions" : undefined),
      after_time: after,
      before_time: before,
    };
    if (!query) params.ad_page_id = String(adPageId);
    const q = query ? String(query).trim() : undefined;
    yield* paginate((cursor) => this.fb.searchAds(q, { ...params, end_cursor: cursor ?? undefined }), pages);
  }

  /** Ads matching a keyword, one per creative group. Options: country, activeStatus, sort, after, before, pages. */
  async *search(query, options = {}) {
    for await (const body of this.searchPages({ ...options, query })) yield* firstAds(body);
  }

  /**
   * All ads of one advertiser. `advertiser` is the numeric ad_page_id, or a
   * Facebook Page URL / username (resolved first with one extra call).
   */
  async *advertiserAds(advertiser, options = {}) {
    let adPageId = String(advertiser).trim();
    if (!/^\d{3,30}$/.test(adPageId)) adPageId = await this.resolveAdPageId(adPageId);
    for await (const body of this.searchPages({ ...options, query: undefined, adPageId })) yield* firstAds(body);
  }

  /** A Facebook Page URL or username → its Ads Library id (1 call). */
  async resolveAdPageId(page) {
    const info = await this.fb.getPageInfo(page);
    const id = info && info.ad_page_id !== undefined && info.ad_page_id !== null ? String(info.ad_page_id) : "";
    if (!/^\d{3,30}$/.test(id)) throw new Error(`no Ads Library id found for "${page}" (the Page may not advertise)`);
    return id;
  }

  /** Advertisers (Pages) matching a name, with their ids (1 call). */
  async findAdvertisers(query, extra) {
    const body = await this.fb.searchAdsByKeywords(query, extra);
    const results = body && body.data && body.data.page_results;
    return Array.isArray(results) ? results.filter((r) => r && typeof r === "object") : [];
  }

  /** Full details of one ad. */
  adDetails(adArchiveId, pageId, extra) {
    return this.fb.getAdArchiveDetails(adArchiveId, pageId, extra);
  }

  /** Ads Library information about an advertiser's Page. */
  pageDetails(pageId) {
    return this.fb.getAdsPageDetails(pageId);
  }

  /** Country codes the Ads Library accepts. */
  countries() {
    return this.fb.getAdsCountries();
  }

  /** Ads → flat objects with the AD_COLUMNS keys (for CSV / spreadsheets). */
  static rows(ads) {
    return ads.map(adRow).filter(Boolean);
  }
}
