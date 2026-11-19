# Facebook Ads Library API (Python + Node.js)

[![PyPI](https://img.shields.io/pypi/v/facebook-ads-library-api?label=PyPI&logo=pypi&logoColor=white)](https://pypi.org/project/facebook-ads-library-api/)
[![npm](https://img.shields.io/npm/v/facebook-ads-library-api?label=npm&logo=npm)](https://www.npmjs.com/package/facebook-ads-library-api)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Search the **Meta Ads Library** (every ad running on Facebook, Instagram, Messenger and WhatsApp) from Python or Node.js: by keyword or by advertiser, page through results, export to CSV. Includes a command-line tool.

- No Meta developer app, no access-token review, no identity verification
- Commercial ads in every country, not only political / EU ads
- One ad per creative group, with headline, text, call to action, platforms, start date and landing domain

The data comes from the [SocialAPIs](https://socialapis.io) REST API. **[Get a free API key](https://socialapis.io/auth/signup)**: 200 calls/month, no card.

| Language | Package | Folder |
|---|---|---|
| Python ≥ 3.10 | `pip install facebook-ads-library-api` | [`python/`](python/) |
| Node.js ≥ 18 | `npm install facebook-ads-library-api` | [`js/`](js/) |

## Python

```python
from facebook_ads_library_api import AdsLibrary

lib = AdsLibrary()  # reads SOCIALAPIS_TOKEN, or AdsLibrary(api_token="...")

# Ads about a topic in one country (2 pages = 2 calls)
for ad in lib.search("running shoes", country="US", pages=2):
    print(ad["ad_archive_id"], ad.get("page_name"))

# Every active ad of one advertiser: numeric ad_page_id, Page URL or username
ads = list(lib.advertiser_ads("nike", active_status="Active"))

# Flat rows for CSV / pandas
import pandas as pd
df = pd.DataFrame(AdsLibrary.rows(ads))
```

## Node.js

```js
import { AdsLibrary, toCsv } from "facebook-ads-library-api";

const lib = new AdsLibrary(); // reads SOCIALAPIS_TOKEN, or new AdsLibrary({ apiToken: "..." })

const ads = [];
for await (const ad of lib.search("running shoes", { country: "US", pages: 2 })) ads.push(ad);

console.log(toCsv(AdsLibrary.rows(ads)));
```

## Command line

```bash
export SOCIALAPIS_TOKEN=your_key

# Python
facebook-ads-library search "running shoes" --country US --pages 2 --out ads.csv
facebook-ads-library advertiser nike --status ALL --format jsonl

# Node.js
npx facebook-ads-library-api search "running shoes" --country US --out ads.csv
npx facebook-ads-library-api ad 1234567890123456
```

CSV columns: `ad_archive_id, advertiser, headline, text, cta, platforms, start_date, landing_domain, ads_library_url`.

## What you can do

| | Python | Node.js |
|---|---|---|
| Ads by keyword | `search(query, ...)` | `search(query, opts)` |
| Ads of one advertiser | `advertiser_ads(id_or_page, ...)` | `advertiserAds(idOrPage, opts)` |
| Find an advertiser's id by name | `find_advertisers(name)` | `findAdvertisers(name)` |
| Page URL → ad_page_id | `resolve_ad_page_id(page)` | `resolveAdPageId(page)` |
| One ad's details | `ad_details(ad_archive_id)` | `adDetails(adArchiveId)` |
| Advertiser's Ads Library info | `page_details(page_id)` | `pageDetails(pageId)` |
| Supported countries | `countries()` | `countries()` |
| Raw answers, page by page | `search_pages(...)` | `searchPages(...)` |

Options: `country` (two-letter code or `ALL`; default `US` for a keyword, `ALL` for an advertiser), `active_status` / `activeStatus` (`Active`, `Inactive`, `ALL`), `sort` (`impressions`, `recent`), `after` / `before` (YYYY-MM-DD), `pages` (default 1).

## Costs

Each API call is 1 credit, and a search makes at most `pages` calls (it stops early when there are no more results). Calls that fail (4xx / 5xx) are not charged. Plans and credits: [socialapis.io/pricing](https://socialapis.io/pricing).

Want to check a brand without code first? Try the free [Facebook ad checker](https://socialapis.io/tools/facebook-ad-checker).

## More

- Endpoint reference: [Meta Ads search](https://socialapis.io/api-sources/meta-ads-search), [ad details](https://socialapis.io/api-sources/meta-ads-archive-details), [advertiser lookup](https://socialapis.io/api-sources/meta-ads-keywords)
- Guide: [How to use the Facebook Ads Library API](https://socialapis.io/blog/facebook-ads-library-api)
- Full SDKs (pages, posts, groups, Marketplace, Instagram): [Python](https://github.com/SocialAPIsHub/socialapis-python), [JavaScript](https://github.com/SocialAPIsHub/socialapis-js), [Go](https://github.com/SocialAPIsHub/socialapis-go), [PHP](https://github.com/SocialAPIsHub/socialapis-php)
- For AI agents: [SocialAPIs MCP server](https://github.com/SocialAPIsHub/mcp-server)

This package reads public ad data. You are responsible for how you use it, including personal data rules (GDPR) where they apply.

## License

MIT
