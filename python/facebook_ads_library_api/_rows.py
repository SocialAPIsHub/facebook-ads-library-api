"""Turn Ads Library answers into flat rows (CSV, spreadsheets, dataframes).

Every field read here was checked against real ``/facebook/ads/search``
answers. ``data.ads`` is a list of GROUPS of near-identical ads (the same
creative run in several versions): we keep the first ad of each group.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

AD_COLUMNS = [
    "ad_archive_id",
    "advertiser",
    "headline",
    "text",
    "cta",
    "platforms",
    "start_date",
    "landing_domain",
    "ads_library_url",
]

_PLATFORMS = {
    "FACEBOOK": "Facebook",
    "INSTAGRAM": "Instagram",
    "MESSENGER": "Messenger",
    "AUDIENCE_NETWORK": "Audience Network",
    "THREADS": "Threads",
    "WHATSAPP": "WhatsApp",
}

_PLACEHOLDER = re.compile(r"\{\{.*?\}\}")
_DIGITS = re.compile(r"^\d{1,30}$")


def _text(value: Any, limit: int = 500) -> str | None:
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    if not text:
        return None
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _real_text(value: Any, limit: int = 500) -> str | None:
    """Text without ``{{product.name}}``-style catalog placeholders, else None."""
    text = _text(value, limit)
    return text if text and not _PLACEHOLDER.search(text) else None


def _iso_date(value: Any) -> str | None:
    if isinstance(value, str) and value.isdigit():
        value = int(value)
    if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
        return None
    seconds = value / 1000 if value > 1e12 else value
    try:
        day = datetime.fromtimestamp(seconds, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return None
    return day.date().isoformat() if 2004 <= day.year <= 2100 else None


def _host(value: Any) -> str | None:
    text = _text(value, 2000)
    match = text and re.match(r"^https?://([^/?#:]+)", text, re.IGNORECASE)
    if not match:
        return None
    host = match.group(1).lower()
    return host[4:] if host.startswith("www.") else host


def ads_block(body: Any) -> dict[str, Any] | None:
    """The ``{ads, page_info}`` part of a search answer, whatever the wrapping."""
    node = body
    for _ in range(4):
        if not isinstance(node, dict):
            return None
        if isinstance(node.get("ads"), list):
            return node
        node = node.get("data")
    return None


def first_ads(body: Any) -> list[dict[str, Any]]:
    """One ad per group, in the order the API returned them."""
    block = ads_block(body)
    if not block:
        return []
    ads = []
    for group in block["ads"]:
        ad = group[0] if isinstance(group, list) and group else group
        if isinstance(ad, dict):
            ads.append(ad)
    return ads


def ad_row(ad: dict[str, Any]) -> dict[str, Any] | None:
    """One ad → a flat dict with the keys of :data:`AD_COLUMNS` (None if it has no id)."""
    raw_id = ad.get("ad_archive_id")
    ad_id = str(raw_id) if isinstance(raw_id, int) and not isinstance(raw_id, bool) else raw_id
    if not isinstance(ad_id, str) or not _DIGITS.match(ad_id):
        return None
    snap = ad.get("snapshot") if isinstance(ad.get("snapshot"), dict) else {}
    cards = snap.get("cards")
    card = cards[0] if isinstance(cards, list) and cards and isinstance(cards[0], dict) else {}
    catalog = str(snap.get("display_format") or "").upper() in ("DPA", "DCO")
    body = snap.get("body")
    body_text = body if isinstance(body, str) else body.get("text") if isinstance(body, dict) else None

    headline = (
        (_real_text(card.get("title"), 200) if catalog else None)
        or _real_text(snap.get("title"), 200)
        or _real_text(card.get("title"), 200)
    )
    text = (_real_text(card.get("body")) if catalog else None) or _real_text(body_text) or _real_text(card.get("body"))
    platforms: list[str] = []
    for name in ad.get("publisher_platform") or []:
        label = _PLATFORMS.get(str(name).upper())
        if label and label not in platforms:
            platforms.append(label)

    return {
        "ad_archive_id": ad_id,
        "advertiser": _text(ad["page_name"] if "page_name" in ad else snap.get("page_name"), 200),
        "headline": headline,
        "text": text,
        "cta": _real_text(snap["cta_text"] if "cta_text" in snap else card.get("cta_text"), 40),
        "platforms": ", ".join(platforms),
        "start_date": _iso_date(ad.get("start_date")),
        "landing_domain": _host(snap["link_url"] if "link_url" in snap else card.get("link_url")),
        "ads_library_url": f"https://www.facebook.com/ads/library/?id={ad_id}",
    }
