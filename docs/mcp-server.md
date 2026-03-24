# Vantage MCP Server

The MCP server exposes Vantage's capabilities as tools for LLM-based agents. It connects to the Vantage REST API over HTTP and translates tool calls into API requests.

## Setup

### Prerequisites

1. Vantage API server running (`npm run dev` from project root)
2. An API key generated via `POST /api/auth/keys`

### Install

```bash
cd mcp-server
npm install
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VANTAGE_API_KEY` | Yes | — | Your Vantage API key (`vtg_...`) |
| `VANTAGE_API_URL` | No | `http://localhost:3020` | Vantage API base URL |

### Claude Code Configuration

Add to your MCP settings (e.g. `~/.claude/settings.json` or project-level):

```json
{
  "mcpServers": {
    "vantage": {
      "command": "node",
      "args": ["/absolute/path/to/signals/mcp-server/src/index.js"],
      "env": {
        "VANTAGE_API_URL": "http://localhost:3020",
        "VANTAGE_API_KEY": "vtg_YOUR_KEY_HERE"
      }
    }
  }
}
```

## Tools

### capture_signal

The primary ingestion tool. Capture a market signal with full attribution.

**Key behavior**: If `source_name` is provided and no matching source exists, one is automatically created.

```
Inputs:
  content       (required)  The text content of the signal
  signal_type   (optional)  post, article, screenshot, quote, thread, comment, report, other (default: post)
  platform      (optional)  x, linkedin, web, reddit, hackernews, etc.
  title         (optional)  Headline or summary
  source_url    (optional)  Link to the original
  source_name   (optional)  Name of the person who posted
  source_bio    (optional)  Bio/role (used when auto-creating source)
  source_org    (optional)  Organization (used when auto-creating source)
  published_at  (optional)  When the original was published (ISO datetime)
  topics        (optional)  Array of topic names to tag
  importance    (optional)  critical, high, normal, low (default: normal)
  sentiment     (optional)  positive, negative, neutral, mixed
```

### search_signals

Full-text search across all captured signals.

```
Inputs:
  query         (required)  Search query
  platform      (optional)  Filter by platform
  topic         (optional)  Filter by topic name or slug
  importance    (optional)  Filter by importance
  since         (optional)  Signals captured after this date
  until         (optional)  Signals captured before this date
  limit         (optional)  Max results (default: 20)
```

### list_recent_signals

Get the latest signals — what's new.

```
Inputs:
  limit         (optional)  Max results (default: 20)
  platform      (optional)  Filter by platform
  topic         (optional)  Filter by topic
  since         (optional)  Only signals after this datetime
```

### get_signal

Get full detail on a specific signal including source info, topics, and attached images.

```
Inputs:
  signal_id     (required)  Signal ID
```

### manage_source

Create or update a source (person/account) profile. If a source with the given name exists, it's updated; otherwise a new one is created.

```
Inputs:
  name              (required)  Name of the person/account
  bio               (optional)  Bio, title, or role
  organization      (optional)  Company or outlet
  credibility       (optional)  authority, practitioner, commentator, unknown
  platform_handles  (optional)  Object: {"x": "@handle", "linkedin": "url"}
  notes             (optional)  Freeform notes
```

### list_sources

List tracked people/accounts with their signal counts.

```
Inputs:
  limit         (optional)  Max results (default: 50)
```

### manage_topic

Create or update a topic/theme for categorizing signals.

```
Inputs:
  name          (required)  Topic name
  description   (optional)  What this topic covers
  color         (optional)  Hex color (e.g. #FF5733)
```

### list_topics

List all topics with their signal counts.

```
Inputs: (none)
```

### manage_collection

Create a collection, or add/remove signals from one.

```
Inputs:
  action          (required)  create, add_signal, remove_signal
  name            (optional)  Collection name (for create)
  description     (optional)  Description (for create)
  purpose         (optional)  Purpose (for create)
  collection_id   (optional)  Collection ID (for add/remove)
  signal_id       (optional)  Signal ID (for add/remove)
  notes           (optional)  Why this signal was added
```

### set_business_context

Upload a business strategy document for comparison against market signals.

```
Inputs:
  title         (required)  Document title
  context_type  (required)  strategy, roadmap, positioning, persona, competitor_profile, thesis, other
  content       (required)  Document content (markdown)
```

### analyze_signals

Assemble signals and business context into a structured payload for analysis. **Does not call an LLM** — gathers the data for the MCP client (which is an LLM) to reason over.

```
Inputs:
  analysis_type       (required)  validation, stress_test, trend, competitive, opportunity, risk, summary, custom
  collection_id       (optional)  Analyze signals from this collection
  topic               (optional)  Analyze signals with this topic
  signal_ids          (optional)  Specific signal IDs to analyze
  business_context_id (optional)  Business context to compare against
  question            (optional)  Specific question to answer
```

### get_dashboard

Get a summary of market signal intelligence.

```
Inputs:
  period        (optional)  7d, 30d, 90d (default: 7d)
```

### save_analysis

Persist an analysis for future reference.

```
Inputs:
  title               (required)  Analysis title
  analysis_type       (required)  validation, stress_test, trend, competitive, opportunity, risk, summary, custom
  content             (required)  The analysis (markdown)
  signal_ids          (optional)  Signal IDs used
  business_context_id (optional)  Business context ID
  collection_id       (optional)  Collection ID
```

## Architecture

The MCP server is a thin client that:

1. Receives tool calls via stdio (MCP protocol)
2. Translates them into HTTP requests to the Vantage REST API
3. Formats responses as text for LLM consumption

This design means:
- The MCP server has no direct database access
- It can run anywhere that can reach the Vantage API
- Multiple MCP clients can connect simultaneously (each hits the shared API)
- The same API key auth protects both REST and MCP access
