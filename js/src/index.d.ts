import type { Facebook } from "socialapis-sdk";

export declare const VERSION: string;
export declare const AD_COLUMNS: readonly [
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

/** One ad as the API returns it (fields vary by ad; extra fields are kept). */
export type Ad = Record<string, any> & { ad_archive_id?: string | number; page_name?: string };

export interface AdRow {
  ad_archive_id: string;
  advertiser: string | null;
  headline: string | null;
  text: string | null;
  cta: string | null;
  platforms: string;
  start_date: string | null;
  landing_domain: string | null;
  ads_library_url: string;
}

export interface SearchOptions {
  /** Two-letter country code or ALL. Default: US for a keyword, ALL for an advertiser. */
  country?: string;
  /** Active (default), Inactive or ALL. */
  activeStatus?: string;
  sort?: "impressions" | "recent";
  /** YYYY-MM-DD */
  after?: string;
  /** YYYY-MM-DD */
  before?: string;
  /** How many pages to fetch (1 API call / 1 credit each). Default 1. */
  pages?: number;
}

export interface AdsLibraryOptions {
  /** Defaults to process.env.SOCIALAPIS_TOKEN. */
  apiToken?: string;
  fetch?: typeof fetch;
  client?: Facebook;
}

export declare class AdsLibrary {
  constructor(opts?: AdsLibraryOptions);
  searchPages(
    opts: SearchOptions & { query?: string; adPageId?: string },
  ): AsyncGenerator<Record<string, any>, void, unknown>;
  search(query: string, options?: SearchOptions): AsyncGenerator<Ad, void, unknown>;
  advertiserAds(advertiser: string, options?: SearchOptions): AsyncGenerator<Ad, void, unknown>;
  resolveAdPageId(page: string): Promise<string>;
  findAdvertisers(query: string, extra?: Record<string, unknown>): Promise<Record<string, any>[]>;
  adDetails(adArchiveId: string, pageId?: string, extra?: Record<string, unknown>): Promise<Record<string, any>>;
  pageDetails(pageId: string): Promise<Record<string, any>>;
  countries(): Promise<Record<string, any>>;
  static rows(ads: Ad[]): AdRow[];
}

export declare function adRow(ad: Ad): AdRow | null;
export declare function adsBlock(body: unknown): { ads: unknown[]; page_info?: Record<string, any> } | null;
export declare function firstAds(body: unknown): Ad[];
export declare function toCsv(rows: AdRow[]): string;
export declare function nextCursor(body: unknown): string | null;
export declare function paginate<T>(
  fetchPage: (cursor: string | null) => Promise<T>,
  pages: number,
): AsyncGenerator<T, void, unknown>;
