import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFeed } from "../src/feed-parser";
import {
  brandCounts,
  matchesCategory,
  priceLabel,
  scoreProduct,
  searchProducts,
  uniqueCategories,
} from "../src/search";

const here = dirname(fileURLToPath(import.meta.url));
const sample = readFileSync(join(here, "fixtures", "sample-feed.txt"), "utf8");
const products = parseFeed(sample);

describe("priceLabel", () => {
  it("regular price → 'A$X.XX'", () => {
    const p = products.find((p) => p.sku === "40023")!;
    expect(priceLabel(p)).toBe("A$625.00");
  });

  it("sale price → 'A$X.XX (was A$Y.YY)'", () => {
    const p = products.find((p) => p.sku === "SALE-1")!;
    expect(priceLabel(p)).toBe("A$76.30 (was A$109.00)");
  });

  it("configurable range → 'A$X.XX–A$Y.YY' (en-dash)", () => {
    const p = products.find((p) => p.sku === "CFG-1")!;
    expect(priceLabel(p)).toBe("A$99.00–A$129.00");
  });
});

describe("scoreProduct", () => {
  const pigRing = products.find((p) => p.sku === "PIG-RING")!;

  it("exact-SKU match scores highest", () => {
    expect(scoreProduct(pigRing, "pig-ring")).toBeGreaterThanOrEqual(100);
  });

  it("name substring scores moderately", () => {
    expect(scoreProduct(pigRing, "ring")).toBeGreaterThanOrEqual(10);
    expect(scoreProduct(pigRing, "ring")).toBeLessThan(50);
  });

  it("description-only match scores lowest", () => {
    expect(scoreProduct(pigRing, "silicone")).toBe(1);
  });

  it("no match scores 0", () => {
    expect(scoreProduct(pigRing, "xyzzy")).toBe(0);
  });
});

describe("searchProducts", () => {
  it("ranks exact SKU above name match", () => {
    const results = searchProducts(products, { query: "pig-ring" });
    expect(results[0]?.sku).toBe("PIG-RING");
  });

  it("filters by brand (case-insensitive equality)", () => {
    const results = searchProducts(products, { query: "ring", brand: "OXBALLS" });
    expect(results.every((p) => p.brand === "Oxballs")).toBe(true);
  });

  it("filters by in_stock_only", () => {
    const all = searchProducts(products, { query: "hood" });
    expect(all.find((p) => p.sku === "40023")).toBeDefined();
    const inStock = searchProducts(products, { query: "hood", inStockOnly: true });
    expect(inStock.find((p) => p.sku === "40023")).toBeUndefined();
  });

  it("filters by category fragment", () => {
    const results = searchProducts(products, { query: "ring", category: "Cock & Ball" });
    expect(results.every((p) => p.categories.flat().some((c) => c.includes("Cock & Ball")))).toBe(true);
  });

  it("respects limit", () => {
    const results = searchProducts(products, { query: "a", limit: 1 });
    expect(results).toHaveLength(1);
  });

  it("returns [] for query with no matches", () => {
    expect(searchProducts(products, { query: "no-such-word" })).toEqual([]);
  });
});

describe("matchesCategory", () => {
  const pigRing = products.find((p) => p.sku === "PIG-RING")!;

  it("matches at any breadcrumb depth, case-insensitive", () => {
    expect(matchesCategory(pigRing, "cock")).toBe(true);
    expect(matchesCategory(pigRing, "Toys & Gear")).toBe(true);
    expect(matchesCategory(pigRing, "RINGS")).toBe(true);
  });

  it("returns false for unrelated category", () => {
    expect(matchesCategory(pigRing, "Apparel")).toBe(false);
  });
});

describe("brandCounts", () => {
  it("counts each brand and skips products without one", () => {
    const counts = brandCounts(products);
    expect(counts.get("Oxballs")).toBe(2);
    expect(counts.get("Blackstyle")).toBe(1);
    expect(counts.get("Mister B")).toBe(1);
  });
});

describe("uniqueCategories", () => {
  it("returns sorted, deduplicated breadcrumbs joined with ' › '", () => {
    const cats = uniqueCategories(products);
    expect(cats).toContain("Clothing › Head Gear › Hoods");
    expect(cats).toContain("Toys & Gear › Cock & Ball Toys");
    expect(cats).toEqual([...cats].sort());
    expect(new Set(cats).size).toBe(cats.length);
  });
});
