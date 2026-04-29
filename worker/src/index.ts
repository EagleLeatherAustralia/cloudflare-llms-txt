import llmsTxt from "../../llms.txt";
import securityTxt from "../../security.txt";
import { buildMcpHandler } from "./mcp";

interface Env {
  FEED_BASE: string;
  // Set via `wrangler secret put` (see README). Optional — refresh endpoint
  // returns a 500 if any are missing rather than silently breaking.
  REFRESH_TOKEN?: string;
  PURGE_API_TOKEN?: string;
  PURGE_ZONE_ID?: string;
}

const DISCOVERY_LINK =
  '<https://www.eagleleather.com.au/mcp>; rel="mcp-server", </llms-full.txt>; rel="describedby"; type="text/plain"';

function preferMarkdown(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return /\btext\/markdown\b/i.test(accept);
}

function textContentType(request: Request): string {
  return preferMarkdown(request)
    ? "text/markdown; charset=utf-8"
    : "text/plain; charset=utf-8";
}

const PURGE_URLS = [
  "https://eagleleather.com.au/llms.txt",
  "https://www.eagleleather.com.au/llms.txt",
  "https://eagleleather.com.au/llms-full.txt",
  "https://www.eagleleather.com.au/llms-full.txt",
  "https://eagleleather.com.au/security.txt",
  "https://www.eagleleather.com.au/security.txt",
  "https://eagleleather.com.au/.well-known/security.txt",
  "https://www.eagleleather.com.au/.well-known/security.txt",
];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Refresh trigger: header survives the apex→www redirect (Cloudflare
    // Redirect Rules don't preserve query strings by default), so prefer
    // X-Refresh-Token. Query param ?refresh= still works on direct www calls.
    const headerToken = request.headers.get("x-refresh-token");
    const queryToken = url.searchParams.get("refresh");
    if (headerToken || queryToken) {
      return handleRefresh(headerToken ?? queryToken ?? "", env);
    }

    if (url.pathname === "/mcp") {
      return buildMcpHandler(env.FEED_BASE)(request, env, ctx);
    }

    if (url.pathname === "/.well-known/mcp/server-card.json") {
      const card = {
        serverInfo: { name: "eagle-leather", version: "1.0.0" },
        transport: { type: "streamable-http", endpoint: "https://www.eagleleather.com.au/mcp" },
        capabilities: { tools: ["search_products", "get_product", "check_stock", "list_categories", "list_brands"] },
        documentation: "https://www.eagleleather.com.au/llms.txt",
      };
      return new Response(JSON.stringify(card, null, 2) + "\n", {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
          "X-Served-By": "cloudflare-llm-txt-worker",
        },
      });
    }

    if (url.pathname === "/llms.txt") {
      return new Response(llmsTxt, {
        status: 200,
        headers: {
          "Content-Type": textContentType(request),
          "Cache-Control": "public, max-age=3600",
          "X-Served-By": "cloudflare-llm-txt-worker",
          Link: DISCOVERY_LINK,
          Vary: "Accept",
        },
      });
    }

    if (
      url.pathname === "/.well-known/security.txt" ||
      url.pathname === "/security.txt"
    ) {
      return new Response(securityTxt, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
          "X-Served-By": "cloudflare-llm-txt-worker",
        },
      });
    }

    if (url.pathname === "/llms-full.txt") {
      const upstream = new URL("llms-full.txt", env.FEED_BASE).toString();
      const response = await fetch(upstream, {
        cf: { cacheTtl: 3600, cacheEverything: true },
      });

      const headers = new Headers(response.headers);
      headers.set("Content-Type", textContentType(request));
      headers.set("X-Served-By", "cloudflare-llm-txt-worker");
      headers.set("Link", DISCOVERY_LINK);
      headers.set("Vary", "Accept");

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleRefresh(token: string, env: Env): Promise<Response> {
  if (!env.REFRESH_TOKEN) {
    return new Response("refresh: REFRESH_TOKEN not configured\n", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!token || token !== env.REFRESH_TOKEN) {
    return new Response("refresh: invalid token\n", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!env.PURGE_API_TOKEN || !env.PURGE_ZONE_ID) {
    return new Response(
      "refresh: PURGE_API_TOKEN and PURGE_ZONE_ID secrets are not configured\n",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const purgeRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.PURGE_ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PURGE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: PURGE_URLS }),
    }
  );

  if (!purgeRes.ok) {
    return new Response("refresh: purge failed\n", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response("OK\n", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
