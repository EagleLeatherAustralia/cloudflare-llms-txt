import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFeed } from "../src/feed-parser";

const here = dirname(fileURLToPath(import.meta.url));
const sample = readFileSync(join(here, "fixtures", "sample-feed.txt"), "utf8");

describe("parseFeed", () => {
  const products = parseFeed(sample);

  it("parses every well-formed section", () => {
    expect(products).toHaveLength(4);
    expect(products.map((p) => p.sku)).toEqual(["40023", "SALE-1", "CFG-1", "PIG-RING"]);
  });

  it("skips sections missing required fields (no Price or Stock)", () => {
    expect(products.find((p) => p.sku === "BAD-1")).toBeUndefined();
  });

  it("captures GTIN when present and leaves it undefined otherwise", () => {
    expect(products.find((p) => p.sku === "PIG-RING")?.gtin).toBe("840215105493");
    expect(products.find((p) => p.sku === "40023")?.gtin).toBeUndefined();
  });

  it("parses Categories into an array of breadcrumb arrays", () => {
    const p = products.find((p) => p.sku === "40023")!;
    expect(p.categories).toEqual([
      ["Clothing", "Head Gear", "Hoods"],
      ["Clothing", "Latex", "Hoods & Masks"],
    ]);
  });

  it("interprets Stock as a boolean inStock", () => {
    expect(products.find((p) => p.sku === "40023")?.inStock).toBe(false);
    expect(products.find((p) => p.sku === "PIG-RING")?.inStock).toBe(true);
  });

  it("captures optional metadata (Color, Image)", () => {
    const p = products.find((p) => p.sku === "40023")!;
    expect(p.color).toBe("Black");
    expect(p.imageUrl).toBe("https://admin.eagleleather.com.au/media/catalog/product/l/a/latex_combi.jpg");
  });

  it("preserves the markdown description including features list", () => {
    const p = products.find((p) => p.sku === "40023")!;
    expect(p.description).toContain("0.9mm rubber");
    expect(p.description).toContain("**Features:**");
    expect(p.description).toContain("- Heavy-duty back zipper");
  });

  it("ignores the header section (no `## ` heading) before the first product", () => {
    expect(products.every((p) => p.name !== "Eagle Leather Product Catalog")).toBe(true);
  });
});

describe("price parsing", () => {
  const products = parseFeed(sample);

  it("regular price", () => {
    expect(products.find((p) => p.sku === "40023")?.price).toMatchObject({
      amount: 625,
      currency: "AUD",
      raw: "A$625.00",
    });
  });

  it("sale price captures `was`", () => {
    const p = products.find((p) => p.sku === "SALE-1")!;
    expect(p.price.amount).toBe(76.3);
    expect(p.price.was).toBe(109);
    expect(p.price.maxAmount).toBeUndefined();
  });

  it("configurable range captures `maxAmount`", () => {
    const p = products.find((p) => p.sku === "CFG-1")!;
    expect(p.price.amount).toBe(99);
    expect(p.price.maxAmount).toBe(129);
    expect(p.price.was).toBeUndefined();
  });
});

describe("parseFeed on empty/garbage input", () => {
  it("returns [] for an empty string", () => {
    expect(parseFeed("")).toEqual([]);
  });

  it("returns [] for input with no product sections", () => {
    expect(parseFeed("# Header\n\nSome preamble\n\n---\n\nMore preamble")).toEqual([]);
  });
});
