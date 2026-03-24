# Vantage

**Don't lose what you learn in AI. Capture it, and actually use it later.**

Vantage is a personal signal store for AI-native work — a place to save and query the things that matter as you discover them.

Built by Cavendo AI.

A quote on X. A competitor move on LinkedIn. An analyst take buried in a thread. Instead of losing it to chat history, you save it. Tag it. Search it later. Ask your agent what's happening.

It's not a scraper. Not a feed. Not a knowledge base.
It's a place to keep track of what's actually happening — built from signals you chose to save, not noise an algorithm decided was relevant.

**API-first. MCP-first.** Designed to be consumed by agents, MCP clients, and automation tools rather than a traditional web UI.

---

## Why This Exists

Most tools either:
- require you to organize knowledge manually (Notion, Obsidian)
- or try to collect everything automatically (feeds, scrapers)

Vantage does neither.

You capture what matters, in the moment, while you're already thinking.

---

## Why Manual Capture Matters

Every signal in Vantage is something you deliberately saved. That's not a limitation — it's the design.

Manual capture filters for intent. If you saved it, it mattered — which means your dataset starts clean and stays clean. No noise, no algorithmic clutter, no dashboard you stop checking after a week.

The AI does the analysis. Vantage does the remembering.

---

## What It Does

- **Capture signals** — posts, articles, screenshots, quotes, threads from X, LinkedIn, web, Reddit, wherever you find them
- **Track sources** — who said it, their background, credibility, platform handles
- **Organize by topic** — tag and categorize signals, build collections for research threads
- **Attach business context** — optional strategy docs or positioning you want to compare signals against
- **Analyze** — compare market signals against your business context for validation, stress testing, trend analysis
- **Dashboard** — signal counts, top topics, top sources, highlights at a glance

---

## How It Works (In Practice)

You're in a conversation with Claude. Someone posts something interesting. You say:

> "Save this as a signal — Lemkin says agent ops is a real job now, 30% of Chief AI Officer time is monitoring not building. Saw it on X."

Vantage captures it, tags it, attributes the source. Done.

Later, you ask:

> "What's the market been saying about AI pricing models?"

Vantage searches your signals, returns what you've collected, and your agent synthesizes the pattern.

Then:

> "How does this line up with our positioning? Check it against our business context."

Vantage pulls your strategy doc, assembles the relevant signals, and your agent runs the analysis.

You didn't build a system. You just paid attention — and now your agent can use it.

---

## Quick Start

### Option 1: Use the hosted version (fastest)

