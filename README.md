# Vantage

**Track what you're seeing. Use it later.**

Vantage is a personal signal store for AI-native work — a place to capture and query the things you notice across the web.

A post on X. A thread on LinkedIn. An insight from an article. A competitor move.
Instead of losing it across tabs, screenshots, and notes, you save it — and use it later.

---

## One memory layer across all your AI tools

Your AI tools don't share memory.

- Claude doesn't know what you saw on X
- ChatGPT doesn't know what you read yesterday
- Your code tools don't know your research

Vantage fixes that.

Save signals once, and access them anywhere you have an MCP-compatible client — across Claude, Cursor, and other supported tools.

---

## How it works

1. Connect Vantage to your AI (via MCP)
2. Save signals directly from your workflow
3. Ask questions on top of what you've saved

Example:

> "Save this as a signal"

> "What have I saved about pricing?"

> "Show me signals from Lemkin"

---

## What Vantage is (and isn't)

- Not a scraper — you choose what matters
- Not a feed — no noise or algorithmic clutter
- Not a knowledge base — no system to maintain

Vantage is a simple way to keep track of what you're seeing — so your AI can actually use it later.

---

## Hosted + open source

- Free hosted version: [vantage.cavendo.ai](https://vantage.cavendo.ai)
- Self-hosted: MIT licensed, run it anywhere

---

## Quick Start

### Option 1: Use the hosted version (fastest)

Sign up at [vantage.cavendo.ai](https://vantage.cavendo.ai). Connect to Claude or another supported client. Start capturing.

Takes about 2 minutes. No install required.

### Option 2: Run locally

```bash
npm install
npm run dev

# If 3020 is already in use, choose another port
PORT=YOUR_PORT npm run dev

# Generate your first API key
curl -X POST http://localhost:3020/api/auth/keys \
  -H 'Content-Type: application/json' \
  -d '{"name": "my-key"}'
```

The first API key can be created from localhost without auth. If you're bootstrapping a fresh remote deployment, set `VANTAGE_BOOTSTRAP_TOKEN` on the server and send the same value in the `X-Vantage-Bootstrap-Token` header on that first request.
The API key is returned as `data.key` in the JSON response.

Capture your first signal:

```bash
curl -X POST http://localhost:3020/api/signals \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer vtg_YOUR_KEY_HERE' \
  -d '{
    "signalType": "post",
    "platform": "x",
    "content": "Every SaaS company will need an agent layer within 18 months.",
    "topics": ["AI Agents", "SaaS"],
    "importance": "high"
  }'
```

---

## MCP Server

Vantage includes an MCP server with 13 tools for use with Claude, Claude Code, Cursor, or any MCP-compatible client.

If you want to use the bundled stdio MCP server directly, install its dependencies too:

```bash
cd mcp-server
npm install
cd ..
```

### Claude Code

```
claude mcp add vantage --transport http "http://localhost:3020/mcp" --header "Authorization: Bearer vtg_YOUR_KEY"
```

For manual testing, note that `/mcp` is a streamable HTTP endpoint. MCP clients handle the response format automatically, but ad hoc `curl` calls need to be prepared for stream-oriented responses rather than a simple JSON-only request/response flow.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vantage": {
      "command": "node",
      "args": ["/path/to/vantage/mcp-server/src/index.js"],
      "env": {
        "VANTAGE_API_URL": "http://localhost:3020",
        "VANTAGE_API_KEY": "vtg_YOUR_KEY_HERE"
      }
    }
  }
}
```

### MCP Tools

| Tool | What it does |
|------|-------------|
| `capture_signal` | Save a post, article, quote, or discussion. Auto-creates sources and topics. |
| `search_signals` | Full-text search with filters — platform, topic, date range, importance. |
| `list_recent_signals` | Latest signals feed. |
| `get_signal` | Full detail on a specific signal. |
| `manage_source` | Create or update a person/account you're tracking. |
| `list_sources` | See everyone you're tracking with signal counts. |
| `manage_topic` | Create or update a topic/theme. |
| `list_topics` | All topics with signal counts. |
| `manage_collection` | Group signals into named collections. |
| `set_business_context` | Upload strategy docs for comparison. |
| `analyze_signals` | Assemble signals + context for analysis. |
| `get_dashboard` | Summary — counts, top topics, top sources, highlights. |
| `save_analysis` | Persist an analysis for later reference. |

---

## Integrations

- OpenClaw community skill: [vantage-shared-intel](./integrations/openclaw/vantage-shared-intel/SKILL.md) — capture signals, search prior intel, and generate shared digests against the same Vantage dataset from OpenClaw.

---

## REST API

Most API requests require `Authorization: Bearer vtg_YOUR_KEY`.

Exceptions:
- `GET /health`
- `POST /api/auth/keys` for first-key bootstrap from localhost, or from a remote client that supplies a valid `X-Vantage-Bootstrap-Token`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signals` | Create a signal |
| GET | `/api/signals` | List signals with filters |
| GET | `/api/signals/search?q=query` | Full-text search |
| GET | `/api/signals/feed` | Chronological feed |
| GET | `/api/signals/:id` | Signal detail |
| POST | `/api/sources` | Create a source |
| GET | `/api/sources` | List sources |
| POST | `/api/topics` | Create a topic |
| GET | `/api/topics` | List topics |
| POST | `/api/collections` | Create a collection |
| POST | `/api/contexts` | Upload business context |
| GET | `/api/dashboard/summary` | Dashboard summary |
| POST | `/api/auth/keys` | Generate API key |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+ / Express / ESM |
| Database | SQLite via better-sqlite3 |
| Validation | Zod |
| Auth | API key (`vtg_` prefix), SHA-256 hashed |
| MCP | @modelcontextprotocol/sdk (stdio + HTTP) |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3020` | Server port |
| `NODE_ENV` | `development` | Environment |
| `DATABASE_PATH` | `./data/vantage.db` | SQLite file path |
| `CORS_ORIGIN` | `*` | CORS allowed origin |
| `VANTAGE_BOOTSTRAP_TOKEN` | unset | Allows first API key creation from a non-localhost client when sent as `X-Vantage-Bootstrap-Token` |

---

## License

MIT — use it however you want.

---

Built by [Jonathan Arehart](https://x.com/jarehart) at [Cavendo AI](https://cavendo.ai).
