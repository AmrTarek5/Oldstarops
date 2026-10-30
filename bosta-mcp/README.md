# bosta-mcp

A remote MCP server that wraps Bosta's delivery-search API so Claude can look
up deliveries (by tracking number, phone, or order reference) directly in
chat. Read-only — it never creates, cancels, or edits anything in Bosta.

## Deploy (free, on Vercel)

This lives inside the same GitHub repo as the main OldStar app, but deploys
as its **own, separate** Vercel project:

1. In Vercel, click **Add New → Project**, pick the same `Oldstarops` GitHub
   repo again (you can connect one repo to multiple Vercel projects).
2. In the import screen, expand **Root Directory** and set it to `bosta-mcp`.
3. Add two environment variables (Settings → Environment Variables):
   - `BOSTA_API_KEY` — your Bosta API key (same one the main app uses).
   - `MCP_ACCESS_TOKEN` — make up a new random secret string (this is the
     password Claude needs to use this server — don't reuse CRON_SECRET from
     the other project).
4. Deploy. You'll get a URL like `https://bosta-mcp-xxxx.vercel.app`.

## Connect it to Claude Code

Add to `.mcp.json` in whatever project you want this available in:

```json
{
  "mcpServers": {
    "bosta": {
      "url": "https://bosta-mcp-xxxx.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_ACCESS_TOKEN"
      }
    }
  }
}
```

## Connect it to claude.ai (web/app)

Settings → Connectors → Add custom connector → paste the
`https://bosta-mcp-xxxx.vercel.app/api/mcp` URL. Header-based auth support
varies by client version — if claude.ai doesn't prompt for a header, this
server will reject it (401) until that's supported; Claude Code's
`.mcp.json` config above is the reliable path today.

## Tools

- `search_deliveries` — filter by tracking number, phone, or business
  reference (Shopify order number).
- `get_delivery` — full detail for one tracking number, including the real
  `collectedAmount` / `expectedCashoutDate` fields (not Bosta's always-empty
  `pricing` object).

## Local dev

```
npm install
cp .env.example .env.local   # fill in both values
npm run dev
```

Server runs at `http://localhost:3000/api/mcp`.
