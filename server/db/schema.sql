-- Vantage: Market Intelligence Schema

-- Sources: people/accounts who produce signals
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    bio TEXT,
    organization TEXT,
    credibility TEXT DEFAULT 'unknown' CHECK (credibility IN ('authority', 'practitioner', 'commentator', 'unknown')),
    platform_handles TEXT,
    avatar_url TEXT,
    notes TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Signals: individual captured items
CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
    signal_type TEXT NOT NULL CHECK (signal_type IN ('post', 'article', 'screenshot', 'quote', 'thread', 'comment', 'report', 'other')),
    platform TEXT,
    title TEXT,
    content TEXT NOT NULL,
    source_url TEXT,
    published_at TEXT,
    captured_at TEXT DEFAULT (datetime('now')),
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed') OR sentiment IS NULL),
    importance TEXT DEFAULT 'normal' CHECK (importance IN ('critical', 'high', 'normal', 'low')),
    raw_data TEXT,
    metadata TEXT,
    signal_number INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Signal images: screenshots and media attached to signals
CREATE TABLE IF NOT EXISTS signal_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id INTEGER NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT DEFAULT 'image/png',
    file_size INTEGER,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Topics: tagging / categorization themes
CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT,
    parent_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Signal-topic junction (many-to-many)
CREATE TABLE IF NOT EXISTS signal_topics (
    signal_id INTEGER NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (signal_id, topic_id)
);

-- Collections: groupings of signals for research purposes
CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    purpose TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Signal-collection junction
CREATE TABLE IF NOT EXISTS collection_signals (
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    signal_id INTEGER NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    added_at TEXT DEFAULT (datetime('now')),
    notes TEXT,
    PRIMARY KEY (collection_id, signal_id)
);

-- Business context: strategy docs, roadmaps, positioning
CREATE TABLE IF NOT EXISTS business_contexts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    context_type TEXT NOT NULL CHECK (context_type IN ('strategy', 'roadmap', 'positioning', 'persona', 'competitor_profile', 'thesis', 'other')),
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Analyses: saved insights comparing signals against business context
CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('validation', 'stress_test', 'trend', 'competitive', 'opportunity', 'risk', 'summary', 'custom')),
    content TEXT NOT NULL,
    methodology TEXT,
    business_context_id INTEGER REFERENCES business_contexts(id) ON DELETE SET NULL,
    collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
    signal_ids TEXT,
    model TEXT,
    provider TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- API keys
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    name TEXT,
    scopes TEXT DEFAULT '["read","write"]',
    last_used_at TEXT,
    expires_at TEXT,
    revoked_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_signals_source ON signals(source_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_signals_platform ON signals(platform);
CREATE INDEX IF NOT EXISTS idx_signals_captured ON signals(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_published ON signals(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_importance ON signals(importance);
CREATE INDEX IF NOT EXISTS idx_signal_images_signal ON signal_images(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_topics_signal ON signal_topics(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_topics_topic ON signal_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_collection_signals_collection ON collection_signals(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_signals_signal ON collection_signals(signal_id);
CREATE INDEX IF NOT EXISTS idx_analyses_type ON analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analyses_context ON analyses(business_context_id);
CREATE INDEX IF NOT EXISTS idx_analyses_collection ON analyses(collection_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_topics_slug ON topics(slug);
CREATE INDEX IF NOT EXISTS idx_sources_name ON sources(name);
