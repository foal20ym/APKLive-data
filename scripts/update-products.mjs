import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://susbolaget.emrik.org/v1/products";
const MINIMUM_PRODUCT_COUNT = 10_000;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const outputDirectory = resolve(repositoryRoot, "data");
const productsPath = resolve(outputDirectory, "products.json");
const manifestPath = resolve(outputDirectory, "manifest.json");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadSourceProducts() {
  const localInput = argumentValue("--input");
  if (localInput) {
    const contents = await readFile(resolve(localInput), "utf8");
    return { products: JSON.parse(contents), source: "local-seed" };
  }

  const response = await fetch(SOURCE_URL, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, br",
      "User-Agent": "APKLive-data-updater/1.0",
    },
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    throw new Error(`Source API returned HTTP ${response.status}`);
  }

  return { products: await response.json(), source: SOURCE_URL };
}

function optionalString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function reduceProduct(product) {
  return {
    productId: String(product.productId ?? ""),
    productNameThin: optionalString(product.productNameThin),
    productNameBold: optionalString(product.productNameBold),
    alcoholPercentage: Number(product.alcoholPercentage),
    volume: Number(product.volume),
    price: Number(product.price),
    productNumberShort: optionalString(product.productNumberShort),
    productNumber: optionalString(product.productNumber),
    imageUrl: optionalString(product.imageUrl),
    customCategoryTitle: optionalString(product.customCategoryTitle),
    country: optionalString(product.country),
  };
}

function isValidProduct(product) {
  return (
    product.productId.length > 0 &&
    product.productNameBold !== null &&
    Number.isFinite(product.alcoholPercentage) &&
    product.alcoholPercentage >= 0 &&
    Number.isFinite(product.volume) &&
    product.volume > 0 &&
    Number.isFinite(product.price) &&
    product.price > 0
  );
}

const source = await loadSourceProducts();
if (!Array.isArray(source.products)) {
  throw new Error("Source payload is not a product array");
}

const reducedProducts = source.products
  .map(reduceProduct)
  .filter(isValidProduct)
  .sort((left, right) => left.productId.localeCompare(right.productId));

if (reducedProducts.length < MINIMUM_PRODUCT_COUNT) {
  throw new Error(
    `Validation failed: expected at least ${MINIMUM_PRODUCT_COUNT} products, got ${reducedProducts.length}`,
  );
}

const uniqueProductIds = new Set(reducedProducts.map((product) => product.productId));
if (uniqueProductIds.size !== reducedProducts.length) {
  throw new Error("Validation failed: duplicate product IDs found");
}

const productsJSON = JSON.stringify(reducedProducts);
const checksum = createHash("sha256").update(productsJSON).digest("hex");
const generatedAt = new Date().toISOString();
const manifest = {
  schemaVersion: 1,
  generatedAt,
  productCount: reducedProducts.length,
  file: "products.json",
  sha256: checksum,
  source: source.source,
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(productsPath, productsJSON);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${reducedProducts.length} products`);
console.log(`SHA-256: ${checksum}`);
