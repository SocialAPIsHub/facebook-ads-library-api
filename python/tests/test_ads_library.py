from __future__ import annotations

import csv
import io
from typing import Any

import pytest

from facebook_ads_library_api import AdsLibrary, ad_row, first_ads, next_cursor
from facebook_ads_library_api.cli import _write


def answer(ads: list[Any], cursor: str | None, has_next: bool = True) -> dict[str, Any]:
    return {
        "message": "ok",
        "meta": {"statusCode": 200},
        "data": {"ads": ads, "page_info": {"end_cursor": cursor, "has_next_page": has_next}},
    }


AD = {
    "ad_archive_id": 1234567890,
    "page_name": "Acme Shoes",
    "publisher_platform": ["FACEBOOK", "INSTAGRAM", "FACEBOOK"],
    "start_date": 1767225600,
    "snapshot": {
        "title": "Run further",
        "body": {"text": "Our  lightest shoe yet."},
        "cta_text": "Shop now",
        "link_url": "https://www.acme.example/shoes?utm=1",
    },
}


class FakeFacebook:
    def __init__(self, answers: list[dict[str, Any]]) -> None:
        self.answers = answers
        self.calls: list[dict[str, Any]] = []

    def search_ads(self, query: str | None, **kwargs: Any) -> dict[str, Any]:
        self.calls.append({"query": query, **kwargs})
        return self.answers[len(self.calls) - 1]

    def close(self) -> None:
        pass


def test_search_follows_cursor_and_keeps_one_ad_per_group() -> None:
    fb = FakeFacebook([answer([[AD, {**AD, "ad_archive_id": 1}]], "c1"), answer([AD], None, has_next=False)])
    ads = list(AdsLibrary(client=fb).search("running shoes", pages=5))  # type: ignore[arg-type]
    assert len(ads) == 2
    assert len(fb.calls) == 2
    assert fb.calls[0]["end_cursor"] is None
    assert fb.calls[1]["end_cursor"] == "c1"
    assert fb.calls[0]["country"] == "US"
    assert fb.calls[0]["sort_data"] == "impressions"
    assert fb.calls[0]["activeStatus"] == "Active"


def test_pages_is_a_hard_ceiling() -> None:
    fb = FakeFacebook([answer([AD], "c1"), answer([AD], "c2")])
    assert len(list(AdsLibrary(client=fb).search("x", pages=1))) == 1  # type: ignore[arg-type]
    assert len(fb.calls) == 1


def test_repeated_cursor_stops() -> None:
    fb = FakeFacebook([answer([AD], "same"), answer([AD], "same"), answer([AD], "same")])
    list(AdsLibrary(client=fb).search("x", pages=3))  # type: ignore[arg-type]
    assert len(fb.calls) == 2


def test_advertiser_by_id_defaults_to_all_countries() -> None:
    fb = FakeFacebook([answer([AD], None)])
    list(AdsLibrary(client=fb).advertiser_ads("123456789"))  # type: ignore[arg-type]
    assert fb.calls[0]["query"] is None
    assert fb.calls[0]["ad_page_id"] == "123456789"
    assert fb.calls[0]["country"] == "ALL"
    assert fb.calls[0]["sort_data"] is None


def test_invalid_inputs() -> None:
    lib = AdsLibrary(client=FakeFacebook([]))  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="country"):
        list(lib.search("x", country="USA"))
    with pytest.raises(ValueError, match="active_status"):
        list(lib.search("x", active_status="running"))
    with pytest.raises(ValueError, match="keyword"):
        list(lib.search_pages())


def test_ad_row() -> None:
    row = ad_row(AD)
    assert row == {
        "ad_archive_id": "1234567890",
        "advertiser": "Acme Shoes",
        "headline": "Run further",
        "text": "Our lightest shoe yet.",
        "cta": "Shop now",
        "platforms": "Facebook, Instagram",
        "start_date": "2026-01-01",
        "landing_domain": "acme.example",
        "ads_library_url": "https://www.facebook.com/ads/library/?id=1234567890",
    }


def test_catalog_ad_uses_card_and_drops_placeholders() -> None:
    ad = {
        "ad_archive_id": "42",
        "snapshot": {
            "display_format": "DPA",
            "title": "{{product.name}}",
            "body": {"text": "{{product.brand}}"},
            "cards": [{"title": "Trail runner", "body": "Grip on any ground", "link_url": "https://shop.example/p"}],
        },
    }
    row = ad_row(ad)
    assert row is not None
    assert row["headline"] == "Trail runner"
    assert row["text"] == "Grip on any ground"
    assert row["landing_domain"] == "shop.example"


def test_ad_without_id_is_skipped() -> None:
    assert ad_row({"snapshot": {}}) is None
    assert AdsLibrary.rows([{"snapshot": {}}, AD])[0]["ad_archive_id"] == "1234567890"


def test_shapes() -> None:
    assert first_ads({"data": {"data": {"ads": [[AD]]}}}) == [AD]
    assert first_ads({"data": {}}) == []
    assert next_cursor(answer([], "abc")) == "abc"
    assert next_cursor(answer([], "abc", has_next=False)) is None
    assert next_cursor({"meta": {"end_cursor": "not-data"}}) is None


def test_csv_export() -> None:
    out = io.StringIO()
    assert _write([AD, {"bad": True}], "csv", out) == 1
    rows = list(csv.DictReader(io.StringIO(out.getvalue())))
    assert rows[0]["advertiser"] == "Acme Shoes"


def test_missing_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SOCIALAPIS_TOKEN", raising=False)
    with pytest.raises(ValueError, match="SOCIALAPIS_TOKEN"):
        AdsLibrary()
