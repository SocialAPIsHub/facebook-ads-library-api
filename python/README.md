# facebook-ads-library-api (Python)

Search the **Meta Ads Library** (every ad running on Facebook, Instagram, Messenger and WhatsApp) from Python: by keyword or advertiser, page through results, export to CSV. Includes the `facebook-ads-library` command.

No Meta developer app, no access-token review, commercial ads in every country. The data comes from the [SocialAPIs](https://socialapis.io) REST API: **[get a free API key](https://socialapis.io/auth/signup)** (200 calls/month, no card).

```bash
pip install facebook-ads-library-api
export SOCIALAPIS_TOKEN=your_key
```

```python
from facebook_ads_library_api import AdsLibrary

lib = AdsLibrary()  # or AdsLibrary(api_token="...")

# Ads about a topic (each page = 1 call)
for ad in lib.search("running shoes", country="US", pages=2):
    print(ad["ad_archive_id"], ad.get("page_name"))

# Every ad of one advertiser: ad_page_id, Page URL or username
ads = list(lib.advertiser_ads("nike", active_status="ALL"))

# Flat rows: ad_archive_id, advertiser, headline, text, cta, platforms,
# start_date, landing_domain, ads_library_url
import pandas as pd
df = pd.DataFrame(AdsLibrary.rows(ads))
```

Other methods: `find_advertisers(name)`, `resolve_ad_page_id(page)`, `ad_details(ad_archive_id)`, `page_details(page_id)`, `countries()`, `search_pages(...)` (raw answers).

Options: `country` (two-letter code or `ALL`; default `US` for a keyword, `ALL` for an advertiser), `active_status` (`Active`, `Inactive`, `ALL`), `sort` (`impressions`, `recent`), `after` / `before` (YYYY-MM-DD), `pages` (default 1).

## Command line

```bash
facebook-ads-library search "running shoes" --country US --pages 2 --out ads.csv
facebook-ads-library advertiser nike --status ALL --format jsonl
facebook-ads-library ad 1234567890123456
facebook-ads-library countries
```

## Costs

1 credit per API call; a search makes at most `pages` calls. Failed calls (4xx / 5xx) are not charged. [Pricing](https://socialapis.io/pricing). Errors raise the `socialapis` exceptions (`AuthenticationError`, `InsufficientCreditsError`, `RateLimitError`, …).

## Links

- [Endpoint reference](https://socialapis.io/api-sources/meta-ads-search) · [Guide](https://socialapis.io/blog/facebook-ads-library-api) · [Free Facebook ad checker](https://socialapis.io/tools/facebook-ad-checker)
- Node.js version and source: [github.com/SocialAPIsHub/facebook-ads-library-api](https://github.com/SocialAPIsHub/facebook-ads-library-api)
- Full SDK (pages, posts, groups, Marketplace, Instagram): [`socialapis-sdk`](https://pypi.org/project/socialapis-sdk/)

You are responsible for how you use public ad data, including personal data rules (GDPR) where they apply. MIT license.
