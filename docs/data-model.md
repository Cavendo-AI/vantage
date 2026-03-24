# Vantage Data Model

## Entity Relationship

```
Sources ─────< Signals >───── Signal Topics >───── Topics
                  │                                   │
                  │                                   └── parent_id (self-ref)
                  │
                  ├──< Signal Images
                  │
                  └──< Collection Signals >───── Collections

Business Contexts ──< Analyses >── Collections
                                    │
                                    └── signal_ids (JSON array)
```

## Tables

### sources

People and accounts who produce signals.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT NOT NULL | Display name |
| bio | TEXT | Short description, title, or role |
| organization | TEXT | Company, outlet, institution |
| credibility | TEXT | `authority`, `practitioner`, `commentator`, `unknown` |
| platform_handles | TEXT (JSON) | `{"x": "@handle", "linkedin": "url"}` |
| avatar_url | TEXT | Profile image URL |
| notes | TEXT | Freeform notes |
| metadata | TEXT (JSON) | Extensible |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

### signals

Individual captured items — the core entity.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| source_id | INTEGER FK → sources | Who posted it (nullable) |
| signal_type | TEXT NOT NULL | `post`, `article`, `screenshot`, `quote`, `thread`, `comment`, `report`, `other` |
| platform | TEXT | `x`, `linkedin`, `web`, `reddit`, `hackernews`, `manual`, etc. |
| title | TEXT | Optional headline |
| content | TEXT NOT NULL | The actual text content |
| source_url | TEXT | Link to the original |
| published_at | TEXT | When the original was published |
| captured_at | TEXT | When ingested into Vantage (auto-set) |
| sentiment | TEXT | `positive`, `negative`, `neutral`, `mixed` |
| importance | TEXT | `critical`, `high`, `normal`, `low` |
| raw_data | TEXT (JSON) | Original API payload, embed data |
| metadata | TEXT (JSON) | Extensible |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

### signal_images

Screenshots and media attached to signals.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| signal_id | INTEGER FK → signals | CASCADE on delete |
| filename | TEXT NOT NULL | Original filename |
| file_path | TEXT NOT NULL | Relative path in uploads/ |
| mime_type | TEXT | Default `image/png` |
| file_size | INTEGER | Bytes |
| caption | TEXT | Optional description |
| sort_order | INTEGER | Display ordering |
| created_at | TEXT | ISO datetime |

### topics

Tagging and categorization themes. Supports hierarchy via parent_id.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT UNIQUE | Display name |
| slug | TEXT UNIQUE | URL-safe identifier (auto-generated) |
| description | TEXT | What this topic covers |
| color | TEXT | Hex color for UI |
| parent_id | INTEGER FK → topics | For hierarchical topics |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

### signal_topics

Many-to-many junction between signals and topics.

| Column | Type | Description |
|--------|------|-------------|
| signal_id | INTEGER FK → signals | CASCADE on delete |
| topic_id | INTEGER FK → topics | CASCADE on delete |

### collections

Groupings of signals for specific research purposes.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT NOT NULL | Collection name |
| description | TEXT | What this collection is for |
| purpose | TEXT | e.g. `competitor_tracking`, `market_validation` |
| status | TEXT | `active`, `archived` |
| metadata | TEXT (JSON) | Extensible |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

### collection_signals

Many-to-many junction between collections and signals.

| Column | Type | Description |
|--------|------|-------------|
| collection_id | INTEGER FK → collections | CASCADE on delete |
| signal_id | INTEGER FK → signals | CASCADE on delete |
| added_at | TEXT | When the signal was added |
| notes | TEXT | Why this signal was added |

### business_contexts

Your own strategy documents, roadmaps, and positioning used as comparison basis.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| title | TEXT NOT NULL | Document title |
| context_type | TEXT NOT NULL | `strategy`, `roadmap`, `positioning`, `persona`, `competitor_profile`, `thesis`, `other` |
| content | TEXT NOT NULL | Markdown content |
| version | INTEGER | Auto-incremented on content update |
| status | TEXT | `active`, `archived`, `draft` |
| metadata | TEXT (JSON) | Extensible |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

### analyses

Saved insights and analyses comparing signals against business context.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| title | TEXT NOT NULL | Analysis title |
| analysis_type | TEXT NOT NULL | `validation`, `stress_test`, `trend`, `competitive`, `opportunity`, `risk`, `summary`, `custom` |
| content | TEXT NOT NULL | The analysis (markdown) |
| methodology | TEXT | How the analysis was performed |
| business_context_id | INTEGER FK | Business context compared against |
| collection_id | INTEGER FK | Collection analyzed |
| signal_ids | TEXT (JSON) | Array of signal IDs used |
| model | TEXT | LLM model used |
| provider | TEXT | AI provider |
| input_tokens | INTEGER | Token usage tracking |
| output_tokens | INTEGER | Token usage tracking |
| metadata | TEXT (JSON) | Extensible |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

### api_keys

Authentication keys.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| key_hash | TEXT NOT NULL | SHA-256 hash of the key |
| key_prefix | TEXT NOT NULL | First 15 chars for identification |
| name | TEXT | Human-readable label |
| scopes | TEXT (JSON) | `["read", "write"]` |
| last_used_at | TEXT | Last API call timestamp |
| expires_at | TEXT | Optional expiry |
| revoked_at | TEXT | Set when revoked |
| created_at | TEXT | ISO datetime |

## Design Notes

- All JSON fields are stored as TEXT and parsed on read
- Timestamps use SQLite `datetime('now')` defaults (ISO 8601)
- Foreign keys use `ON DELETE SET NULL` (preserve signals when source deleted) or `ON DELETE CASCADE` (clean up junctions)
- The `metadata` JSON field on most tables provides extensibility without schema changes
- Topics auto-generate slugs from names for URL-safe filtering
- Signals can exist without a source (anonymous captures)
