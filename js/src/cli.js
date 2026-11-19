// Command line: search the Meta Ads Library and save the ads as CSV or JSON lines.
//
//     npx facebook-ads-library-api search "running shoes" --country US --pages 2 --out ads.csv
//     npx facebook-ads-library-api advertiser nike --status ALL --format jsonl
//     npx facebook-ads-library-api ad 1234567890123456
//
// The API key comes from --token or the SOCIALAPIS_TOKEN environment variable.

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { AdsLibrary, adRow, toCsv, VERSION } from "./index.js";

const HELP = `facebook-ads-library-api ${VERSION}: search the Meta Ads Library (Facebook, Instagram, Messenger, WhatsApp ads)

Usage:
  facebook-ads-library-api search <keyword> [options]
  facebook-ads-library-api advertiser <ad_page_id | Page URL | username> [options]
  facebook-ads-library-api ad <ad_archive_id> [--page-id <id>]
  facebook-ads-library-api countries

Options:
  --country <code>   two-letter code or ALL (default: US for a keyword, ALL for an advertiser)
  --status <s>       Active (default), Inactive or ALL
  --sort <s>         impressions or recent
  --after <date>     only ads after this date (YYYY-MM-DD)
  --before <date>    only ads before this date (YYYY-MM-DD)
  --pages <n>        pages to fetch, 1 credit each (default 1)
  --format <f>       csv (default) or jsonl
  --out <file>       file to write (default: standard output)
  --token <key>      SocialAPIs API key (default: $SOCIALAPIS_TOKEN)

Free API key (200 calls/month): https://socialapis.io/auth/signup`;

export async function main(argv = process.argv.slice(2), out = process.stdout) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      country: { type: "string" },
      status: { type: "string", default: "Active" },
      sort: { type: "string" },
      after: { type: "string" },
      before: { type: "string" },
      pages: { type: "string", default: "1" },
      format: { type: "string", default: "csv" },
      out: { type: "string" },
      token: { type: "string" },
      "page-id": { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  if (values.version) return void out.write(`${VERSION}\n`);
  const [command, target] = positionals;
  if (values.help || !command) return void out.write(`${HELP}\n`);
  if (!["csv", "jsonl"].includes(values.format)) throw new RangeError("--format is csv or jsonl");

  const lib = new AdsLibrary({ apiToken: values.token });
  if (command === "countries") return void out.write(`${JSON.stringify(await lib.countries(), null, 2)}\n`);
  if (!target) throw new RangeError(`${command} needs an argument (see --help)`);
  if (command === "ad") {
    return void out.write(`${JSON.stringify(await lib.adDetails(target, values["page-id"]), null, 2)}\n`);
  }
  if (command !== "search" && command !== "advertiser") throw new RangeError(`unknown command "${command}"`);

  const options = {
    country: values.country,
    activeStatus: values.status,
    sort: values.sort,
    after: values.after,
    before: values.before,
    pages: Number(values.pages),
  };
  const ads = [];
  const source = command === "search" ? lib.search(target, options) : lib.advertiserAds(target, options);
  for await (const ad of source) ads.push(ad);

  const text =
    values.format === "csv"
      ? toCsv(AdsLibrary.rows(ads))
      : ads.map((ad) => `${JSON.stringify(ad)}\n`).join("");
  const count = values.format === "csv" ? ads.filter(adRow).length : ads.length;
  if (values.out) {
    writeFileSync(values.out, text);
    process.stderr.write(`${count} ads written to ${values.out}\n`);
  } else {
    out.write(text);
  }
}
