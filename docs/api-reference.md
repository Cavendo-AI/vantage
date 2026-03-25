# Vantage API Reference

Base URL: `http://localhost:3020`

All endpoints except `/health` and `POST /api/auth/keys` require authentication via API key:

```
Authorization: Bearer vtg_YOUR_KEY_HERE
```

All responses follow this format:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Description" } }
```

Response keys are camelCase. Request bodies accept camelCase.

---

## Health

### `GET /health`

No auth required.

```json
{ "status": "ok", "version": "0.1.0" }
```

---

## Auth

### `POST /api/auth/keys`

Generate a new API key.

- First key bootstrap is only allowed from localhost by default.
- For remote bootstrap, set `VANTAGE_BOOTSTRAP_TOKEN` on the server and send the same value in `X-Vantage-Bootstrap-Token`.
- Once any active key exists, creating additional keys requires an authenticated API key with `write` scope.

```json
// Request
{ "name": "my-key", "scopes": ["read", "write"] }

// Response
{
  "id": 1,
  "key": "vtg_abc123...",
  "prefix": "vtg_abc123def45",
  "name": "my-key",
  "scopes": ["read", "write"],
  "note": "Save this key — it will not be shown again."
}
```

### `GET /api/auth/keys`

List API keys (prefix only, never the full key). Requires `read` scope.

### `DELETE /api/auth/keys/:id`

Revoke an API key. Requires `write` scope.

---

## Signals

### `POST /api/signals`

Capture a new signal. Requires `write` scope.

```json
{
  "signalType": "post",           // Required: post, article, screenshot, quote, thread, comment, report, other
  "content": "The signal text",   // Required
  "sourceId": 1,                  // Optional: link to existing source
  "platform": "x",               // Optional: x, linkedin, web, reddit, hackernews, etc.
  "title": "Optional headline",
  "sourceUrl": "https://...",     // Must be http/https
  "publishedAt": "2026-03-24T10:00:00Z", // ISO datetime with timezone
  "sentiment": "positive",       // positive, negative, neutral, mixed
  "importance": "high",          // critical, high, normal, low
  "topics": ["AI Agents", "SaaS"],  // Auto-creates topics if new
  "rawData": {},                  // Extensible JSON
  "metadata": {}                  // Extensible JSON
}
```

### `GET /api/signals`

List signals with filtering. Requires `read` scope.

Query params:
- `limit` (default 50), `offset` (default 0)
- `sourceId`, `signalType`, `platform`, `importance`
- `topic` — filter by topic name or slug
- `since`, `until` — date range (ISO strings)
- `q` — text search in content and title

### `GET /api/signals/feed`

Latest signals with source info and topics. Requires `read` scope.

Query params: `limit` (default 20, max 100), `since`

### `GET /api/signals/search`

Search signals by keyword. Requires `read` scope.

Query params: `q` (required), `limit` (default 20)

### `GET /api/signals/:id`

Get signal with full relations (source details, topics, images). Requires `read` scope.

### `PUT /api/signals/:id`

Update a signal. Requires `write` scope. Accepts same fields as create (all optional). Setting `topics` replaces all topic associations.

### `DELETE /api/signals/:id`

Delete a signal and its images. Requires `write` scope.

### `POST /api/signals/:id/images`

Upload a screenshot/image. Requires `write` scope. Multipart form data:
- `image` — file (PNG, JPEG, GIF, or WebP; max 10MB). File contents are validated server-side.
- `caption` — optional text

### `DELETE /api/signals/:id/images/:imageId`

Delete an image. Requires `write` scope.

### `POST /api/signals/bulk`

Capture up to 50 signals at once. Requires `write` scope.

```json
{
  "signals": [
    { "signalType": "post", "content": "...", "platform": "x" },
    { "signalType": "article", "content": "...", "platform": "web" }
  ]
}
```

---

## Sources

### `POST /api/sources`

Create a source (person/account). Requires `write` scope.

```json
{
  "name": "Marc Andreessen",       // Required
  "bio": "Co-founder of a16z",
  "organization": "a16z",
  "credibility": "authority",      // authority, practitioner, commentator, unknown
  "platformHandles": { "x": "@pmarca", "linkedin": "marcandreessen" },
  "avatarUrl": "https://...",
  "notes": "Key voice in VC/tech",
  "metadata": {}
}
```

### `GET /api/sources`

List sources with signal counts. Query: `limit`, `offset`.

### `GET /api/sources/:id`

Get source with signal count.

### `PUT /api/sources/:id`

Update source. Accepts same fields (all optional).

### `DELETE /api/sources/:id`

Delete source. Signals from this source are preserved (source_id set to null).

### `GET /api/sources/:id/signals`

List signals from this source (latest 100).

---

## Topics

### `POST /api/topics`

Create a topic. Slug auto-generated from name.

```json
{
  "name": "AI Agents",             // Required
  "description": "Autonomous AI agents in enterprise",
  "color": "#FF5733",
  "parentId": null                 // For hierarchical topics
}
```

### `GET /api/topics`

List all topics with signal counts.

### `GET /api/topics/:id`

Get topic with signal count.

### `PUT /api/topics/:id`

Update topic.

### `DELETE /api/topics/:id`

Delete topic. Signal associations are removed.

### `GET /api/topics/:id/signals`

List signals tagged with this topic (latest 100).

---

## Collections

### `POST /api/collections`

Create a collection.

```json
{
  "name": "PMF Validation Q1 2026",  // Required
  "description": "Signals supporting product-market fit",
  "purpose": "market_validation",
  "metadata": {}
}
```

### `GET /api/collections`

List collections with signal counts.

### `GET /api/collections/:id`

Get collection with all its signals (including source info).

### `PUT /api/collections/:id`

Update collection. Supports `status: "archived"`.

### `DELETE /api/collections/:id`

Delete collection. Signals are preserved.

### `POST /api/collections/:id/signals`

Add a signal to a collection.

```json
{ "signalId": 1, "notes": "Key signal from major VC" }
```

### `DELETE /api/collections/:id/signals/:signalId`

Remove a signal from a collection.

---

## Business Contexts

### `POST /api/contexts`

Store a business strategy document.

```json
{
  "title": "Go-to-Market Strategy",   // Required
  "contextType": "strategy",          // Required: strategy, roadmap, positioning, persona, competitor_profile, thesis, other
  "content": "# Our Strategy\n...",   // Required (markdown)
  "status": "active",                 // active, archived, draft
  "metadata": {}
}
```

### `GET /api/contexts`

List active contexts (excludes archived).

### `GET /api/contexts/:id`

Get context.

### `PUT /api/contexts/:id`

Update context. Updating `content` auto-increments the version number.

### `DELETE /api/contexts/:id`

Delete context.

---

## Analyses

### `POST /api/analyses`

Save an analysis.

```json
{
  "title": "Q1 Market Validation",    // Required
  "analysisType": "validation",       // Required: validation, stress_test, trend, competitive, opportunity, risk, summary, custom
  "content": "# Analysis\n...",       // Required (markdown)
  "methodology": "Compared 47 signals against GTM strategy",
  "businessContextId": 1,
  "collectionId": 1,
  "signalIds": [1, 2, 3],
  "model": "claude-opus-4-6",
  "provider": "anthropic",
  "inputTokens": 15000,
  "outputTokens": 3000,
  "metadata": {}
}
```

### `GET /api/analyses`

List all analyses.

### `GET /api/analyses/:id`

Get analysis.

### `DELETE /api/analyses/:id`

Delete analysis.

---

## Dashboard

### `GET /api/dashboard/summary`

Get intelligence summary. Query: `period` (`7d`, `30d`, `90d`; default `7d`).

Returns:
- Total and recent signal counts
- Signals by platform
- Top 10 topics by signal count
- Top 10 sources by signal count
- Recent critical/high importance signals

### `GET /api/dashboard/timeline`

Signals over time. Query: `days` (default 30).

Returns array of `{ date, count }` for charting.

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Insufficient scope |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Request body failed validation |
| `BAD_REQUEST` | 400 | Malformed request |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests (200/min) |
| `INTERNAL_ERROR` | 500 | Server error |
