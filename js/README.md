# facebook-ads-library-api (Node.js)

Search the **Meta Ads Library** (every ad running on Facebook, Instagram, Messenger and WhatsApp) from Node.js: by keyword or advertiser, page through results, export to CSV. Includes a command-line tool. TypeScript types included.

No Meta developer app, no access-token review, commercial ads in every country. The data comes from the [SocialAPIs](https://socialapis.io) REST API: **[get a free API key](https://socialapis.io/auth/signup)** (200 calls/month, no card).

```bash
npm install facebook-ads-library-api
export SOCIALAPIS_TOKEN=your_key
```

```js
import { AdsLibrary, toCsv } from "facebook-ads-library-api";

const lib = new AdsLibrary(); // or new AdsLibrary({ apiToken: "..." })

// Ads about a topic (each page = 1 call)
for await (const ad of lib.search("running shoes", { country: "US", pages: 2 })) {
  console.log(ad.ad_archive_id, ad.page_name);
}

// Every ad of one advertiser: ad_page_id, Page URL or username
const ads = [];
for await (const ad of lib.advertiserAds("nike", { activeStatus: "ALL" })) ads.push(ad);

// CSV: ad_archive_id, advertiser, headline, text, cta, platforms, start_date, landing_domain, ads_library_url
console.log(toCsv(AdsLibrary.rows(ads)));
```

Other methods: `findAdvertisers(name)`, `resolveAdPageId(page)`, `adDetails(adArchiveId)`, `pageDetails(pageId)`, `countries()`, `searchPages(...)` (raw answers).

Options: `country` (two-letter code or `ALL`; default `US` for a keyword, `ALL` for an advertiser), `activeStatus` (`Active`, `Inactive`, `ALL`), `sort` (`impressions`, `recent`), `after` / `before` (YYYY-MM-DD), `pages` (default 1).

## Command line

```bash
npx facebook-ads-library-api search "running shoes" --country US --pages 2 --out ads.csv
npx facebook-ads-library-api advertiser nike --status ALL --format jsonl
npx facebook-ads-library-api ad 1234567890123456
```

## Costs

1 credit per API call; a search makes at most `pages` calls. Failed calls (4xx / 5xx) are not charged. [Pricing](https://socialapis.io/pricing). Errors are the `socialapis-sdk` error classes (`AuthenticationError`, `InsufficientCreditsError`, `RateLimitError`, …).

## Links

- [Endpoint reference](https://socialapis.io/api-sources/meta-ads-search) · [Guide](https://socialapis.io/blog/facebook-ads-library-api) · [Free Facebook ad checker](https://socialapis.io/tools/facebook-ad-checker)
- Python version and source: [github.com/SocialAPIsHub/facebook-ads-library-api](https://github.com/SocialAPIsHub/facebook-ads-library-api)
- Full SDK (pages, posts, groups, Marketplace, Instagram): [`socialapis-sdk`](https://www.npmjs.com/package/socialapis-sdk)

You are responsible for how you use public ad data, including personal data rules (GDPR) where they apply. MIT license.
