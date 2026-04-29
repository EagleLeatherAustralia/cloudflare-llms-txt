import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getCatalogue } from "./feed-cache";
import type { Product } from "./feed-parser";
import { brandCounts, priceLabel, searchProducts, uniqueCategories } from "./search";

function summary(p: Product): string {
  const lines = [
    `**${p.name}** — ${p.brand ?? "Unknown brand"}`,
    `SKU: ${p.sku}${p.gtin ? `  GTIN: ${p.gtin}` : ""}`,
    `Price: ${priceLabel(p)}`,
    `Stock: ${p.inStock ? "in stock" : "out of stock"}`,
    `URL: ${p.url}`,
  ];
  if (p.categories[0]?.length) lines.push(`Category: ${p.categories[0].join(" › ")}`);
  return lines.join("\n");
}

function full(p: Product): string {
  return [summary(p), p.color ? `Color: ${p.color}` : "", p.size ? `Size: ${p.size}` : "", p.material ? `Material: ${p.material}` : "", p.imageUrl ? `Image: ${p.imageUrl}` : "", "", p.description].filter(Boolean).join("\n");
}

export function buildMcpHandler(feedBase: string) {
  const server = new McpServer({ name: "eagle-leather", version: "1.0.0" });

  server.registerTool(
    "search_products",
    {
      description: "Search the Eagle Leather catalogue by free-text query. Matches against product name, SKU, brand, and description. Optional filters narrow by category breadcrumb fragment, brand, or stock status. Returns up to `limit` ranked summaries.",
      inputSchema: {
        query: z.string().min(1).describe("free-text search query"),
        category: z.string().optional().describe("category breadcrumb fragment, e.g. 'Latex' or 'Hoods'"),
        brand: z.string().optional(),
        in_stock_only: z.boolean().optional().default(false),
        limit: z.number().int().min(1).max(50).optional().default(10),
      },
    },
    async ({ query, category, brand, in_stock_only, limit }) => {
      const { products } = await getCatalogue(feedBase);
      const ranked = searchProducts(products, {
        query,
        category,
        brand,
        inStockOnly: in_stock_only,
        limit,
      });
      const text = ranked.length === 0 ? "No matches." : ranked.map(summary).join("\n\n---\n\n");
      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "get_product",
    {
      description: "Fetch a single product by SKU. Returns the full record including description, image URL, color/size/material, and category breadcrumbs.",
      inputSchema: { sku: z.string().describe("product SKU (case-insensitive)") },
    },
    async ({ sku }) => {
      const { bySku } = await getCatalogue(feedBase);
      const p = bySku.get(sku.toLowerCase());
      return {
        content: [{ type: "text", text: p ? full(p) : `No product with SKU '${sku}'.` }],
      };
    }
  );

  server.registerTool(
    "check_stock",
    {
      description: "Check stock and current price for a SKU. Lighter than get_product when you only need availability.",
      inputSchema: { sku: z.string() },
    },
    async ({ sku }) => {
      const { bySku } = await getCatalogue(feedBase);
      const p = bySku.get(sku.toLowerCase());
      if (!p) return { content: [{ type: "text", text: `No product with SKU '${sku}'.` }] };
      return {
        content: [
          {
            type: "text",
            text: `${p.name} (SKU ${p.sku}): ${p.inStock ? "in stock" : "out of stock"}, ${priceLabel(p)}\n${p.url}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_categories",
    {
      description: "List every category breadcrumb in the catalogue. Useful for picking a `category` filter for search_products.",
      inputSchema: {},
    },
    async () => {
      const { products } = await getCatalogue(feedBase);
      return { content: [{ type: "text", text: uniqueCategories(products).join("\n") }] };
    }
  );

  server.registerTool(
    "list_brands",
    {
      description: "List every brand represented in the catalogue with product counts. Useful for picking a `brand` filter.",
      inputSchema: {},
    },
    async () => {
      const { products } = await getCatalogue(feedBase);
      const lines = [...brandCounts(products).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([b, n]) => `${b} (${n})`);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  return createMcpHandler(server);
}
