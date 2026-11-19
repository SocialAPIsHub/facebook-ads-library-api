"""Meta (Facebook) Ads Library API client for Python.

Search every ad running on Facebook, Instagram, Messenger and WhatsApp by
keyword or advertiser, page through results, and export them to CSV. No Meta
developer app, no access token review, no browser: the data comes from
SocialAPIs (https://socialapis.io).

Quick start::

    from facebook_ads_library_api import AdsLibrary

    lib = AdsLibrary(api_token="YOUR_API_TOKEN")  # or set SOCIALAPIS_TOKEN
    for ad in lib.search("running shoes", country="US", pages=2):
        print(ad["ad_archive_id"], ad.get("page_name"))

Free API key (200 calls/month, no card): https://socialapis.io/auth/signup
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterator
from typing import Any

from socialapis import Facebook

from ._paging import next_cursor, paginate
from ._rows import AD_COLUMNS, ad_row, ads_block, first_ads

__version__ = "0.1.0"

__all__ = [
    "AD_COLUMNS",
    "AdsLibrary",
    "__version__",
    "ad_row",
    "ads_block",
    "first_ads",
    "next_cursor",
]

_AD_PAGE_ID = re.compile(r"^\d{3,30}$")
_STATUSES = {"active": "Active", "inactive": "Inactive", "all": "ALL"}
_SORTS = ("impressions", "recent")


def _country(value: str) -> str:
    code = value.strip().upper()
    if not re.match(r"^(ALL|[A-Z]{2})$", code):
        raise ValueError(f"country must be a two-letter code (US, GB, DE…) or ALL, got {value!r}")
    return code


def _status(value: str) -> str:
    status = _STATUSES.get(value.strip().lower())
    if not status:
        raise ValueError(f"active_status must be Active, Inactive or ALL, got {value!r}")
    return status


class AdsLibrary:
    """Meta Ads Library client.

    Every method is one or more API calls; each call costs 1 credit
    (``pages`` caps how many calls a search makes). Errors are not charged.
    """

    def __init__(self, api_token: str | None = None, *, client: Facebook | None = None) -> None:
        if client is None:
            token = api_token or os.environ.get("SOCIALAPIS_TOKEN")
            if not token:
                raise ValueError(
                    "Pass api_token=... or set SOCIALAPIS_TOKEN. Get a free key at "
                    "https://socialapis.io/auth/signup (200 calls/month, no card)."
                )
            client = Facebook(api_token=token)
        self._fb = client

    def __enter__(self) -> AdsLibrary:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        self._fb.close()

    # ---- search ------------------------------------------------------------

    def search_pages(
        self,
        query: str | None = None,
        *,
        ad_page_id: str | None = None,
        country: str | None = None,
        active_status: str = "Active",
        sort: str | None = None,
        after: str | None = None,
        before: str | None = None,
        pages: int = 1,
    ) -> Iterator[dict[str, Any]]:
        """Raw search answers, one per page of results (each one is an API call).

        Give a keyword (``query``) or an advertiser's ``ad_page_id``.
        ``country`` defaults to US for a keyword and ALL for an advertiser.
        ``after`` / ``before`` are dates (YYYY-MM-DD).
        """
        if not query and not ad_page_id:
            raise ValueError("give a keyword (query) or an ad_page_id")
        if sort is not None and sort not in _SORTS:
            raise ValueError(f"sort must be one of {_SORTS}, got {sort!r}")
        params: dict[str, Any] = {
            "country": _country(country or ("US" if query else "ALL")),
            "activeStatus": _status(active_status),
            "sort_data": sort or ("impressions" if query else None),
            "after_time": after,
            "before_time": before,
        }
        if query:
            params["query"] = query.strip()
        else:
            params["ad_page_id"] = str(ad_page_id)

        def fetch(cursor: str | None) -> dict[str, Any]:
            extra = {k: v for k, v in params.items() if k != "query"}
            return self._fb.search_ads(params.get("query"), end_cursor=cursor, **extra)  # type: ignore[arg-type]

        return paginate(fetch, pages)

    def search(self, query: str, **options: Any) -> Iterator[dict[str, Any]]:
        """Ads matching a keyword, one per creative group, across ``pages`` calls.

        Options: ``country``, ``active_status``, ``sort`` (impressions / recent),
        ``after``, ``before``, ``pages`` (default 1).
        """
        for body in self.search_pages(query, **options):
            yield from first_ads(body)

    def advertiser_ads(self, advertiser: str, **options: Any) -> Iterator[dict[str, Any]]:
        """All ads of one advertiser.

        ``advertiser`` is the numeric ad_page_id, or a Facebook Page URL /
        username (resolved first with one extra call to Page details).
        """
        ad_page_id = advertiser.strip()
        if not _AD_PAGE_ID.match(ad_page_id):
            ad_page_id = self.resolve_ad_page_id(ad_page_id)
        for body in self.search_pages(ad_page_id=ad_page_id, **options):
            yield from first_ads(body)

    def resolve_ad_page_id(self, page: str) -> str:
        """A Facebook Page URL or username → its Ads Library id (1 call)."""
        info = self._fb.get_page_info(page)
        value = info.ad_page_id
        ad_page_id = str(value) if value is not None else ""
        if not _AD_PAGE_ID.match(ad_page_id):
            raise LookupError(f"no Ads Library id found for {page!r} (the Page may not advertise)")
        return ad_page_id

    def find_advertisers(self, query: str, **options: Any) -> list[dict[str, Any]]:
        """Advertisers (Pages) matching a name, with their ids (1 call)."""
        body = self._fb.search_ads_by_keywords(query, **options)
        data = body.get("data") if isinstance(body, dict) else None
        results = data.get("page_results") if isinstance(data, dict) else None
        return [r for r in results if isinstance(r, dict)] if isinstance(results, list) else []

    # ---- single records ----------------------------------------------------

    def ad_details(self, ad_archive_id: str, page_id: str | None = None, **options: Any) -> dict[str, Any]:
        """Full details of one ad: creative, dates, reach where Meta publishes it."""
        return self._fb.get_ad_archive_details(ad_archive_id, page_id, **options)  # type: ignore[arg-type]

    def page_details(self, page_id: str) -> dict[str, Any]:
        """Ads Library information about an advertiser's Page."""
        return self._fb.get_ads_page_details(page_id)

    def countries(self) -> dict[str, Any]:
        """Country codes the Ads Library accepts."""
        return self._fb.get_ads_countries()

    # ---- export ------------------------------------------------------------

    @staticmethod
    def rows(ads: Iterator[dict[str, Any]] | list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Ads → flat dicts with the :data:`AD_COLUMNS` keys (for CSV / pandas)."""
        return [row for row in (ad_row(ad) for ad in ads) if row]
