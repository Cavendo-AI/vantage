---
name: vantage-shared-intel
description: Capture, search, and summarize shared market/customer intelligence in Vantage so the same intel is reusable across OpenClaw, Claude, ChatGPT, and other MCP clients. Use when the user asks to save signals (posts/articles/quotes), retrieve prior intel by topic/source/date, generate digests/briefings, or build a cross-chatbot shared memory workflow.
---

# Vantage Shared Intel

Use Vantage as the canonical external-intel store. Keep this skill focused on operational workflows:
- ingest signal
- retrieve signal(s)
- summarize + action
- keep data portable across AI clients

## Required inputs

Set these in shell commands (or source from env):
- `VANTAGE_API_URL` (example: `http://localhost:3020`)
- `VANTAGE_API_KEY` (`vtg_...`)

Example:

```bash
export VANTAGE_API_URL="http://localhost:3020"
export VANTAGE_API_KEY="vtg_..."
```

## Core workflows

### 1) Capture a signal

Use when user says "save this", "track this post/article", "add this intel".

```bash
curl -sS -X POST "$VANTAGE_API_URL/api/signals" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $VANTAGE_API_KEY" \
  -d '{
    "signalType": "post",
    "platform": "x",
    "content": "<signal text>",
    "sourceUrl": "https://...",
    "importance": "high",
    "topics": ["AI Agents", "Pricing"]
  }'
```

Capture standards:
- Always include `platform`, `content`, `sourceUrl` when known
- Add 1-3 `topics`
- Set `importance` (`critical|high|normal|low`)

### 2) Search existing intel

Use when user asks "what do we already know about X?".

```bash
curl -sS "$VANTAGE_API_URL/api/signals/search?q=<query>" \
  -H "Authorization: Bearer $VANTAGE_API_KEY"
```

Optional filtered listing:

```bash
curl -sS "$VANTAGE_API_URL/api/signals?platform=x&importance=high&limit=20" \
  -H "Authorization: Bearer $VANTAGE_API_KEY"
```

### 3) Get digest/dashboard summary

Use for daily/weekly briefs.

```bash
curl -sS "$VANTAGE_API_URL/api/dashboard/summary?period=7d" \
  -H "Authorization: Bearer $VANTAGE_API_KEY"
```

Then provide:
- top topics
- top sources/platforms
- notable high/critical signals
- suggested next actions

### 4) Bootstrap key (first local setup)

Only for first-time setup:

```bash
curl -sS -X POST "$VANTAGE_API_URL/api/auth/keys" \
  -H 'Content-Type: application/json' \
  -d '{"name":"openclaw"}'
```

Note:
- first key bootstrap works localhost-only unless `X-Vantage-Bootstrap-Token` is configured
- key is returned once; tell user to store it securely

## OpenClaw integration pattern

Use this pattern for shared intel across chatbots:

1. **Ingest with OpenClaw** from links/messages/web research into Vantage
2. **Tag consistently** (`topic`, `importance`, source attribution)
3. **Query from any AI** (OpenClaw, Claude, ChatGPT MCP client) against same Vantage dataset
4. **Report back in OpenClaw** with concise "what changed + what to do"

## Recommended automations

Use cron jobs for regular summaries:
- Morning: `dashboard/summary?period=7d`
- Midday: new high/critical signals since morning
- Evening: trend shift summary + tomorrow priorities

## Response style

When returning intel to user:
- include short headline summary
- include 3-7 bullet insights
- include sources/links when available
- end with clear recommendation or next action
