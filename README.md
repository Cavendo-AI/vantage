# Vantage

Market intelligence and signal monitoring platform. Capture, organize, and analyze what key people are saying about the topics that matter to your business.

Vantage is **API-first and MCP-first** — designed to be consumed by agents, MCP clients, and automation tools rather than a traditional web UI.

## What It Does

- **Capture signals** — posts, articles, screenshots, quotes, threads from X, LinkedIn, web, Reddit, etc.
- **Track sources** — who said it, their background, credibility, platform handles
- **Organize by topic** — tag and categorize signals, build collections for research
- **Store business context** — your strategy docs, roadmaps, positioning
- **Analyze** — compare market signals against your business context for validation, stress testing, trend analysis
- **Dashboard** — signal counts, top topics, top sources, highlights at a glance

## Quick Start

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

# Capture your first signal
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

## MCP Server

Vantage includes an MCP server that exposes 13 tools for use with Claude, Claude Code, or any MCP-compatible client.

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

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `capture_signal` | Capture a post, article, quote, or discussion. Auto-creates sources. |
| `search_signals` | Full-text search with filters (platform, topic, date range, importance) |
| `list_recent_signals` | Latest signals feed |
| `get_signal` | Full detail on a signal with source, topics, and images |
| `manage_source` | Create or update a person/account profile |
| `list_sources` | List tracked people with signal counts |
| `manage_topic` | Create or update a topic/theme |
| `list_topics` | List topics with signal counts |
| `manage_collection` | Create collections, add/remove signals |
| `set_business_context` | Upload strategy docs for comparison |
| `analyze_signals` | Assemble signals + context for LLM analysis |
| `get_dashboard` | Summary: counts, top topics, top sources, highlights |
| `save_analysis` | Persist an analysis for future reference |

## Tech Stack

- **Runtime**: Node.js 20+ / Express / ESM
- **Database**: SQLite (development) via better-sqlite3
- **Validation**: Zod
- **Auth**: API key (`vtg_` prefix, SHA-256 hashed)
- **Images**: Multer (local filesystem)
- **MCP**: `@modelcontextprotocol/sdk`

## Project Structure

```
├── server/
│   ├── index.js              # Entry point
│   ├── app.js                # Express app factory
│   ├── env.js                # dotenv loader
│   ├── db/
│   │   ├── adapter.js        # DB adapter factory
│   │   ├── connection.js     # SQLite connection
│   │   ├── sqliteAdapter.js  # Async API over better-sqlite3
│   │   ├── schema.sql        # Database schema
│   │   └── init.js           # Initialization
│   ├── middleware/
│   │   ├── apiKeyAuth.js     # API key auth + generation
│   │   └── security.js       # Rate limiting, headers
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
│       ├── validation.js     # Zod schemas + middleware
│       ├── response.js       # Standardized response helpers
│       ├── transform.js      # snake_case ↔ camelCase
│       └── images.js         # Multer config
├── mcp-server/
│   └── src/
│       ├── index.js          # MCP server (stdio transport)
│       └── api/
│           └── vantageClient.js  # HTTP client for REST API
└── data/                     # SQLite database (gitignored)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Server port |
| `NODE_ENV` | `development` | Environment |
| `DB_DRIVER` | `sqlite` | Database driver |
| `ALLOW_SQLITE` | `true` | Allow SQLite (required for dev) |
| `DATABASE_PATH` | `./data/vantage.db` | SQLite file path |
| `CORS_ORIGIN` | `*` | CORS allowed origin |

## License

Proprietary — Cavendo AI
