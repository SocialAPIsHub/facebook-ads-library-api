"""Command line: search the Meta Ads Library and save the ads as CSV or JSON lines.

    facebook-ads-library search "running shoes" --country US --pages 2 --out ads.csv
    facebook-ads-library advertiser nike --status ALL --format jsonl
    facebook-ads-library ad 1234567890123456

The API key comes from --token or the SOCIALAPIS_TOKEN environment variable.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections.abc import Iterable
from typing import Any, TextIO

from socialapis import SocialAPIsError

from . import AD_COLUMNS, AdsLibrary, __version__, ad_row


def _write(ads: Iterable[dict[str, Any]], fmt: str, out: TextIO) -> int:
    count = 0
    if fmt == "csv":
        writer = csv.DictWriter(out, fieldnames=AD_COLUMNS)
        writer.writeheader()
        for ad in ads:
            row = ad_row(ad)
            if row:
                writer.writerow(row)
                count += 1
    else:
        for ad in ads:
            out.write(json.dumps(ad, ensure_ascii=False) + "\n")
            count += 1
    return count


def _search_options(args: argparse.Namespace) -> dict[str, Any]:
    return {
        "country": args.country,
        "active_status": args.status,
        "sort": args.sort,
        "after": args.after,
        "before": args.before,
        "pages": args.pages,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="facebook-ads-library",
        description="Search the Meta Ads Library (Facebook, Instagram, Messenger, WhatsApp ads).",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--token", help="SocialAPIs API key (default: $SOCIALAPIS_TOKEN)")
    sub = parser.add_subparsers(dest="command", required=True)

    def listing(name: str, help_text: str, arg: str, arg_help: str) -> None:
        p = sub.add_parser(name, help=help_text)
        p.add_argument(arg, help=arg_help)
        p.add_argument("--country", help="two-letter code or ALL (default: US for a keyword, ALL for an advertiser)")
        p.add_argument("--status", default="Active", help="Active (default), Inactive or ALL")
        p.add_argument("--sort", choices=["impressions", "recent"])
        p.add_argument("--after", help="only ads after this date (YYYY-MM-DD)")
        p.add_argument("--before", help="only ads before this date (YYYY-MM-DD)")
        p.add_argument("--pages", type=int, default=1, help="pages to fetch, 1 credit each (default 1)")
        p.add_argument("--format", choices=["csv", "jsonl"], default="csv")
        p.add_argument("--out", help="file to write (default: standard output)")

    listing("search", "ads matching a keyword", "query", 'keyword, e.g. "running shoes"')
    listing("advertiser", "ads of one advertiser", "advertiser", "ad_page_id, Page URL or username")

    ad = sub.add_parser("ad", help="details of one ad (JSON)")
    ad.add_argument("ad_archive_id")
    ad.add_argument("--page-id")

    sub.add_parser("countries", help="country codes the Ads Library accepts (JSON)")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        with AdsLibrary(api_token=args.token) as lib:
            if args.command in ("search", "advertiser"):
                ads = (
                    lib.search(args.query, **_search_options(args))
                    if args.command == "search"
                    else lib.advertiser_ads(args.advertiser, **_search_options(args))
                )
                if args.out:
                    with open(args.out, "w", newline="", encoding="utf-8") as fh:
                        count = _write(ads, args.format, fh)
                    print(f"{count} ads written to {args.out}", file=sys.stderr)
                else:
                    _write(ads, args.format, sys.stdout)
            elif args.command == "ad":
                print(json.dumps(lib.ad_details(args.ad_archive_id, args.page_id), indent=2, ensure_ascii=False))
            else:
                print(json.dumps(lib.countries(), indent=2, ensure_ascii=False))
    except (SocialAPIsError, ValueError, LookupError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
