/**
 * Migrate local Vantage SQLite data to cloud Vantage SaaS.
 *
 * Usage: VANTAGE_CLOUD_KEY=vtg_xxx node migrate-to-cloud.js
 */

import Database from 'better-sqlite3';

const CLOUD_URL = 'https://vantage.cavendo.ai';
const API_KEY = process.env.VANTAGE_CLOUD_KEY;

if (!API_KEY) {
  console.error('Set VANTAGE_CLOUD_KEY env var');
  process.exit(1);
}

const db = new Database('./data/vantage.db');

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${CLOUD_URL}${path}`, opts);
  const json = await res.json();
  if (!json.success) throw new Error(`${method} ${path}: ${json.error?.message || res.status}`);
  return json.data;
}

// Track ID mappings (local ID -> cloud ID)
const sourceMap = new Map();
const topicMap = new Map();
const signalMap = new Map();
const collectionMap = new Map();
const contextMap = new Map();

async function run() {
  console.log('=== Migrating to', CLOUD_URL, '===\n');

  // 1. Sources
  const sources = db.prepare('SELECT * FROM sources ORDER BY id').all();
  console.log(`Migrating ${sources.length} sources...`);
  for (const s of sources) {
    const data = await api('POST', '/api/sources', {
      name: s.name,
      bio: s.bio,
      organization: s.organization,
      credibility: s.credibility,
      platformHandles: s.platform_handles ? JSON.parse(s.platform_handles) : null,
      avatarUrl: s.avatar_url,
      notes: s.notes,
      metadata: s.metadata ? JSON.parse(s.metadata) : null
    });
    sourceMap.set(s.id, data.id);
  }
  console.log(`  ✓ ${sources.length} sources migrated\n`);

  // 2. Topics
  const topics = db.prepare('SELECT * FROM topics ORDER BY id').all();
  console.log(`Migrating ${topics.length} topics...`);
  for (const t of topics) {
    try {
      const data = await api('POST', '/api/topics', {
        name: t.name,
        description: t.description,
        color: t.color
      });
      topicMap.set(t.id, data.id);
    } catch (err) {
      // Topic may already exist (duplicate slug)
      console.log(`  ⚠ Skipped topic "${t.name}": ${err.message}`);
    }
  }
  console.log(`  ✓ ${topicMap.size} topics migrated\n`);

  // 3. Signals
  const signals = db.prepare('SELECT * FROM signals ORDER BY id').all();
  console.log(`Migrating ${signals.length} signals...`);
  for (const s of signals) {
    // Get topic names for this signal
    const signalTopics = db.prepare(
      'SELECT t.name FROM signal_topics st JOIN topics t ON st.topic_id = t.id WHERE st.signal_id = ?'
    ).all(s.id);

    const data = await api('POST', '/api/signals', {
      sourceId: s.source_id ? sourceMap.get(s.source_id) : null,
      signalType: s.signal_type,
      platform: s.platform,
      title: s.title,
      content: s.content,
      sourceUrl: s.source_url,
      publishedAt: s.published_at,
      sentiment: s.sentiment,
      importance: s.importance,
      rawData: s.raw_data ? JSON.parse(s.raw_data) : null,
      metadata: s.metadata ? JSON.parse(s.metadata) : null,
      topics: signalTopics.map(t => t.name)
    });
    signalMap.set(s.id, data.id);
  }
  console.log(`  ✓ ${signals.length} signals migrated\n`);

  // 4. Collections
  const collections = db.prepare('SELECT * FROM collections ORDER BY id').all();
  console.log(`Migrating ${collections.length} collections...`);
  for (const c of collections) {
    const data = await api('POST', '/api/collections', {
      name: c.name,
      description: c.description,
      purpose: c.purpose,
      metadata: c.metadata ? JSON.parse(c.metadata) : null
    });
    collectionMap.set(c.id, data.id);

    // Add signals to collection
    const collSignals = db.prepare(
      'SELECT signal_id, notes FROM collection_signals WHERE collection_id = ?'
    ).all(c.id);
    for (const cs of collSignals) {
      const cloudSignalId = signalMap.get(cs.signal_id);
      if (cloudSignalId) {
        try {
          await api('POST', `/api/collections/${data.id}/signals`, {
            signalId: cloudSignalId,
            notes: cs.notes
          });
        } catch {}
      }
    }
  }
  console.log(`  ✓ ${collections.length} collections migrated\n`);

  // 5. Business Contexts
  const contexts = db.prepare('SELECT * FROM business_contexts ORDER BY id').all();
  console.log(`Migrating ${contexts.length} business contexts...`);
  for (const c of contexts) {
    const data = await api('POST', '/api/contexts', {
      title: c.title,
      contextType: c.context_type,
      content: c.content,
      status: c.status,
      metadata: c.metadata ? JSON.parse(c.metadata) : null
    });
    contextMap.set(c.id, data.id);
  }
  console.log(`  ✓ ${contexts.length} contexts migrated\n`);

  // 6. Analyses
  const analyses = db.prepare('SELECT * FROM analyses ORDER BY id').all();
  console.log(`Migrating ${analyses.length} analyses...`);
  for (const a of analyses) {
    const cloudSignalIds = a.signal_ids
      ? JSON.parse(a.signal_ids).map(id => signalMap.get(id)).filter(Boolean)
      : null;

    await api('POST', '/api/analyses', {
      title: a.title,
      analysisType: a.analysis_type,
      content: a.content,
      methodology: a.methodology,
      businessContextId: a.business_context_id ? contextMap.get(a.business_context_id) : null,
      collectionId: a.collection_id ? collectionMap.get(a.collection_id) : null,
      signalIds: cloudSignalIds,
      model: a.model,
      provider: a.provider,
      inputTokens: a.input_tokens,
      outputTokens: a.output_tokens,
      metadata: a.metadata ? JSON.parse(a.metadata) : null
    });
  }
  console.log(`  ✓ ${analyses.length} analyses migrated\n`);

  console.log('=== Migration Complete ===');
  console.log(`Sources: ${sourceMap.size}`);
  console.log(`Topics: ${topicMap.size}`);
  console.log(`Signals: ${signalMap.size}`);
  console.log(`Collections: ${collectionMap.size}`);
  console.log(`Contexts: ${contextMap.size}`);
  console.log(`Analyses: ${analyses.length}`);

  db.close();
}

run().catch(err => {
  console.error('Migration failed:', err);
  db.close();
  process.exit(1);
});
