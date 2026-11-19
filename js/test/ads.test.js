import assert from "node:assert/strict";
import { test } from "node:test";
import { AdsLibrary, adRow, firstAds, nextCursor, toCsv } from "../src/index.js";
import { main } from "../src/cli.js";

const AD = {
  ad_archive_id: 1234567890,
  page_name: "Acme Shoes",
  publisher_platform: ["FACEBOOK", "INSTAGRAM", "FACEBOOK"],
  start_date: 1767225600,
  snapshot: {
    title: "Run further",
    body: { text: "Our  lightest shoe yet." },
    cta_text: "Shop now",
    link_url: "https://www.acme.example/shoes?utm=1",
  },
};

const answer = (ads, cursor, hasNext = true) => ({
  message: "ok",
  meta: { statusCode: 200 },
  data: { ads, page_info: { end_cursor: cursor, has_next_page: hasNext } },
});

/** A fetch that answers from a list and records the URLs it was called with. */
function fakeFetch(answers) {
  const urls = [];
  const fn = async (url, init) => {
    urls.push(new URL(url));
    assert.equal(init.headers["x-api-token"], "test-key");
    return new Response(JSON.stringify(answers[urls.length - 1]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fn, urls };
}

test("search follows the cursor and keeps one ad per group", async () => {
  const f = fakeFetch([answer([[AD, { ...AD, ad_archive_id: 1 }]], "c1"), answer([AD], null, false)]);
  const lib = new AdsLibrary({ apiToken: "test-key", fetch: f.fn });
  const ads = [];
  for await (const ad of lib.search("running shoes", { pages: 5 })) ads.push(ad);
  assert.equal(ads.length, 2);
  assert.equal(f.urls.length, 2);
  assert.equal(f.urls[0].pathname, "/facebook/ads/search");
  assert.equal(f.urls[0].searchParams.get("query"), "running shoes");
  assert.equal(f.urls[0].searchParams.get("country"), "US");
  assert.equal(f.urls[0].searchParams.get("sort_data"), "impressions");
  assert.equal(f.urls[0].searchParams.get("activeStatus"), "Active");
  assert.equal(f.urls[0].searchParams.has("end_cursor"), false);
  assert.equal(f.urls[1].searchParams.get("end_cursor"), "c1");
});

test("pages is a hard ceiling and a repeated cursor stops", async () => {
  const f = fakeFetch([answer([AD], "c1"), answer([AD], "c2")]);
  const lib = new AdsLibrary({ apiToken: "test-key", fetch: f.fn });
  for await (const _ of lib.search("x", { pages: 1 })) void _;
  assert.equal(f.urls.length, 1);

  const g = fakeFetch([answer([AD], "same"), answer([AD], "same"), answer([AD], "same")]);
  const lib2 = new AdsLibrary({ apiToken: "test-key", fetch: g.fn });
  for await (const _ of lib2.search("x", { pages: 3 })) void _;
  assert.equal(g.urls.length, 2);
});

test("advertiser by id searches all countries without a query", async () => {
  const f = fakeFetch([answer([AD], null)]);
  const lib = new AdsLibrary({ apiToken: "test-key", fetch: f.fn });
  for await (const _ of lib.advertiserAds("123456789")) void _;
  const p = f.urls[0].searchParams;
  assert.equal(p.has("query"), false);
  assert.equal(p.get("ad_page_id"), "123456789");
  assert.equal(p.get("country"), "ALL");
  assert.equal(p.has("sort_data"), false);
});

test("invalid inputs are refused before any call", async () => {
  const f = fakeFetch([]);
  const lib = new AdsLibrary({ apiToken: "test-key", fetch: f.fn });
  await assert.rejects(lib.search("x", { country: "USA" }).next(), /country/);
  await assert.rejects(lib.search("x", { activeStatus: "running" }).next(), /activeStatus/);
  await assert.rejects(lib.searchPages({}).next(), /keyword/);
  assert.equal(f.urls.length, 0);
});

test("adRow flattens an ad", () => {
  assert.deepEqual(adRow(AD), {
    ad_archive_id: "1234567890",
    advertiser: "Acme Shoes",
    headline: "Run further",
    text: "Our lightest shoe yet.",
    cta: "Shop now",
    platforms: "Facebook, Instagram",
    start_date: "2026-01-01",
    landing_domain: "acme.example",
    ads_library_url: "https://www.facebook.com/ads/library/?id=1234567890",
  });
  assert.equal(adRow({ snapshot: {} }), null);
});

test("catalog ads use the card and drop placeholders", () => {
  const row = adRow({
    ad_archive_id: "42",
    snapshot: {
      display_format: "DPA",
      title: "{{product.name}}",
      body: { text: "{{product.brand}}" },
      cards: [{ title: "Trail runner", body: "Grip on any ground", link_url: "https://shop.example/p" }],
    },
  });
  assert.equal(row.headline, "Trail runner");
  assert.equal(row.text, "Grip on any ground");
  assert.equal(row.landing_domain, "shop.example");
});

test("answer shapes", () => {
  assert.deepEqual(firstAds({ data: { data: { ads: [[AD]] } } }), [AD]);
  assert.deepEqual(firstAds({ data: {} }), []);
  assert.equal(nextCursor(answer([], "abc")), "abc");
  assert.equal(nextCursor(answer([], "abc", false)), null);
  assert.equal(nextCursor({ meta: { end_cursor: "not-data" } }), null);
});

test("csv quotes commas and quotes", () => {
  const csv = toCsv([{ ...adRow(AD), text: 'Say "hi", now' }]);
  assert.match(csv, /^ad_archive_id,advertiser,/);
  assert.match(csv, /"Say ""hi"", now"/);
});

test("missing token is a clear error", () => {
  const saved = process.env.SOCIALAPIS_TOKEN;
  delete process.env.SOCIALAPIS_TOKEN;
  try {
    assert.throws(() => new AdsLibrary(), /SOCIALAPIS_TOKEN/);
  } finally {
    if (saved !== undefined) process.env.SOCIALAPIS_TOKEN = saved;
  }
});

test("cli prints help without a token", async () => {
  let text = "";
  await main(["--help"], { write: (s) => (text += s) });
  assert.match(text, /search <keyword>/);
});