Sign up at [vantage.cavendo.ai](https://vantage.cavendo.ai). Get an API key, connect your MCP client, start capturing.

Takes about 2 minutes. No install required.

---

### Option 2: Run locally

```bash
# Install dependencies
npm install

# Start the server (SQLite, development mode)
npm run dev

# Generate an API key
curl -X POST http://localhost:3020/api/auth/keys \
  -H 'Content-Type: application/json' \
  -d '{"name": "my-key"}'
# Save the returned key — it's only shown once
```

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

That's it. You're capturing.

---

## MCP Server

Vantage includes an MCP server that exposes 13 tools for use with Claude, Claude Code, Cursor, or any MCP-compatible client. Most users never touch the API or UI — they interact with Vantage entirely through natural language in their AI conversations.

### Setup

```bash
# Install MCP server dependencies
cd mcp-server && npm install && cd ..
```

### Claude Code Configuration

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "vantage": {
      "command": "node",
      "args": ["/path/to/signals/mcp-server/src/index.js"],
      "env": {
        "VANTAGE_API_URL": "http://localhost:3020",
        "VANTAGE_API_KEY": "vtg_YOUR_KEY_HERE"
      }
    }
  }
}
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "vantage": {
      "command": "node",
      "args": ["/path/to/signals/mcp-server/src/index.js"],
      "env": {
        "VANTAGE_API_URL": "http://localhost:3020",
        "VANTAGE_API_KEY": "vtg_YOUR_KEY_HERE"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | What it does |
|------|-------------|
| `capture_signal` | Save a post, article, quote, or discussion. Auto-creates sources and topics. |
| `search_signals` | Full-text search with filters — platform, topic, date range, importance. |
| `list_recent_signals` | Latest signals feed. What have you captured recently? |
| `get_signal` | Full detail on a specific signal — source, topics, images. |
| `manage_source` | Create or update a person/account you're tracking. |
| `list_sources` | See everyone you're tracking and how many signals each has. |
| `manage_topic` | Create or update a topic/theme for organizing signals. |
| `list_topics` | See all your topics and their signal counts. |
| `manage_collection` | Group signals into named collections for focused research. |
| `set_business_context` | Upload your strategy doc, roadmap, or positioning for comparison. |
| `analyze_signals` | Assemble signals + business context into a structured payload for your agent to analyze. |
| `get_dashboard` | Summary view — counts, top topics, top sources, highlights. |
| `save_analysis` | Persist an analysis so you can reference it later. |

---

## REST API

Every MCP tool is backed by a REST endpoint. If you're building your own integrations, automations, or clients, the full API is available.

### Authentication

All requests require an API key in the `Authorization` header:

```
Authorization: Bearer vtg_YOUR_KEY_HERE
```

API keys are hashed (SHA-256) before storage. The raw key is only shown once at creation.

### Core Endpoints

**Signals**
- `POST /api/signals` — Create a signal (supports image uploads via multipart)
- `GET /api/signals` — List signals with pagination
- `GET /api/signals/search?q=query` — Full-text search with optional filters
- `GET /api/signals/feed` — Chronological feed
- `GET /api/signals/:id` — Get signal detail
- `PUT /api/signals/:id` — Update a signal
- `DELETE /api/signals/:id` — Delete a signal

**Sources**
- `POST /api/sources` — Create a source
- `GET /api/sources` — List sources with signal counts
- `GET /api/sources/:id` — Get source detail
- `PUT /api/sources/:id` — Update a source

**Topics**
- `POST /api/topics` — Create a topic
- `GET /api/topics` — List topics with signal counts
- `GET /api/topics/:id` — Get topic detail
- `PUT /api/topics/:id` — Update a topic
- `DELETE /api/topics/:id` — Delete a topic
- `GET /api/topics/:id/signals` — List signals for a topic

**Collections**
- `POST /api/collections` — Create a collection
- `GET /api/collections` — List collections
- `POST /api/collections/:id/signals` — Add signal to collection
- `DELETE /api/collections/:id/signals/:signalId` — Remove signal from collection

**Business Context**
- `POST /api/contexts` — Upload business context (strategy docs, positioning, etc.)
- `GET /api/contexts` — List contexts
- `PUT /api/contexts/:id` — Update context
- `DELETE /api/contexts/:id` — Delete context

**Analysis**
- `POST /api/analyses` — Save an analysis
- `GET /api/analyses` — List saved analyses
- `GET /api/analyses/:id` — Get analysis detail

**Dashboard**
- `GET /api/dashboard/summary` — Summary stats, top topics, top sources, recent highlights
- `GET /api/dashboard/timeline` — Signals over time (for charting)

**Auth**
- `POST /api/auth/keys` — Generate a new API key

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+ / Express / ESM |
| Database | SQLite via better-sqlite3 (development) |
| Validation | Zod |
| Auth | API key with `vtg_` prefix, SHA-256 hashed at rest |
| Images | Multer (local filesystem) |
| MCP | @modelcontextprotocol/sdk (stdio + Streamable HTTP transports) |

---

## Project Structure

```
├── server/
│   ├── index.js              # Entry point
│   ├── app.js                # Express app factory
│   ├── mcp.js                # MCP Streamable HTTP transport (remote access)
│   ├── env.js                # Environment config
│   ├── db/
│   │   ├── adapter.js        # DB adapter factory
│   │   ├── connection.js     # SQLite connection
│   │   ├── sqliteAdapter.js  # Async API over better-sqlite3
│   │   ├── schema.sql        # Database schema
│   │   └── init.js           # DB initialization
│   ├── middleware/
│   │   ├── apiKeyAuth.js     # API key auth + key generation
│   │   └── security.js       # Rate limiting, security headers
│   ├── routes/
│   │   ├── signals.js        # Signal CRUD + images + feed + search
│   │   ├── sources.js        # Source CRUD
│   │   ├── topics.js         # Topic CRUD + signal tagging
│   │   ├── collections.js    # Collection CRUD + signal membership
│   │   ├── contexts.js       # Business context CRUD
│   │   ├── analyses.js       # Analysis CRUD
│   │   ├── dashboard.js      # Summary + timeline
│   │   └── auth.js           # API key management
│   └── utils/
│       ├── validation.js     # Zod schemas + validation middleware
│       ├── response.js       # Standardized response helpers
│       ├── transform.js      # snake_case ↔ camelCase transforms
│       └── images.js         # Multer config for image uploads
├── mcp-server/
│   └── src/
│       ├── index.js          # MCP server (stdio transport)
│       ├── tools.js          # Shared MCP tool definitions
│       └── api/
│           └── vantageClient.js  # HTTP client for the REST API
└── data/                     # SQLite database (gitignored)
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3020` | Server port |
| `NODE_ENV` | `development` | Environment |
| `DB_DRIVER` | `sqlite` | Database driver |
| `ALLOW_SQLITE` | `true` | Allow SQLite (required for dev) |
| `DATABASE_PATH` | `./data/vantage.db` | SQLite file path |
| `CORS_ORIGIN` | `*` | CORS allowed origin |

---

## What Vantage Is Not

To save you time if you're evaluating this:

- **Not a monitoring tool.** It doesn't watch feeds or scrape the web. You decide what's worth saving.
- **Not a knowledge base.** There's no wiki to maintain, no folders to organize, no documents to curate.
- **Not a second brain.** You're not building a system to manage. You're capturing signals as they happen.
- **Not a dashboard product.** The dashboard exists, but the primary interface is your AI conversation.
- **Not a team tool.** Vantage is personal. Your signals, your context, your analysis.

If you want automated monitoring, RSS-to-database pipelines, or collaborative intelligence — those are different products. Vantage does one thing: it remembers what you noticed, so your agent can use it later.

---

## Part of the Cavendo AI Ecosystem

Vantage captures signals. [Cavendo AI](https://cavendo.ai) uses them in workflows.

If you want to turn what you're seeing into actual outputs — content, reports, decisions — that's where Cavendo comes in. Your signals are already there. No migration, no re-uploading. Just connect your workspace and start using what you've collected.

---

## License

MIT — use it however you want.

---

## Contributing

Issues and PRs welcome. If you're building an MCP client that works with Vantage, we'd love to hear about it.

---

Built by [Cavendo AI](https://cavendo.ai).