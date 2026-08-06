# APKLive data

Reduced product data used by the APKLive iOS app. The source dataset is provided by
[`C4illin/systembolaget-data`](https://github.com/C4illin/systembolaget-data).

## CDN URLs

- Products: `https://cdn.jsdelivr.net/gh/foal20ym/APKLive-data@main/data/products.json`
- Manifest: `https://cdn.jsdelivr.net/gh/foal20ym/APKLive-data@main/data/manifest.json`

jsDelivr caches GitHub branch URLs for a limited period. The iOS app additionally keeps a
local copy and checks for updates at most once every 30 days.

## Automated updates

The GitHub Action in `.github/workflows/update-products.yml` runs on the first day of every
month. It can also be run manually from the repository's Actions tab.

The update script:

1. Fetches the full upstream dataset once.
2. Retains only fields used by APKLive.
3. Uses `productNumber` as the stable SKU identity, with `productId` as fallback.
4. Deterministically merges duplicate SKU rows and rejects an abnormal duplicate rate.
5. Produces a minified `products.json` and a checksum manifest.
6. Commits the result only after every validation succeeds.

Run locally with Node.js 22 or later:

```bash
npm run update
```

Seed from an existing local dataset without contacting the upstream API:

```bash
node scripts/update-products.mjs --input /path/to/data.json
```
