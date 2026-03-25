import { Router } from 'express';
import { unlink } from 'fs/promises';
import { join } from 'path';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { upload, UPLOADS_DIR, persistImageUpload } from '../utils/images.js';
import {
  validateBody, validateParams, validateQuery,
  createSignalSchema, updateSignalSchema, signalQuerySchema, idParamSchema, bulkSignalsSchema
} from '../utils/validation.js';

const router = Router();

// POST /api/signals — capture a new signal
router.post('/', apiKeyAuth('write'), validateBody(createSignalSchema), async (req, res) => {
  try {
    const {
      sourceId, signalType, platform, title, content, sourceUrl,
      publishedAt, sentiment, importance, rawData, metadata, topics
    } = req.body;

    // Get next signal number
    const maxNum = await db.one('SELECT COALESCE(MAX(signal_number), 0) as max_num FROM signals');
    const signalNumber = (maxNum?.max_num || 0) + 1;

    const result = await db.insert(
      `INSERT INTO signals (source_id, signal_type, platform, title, content, source_url,
         published_at, sentiment, importance, raw_data, metadata, signal_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sourceId, signalType, platform, title, content, sourceUrl,
       publishedAt, sentiment, importance,
       rawData ? JSON.stringify(rawData) : null,
       metadata ? JSON.stringify(metadata) : null,
       signalNumber]
    );

    const signalId = result.lastInsertRowid;

    // Tag topics if provided
    if (topics && topics.length > 0) {
      for (const topicName of topics) {
        const slug = topicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        // Upsert topic
        await db.exec(
          'INSERT OR IGNORE INTO topics (name, slug) VALUES (?, ?)',
          [topicName, slug]
        );
        const topic = await db.one('SELECT id FROM topics WHERE slug = ?', [slug]);
        if (topic) {
          await db.exec(
            'INSERT OR IGNORE INTO signal_topics (signal_id, topic_id) VALUES (?, ?)',
            [signalId, topic.id]
          );
        }
      }
    }

    const signal = await getSignalWithRelations(signalId);
    response.created(res, signal);
  } catch (err) {
    console.error('Error creating signal:', err);
    response.serverError(res, "Internal server error");
  }
});

// GET /api/signals — list signals with filtering
router.get('/', apiKeyAuth('read'), validateQuery(signalQuerySchema), async (req, res) => {
  try {
    const { limit = 50, offset = 0, sourceId, signalType, platform, topic, importance, since, until, q } = req.query;

    let where = [];
    let params = [];

    if (sourceId) { where.push('s.source_id = ?'); params.push(sourceId); }
    if (signalType) { where.push('s.signal_type = ?'); params.push(signalType); }
    if (platform) { where.push('s.platform = ?'); params.push(platform); }
    if (importance) { where.push('s.importance = ?'); params.push(importance); }
    if (since) { where.push('s.captured_at >= ?'); params.push(since); }
    if (until) { where.push('s.captured_at <= ?'); params.push(until); }
    if (q) { where.push('(s.content LIKE ? OR s.title LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    if (topic) {
      where.push('EXISTS (SELECT 1 FROM signal_topics st JOIN topics t ON st.topic_id = t.id WHERE st.signal_id = s.id AND (t.slug = ? OR t.name = ?))');
      params.push(topic, topic);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const signals = await db.many(
      `SELECT s.*, src.name as source_name, src.organization as source_organization
       FROM signals s
       LEFT JOIN sources src ON s.source_id = src.id
       ${whereClause}
       ORDER BY s.captured_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countRow = await db.one(
      `SELECT COUNT(*) as count FROM signals s ${whereClause}`,
      params
    );

    response.success(res, {
      signals: signals.map(parseSignalJson),
      total: countRow.count,
      limit,
      offset
    });
  } catch (err) {
    console.error('Error listing signals:', err);
    response.serverError(res, "Internal server error");
  }
});

// GET /api/signals/feed — latest signals feed
router.get('/feed', apiKeyAuth('read'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const since = req.query.since;

    let whereClause = '';
    let params = [];
    if (since) {
      whereClause = 'WHERE s.captured_at > ?';
      params = [since];
    }

    const signals = await db.many(
      `SELECT s.*, src.name as source_name, src.organization as source_organization
       FROM signals s
       LEFT JOIN sources src ON s.source_id = src.id
       ${whereClause}
       ORDER BY s.captured_at DESC
       LIMIT ?`,
      [...params, limit]
    );

    // Get topics for each signal
    const results = [];
    for (const signal of signals) {
      const topics = await db.many(
        'SELECT t.name, t.slug FROM signal_topics st JOIN topics t ON st.topic_id = t.id WHERE st.signal_id = ?',
        [signal.id]
      );
      results.push({ ...parseSignalJson(signal), topics: topics.map(t => t.name) });
    }

    response.success(res, results);
  } catch (err) {
    console.error('Error getting feed:', err);
    response.serverError(res, "Internal server error");
  }
});

// GET /api/signals/search — search signals
router.get('/search', apiKeyAuth('read'), async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return response.badRequest(res, 'Query parameter "q" is required');

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const signals = await db.many(
      `SELECT s.*, src.name as source_name
       FROM signals s
       LEFT JOIN sources src ON s.source_id = src.id
       WHERE s.content LIKE ? OR s.title LIKE ?
       ORDER BY s.captured_at DESC LIMIT ?`,
      [`%${q}%`, `%${q}%`, limit]
    );

    response.success(res, signals.map(parseSignalJson));
  } catch (err) {
    console.error('Error searching signals:', err);
    response.serverError(res, "Internal server error");
  }
});

// GET /api/signals/number/:num — look up by signal number
router.get('/number/:num', apiKeyAuth('read'), async (req, res) => {
  try {
    const num = parseInt(req.params.num);
    if (isNaN(num) || num < 1) return response.badRequest(res, 'Invalid signal number');
    const row = await db.one('SELECT id FROM signals WHERE signal_number = ?', [num]);
    if (!row) return response.notFound(res, 'Signal');
    const signal = await getSignalWithRelations(row.id);
    response.success(res, signal);
  } catch (err) {
    console.error('Error getting signal by number:', err);
    response.serverError(res, "Internal server error");
  }
});

// GET /api/signals/:id
router.get('/:id', apiKeyAuth('read'), validateParams(idParamSchema), async (req, res) => {
  try {
    const signal = await getSignalWithRelations(req.params.id);
    if (!signal) return response.notFound(res, 'Signal');
    response.success(res, signal);
  } catch (err) {
    console.error('Error getting signal:', err);
    response.serverError(res, "Internal server error");
  }
});

// PUT /api/signals/:id
router.put('/:id', apiKeyAuth('write'), validateParams(idParamSchema), validateBody(updateSignalSchema), async (req, res) => {
  try {
    const existing = await db.one('SELECT id FROM signals WHERE id = ?', [req.params.id]);
    if (!existing) return response.notFound(res, 'Signal');

    const fields = [];
    const values = [];
    const fieldMap = {
      sourceId: 'source_id', signalType: 'signal_type', platform: 'platform',
      title: 'title', content: 'content', sourceUrl: 'source_url',
      publishedAt: 'published_at', sentiment: 'sentiment', importance: 'importance'
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (req.body[camel] !== undefined) {
        fields.push(`${snake} = ?`);
        values.push(req.body[camel]);
      }
    }
    if (req.body.rawData !== undefined) {
      fields.push('raw_data = ?');
      values.push(req.body.rawData ? JSON.stringify(req.body.rawData) : null);
    }
    if (req.body.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(req.body.metadata ? JSON.stringify(req.body.metadata) : null);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(req.params.id);
      await db.exec(`UPDATE signals SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // Update topics if provided
    if (req.body.topics !== undefined) {
      await db.exec('DELETE FROM signal_topics WHERE signal_id = ?', [req.params.id]);
      for (const topicName of req.body.topics) {
        const slug = topicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        await db.exec('INSERT OR IGNORE INTO topics (name, slug) VALUES (?, ?)', [topicName, slug]);
        const topic = await db.one('SELECT id FROM topics WHERE slug = ?', [slug]);
        if (topic) {
          await db.exec('INSERT OR IGNORE INTO signal_topics (signal_id, topic_id) VALUES (?, ?)', [req.params.id, topic.id]);
        }
      }
    }

    const signal = await getSignalWithRelations(req.params.id);
    response.success(res, signal);
  } catch (err) {
    console.error('Error updating signal:', err);
    response.serverError(res, "Internal server error");
  }
});

// DELETE /api/signals/:id
router.delete('/:id', apiKeyAuth('write'), validateParams(idParamSchema), async (req, res) => {
  try {
    // Delete associated images from disk
    const images = await db.many('SELECT file_path FROM signal_images WHERE signal_id = ?', [req.params.id]);
    for (const img of images) {
      try { await unlink(join(UPLOADS_DIR, img.file_path)); } catch { /* ignore */ }
    }

    const { changes } = await db.exec('DELETE FROM signals WHERE id = ?', [req.params.id]);
    if (changes === 0) return response.notFound(res, 'Signal');
    response.success(res, { deleted: true });
  } catch (err) {
    console.error('Error deleting signal:', err);
    response.serverError(res, "Internal server error");
  }
});

// POST /api/signals/:id/images — upload image
router.post('/:id/images', apiKeyAuth('write'), validateParams(idParamSchema), upload.single('image'), async (req, res) => {
  try {
    const signal = await db.one('SELECT id FROM signals WHERE id = ?', [req.params.id]);
    if (!signal) return response.notFound(res, 'Signal');

    if (!req.file) return response.badRequest(res, 'No image file provided');

    const stored = await persistImageUpload(req.file);

    const result = await db.insert(
      `INSERT INTO signal_images (signal_id, filename, file_path, mime_type, file_size, caption)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, req.file.originalname, stored.filename, stored.mimeType, stored.size, req.body.caption || null]
    );

    const image = await db.one('SELECT * FROM signal_images WHERE id = ?', [result.lastInsertRowid]);
    response.created(res, image);
  } catch (err) {
    if (err.code === 'INVALID_IMAGE' || err.code === 'LIMIT_FILE_SIZE') {
      return response.badRequest(res, err.message);
    }
    console.error('Error uploading image:', err);
    response.serverError(res, "Internal server error");
  }
});

// DELETE /api/signals/:id/images/:imageId
router.delete('/:id/images/:imageId', apiKeyAuth('write'), async (req, res) => {
  try {
    const image = await db.one(
      'SELECT * FROM signal_images WHERE id = ? AND signal_id = ?',
      [req.params.imageId, req.params.id]
    );
    if (!image) return response.notFound(res, 'Image');

    try { await unlink(join(UPLOADS_DIR, image.file_path)); } catch { /* ignore */ }
    await db.exec('DELETE FROM signal_images WHERE id = ?', [image.id]);
    response.success(res, { deleted: true });
  } catch (err) {
    console.error('Error deleting image:', err);
    response.serverError(res, "Internal server error");
  }
});

// POST /api/signals/bulk — bulk capture
router.post('/bulk', apiKeyAuth('write'), validateBody(bulkSignalsSchema), async (req, res) => {
  try {
    const { signals } = req.body;
    const results = await db.tx(async tx => {
      const insertedIds = [];
      for (const s of signals) {
        const result = await tx.insert(
          `INSERT INTO signals (source_id, signal_type, platform, title, content, source_url,
             published_at, sentiment, importance, raw_data, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.sourceId, s.signalType, s.platform, s.title, s.content, s.sourceUrl,
           s.publishedAt, s.sentiment, s.importance,
           s.rawData ? JSON.stringify(s.rawData) : null,
           s.metadata ? JSON.stringify(s.metadata) : null]
        );
        insertedIds.push(result.lastInsertRowid);
      }
      return insertedIds;
    });

    response.created(res, { created: results.length, ids: results });
  } catch (err) {
    console.error('Error bulk creating signals:', err);
    response.serverError(res, "Internal server error");
  }
});

// Helpers
async function getSignalWithRelations(id) {
  const signal = await db.one(
    `SELECT s.*, src.name as source_name, src.bio as source_bio,
       src.organization as source_organization, src.credibility as source_credibility
     FROM signals s LEFT JOIN sources src ON s.source_id = src.id
     WHERE s.id = ?`,
    [id]
  );
  if (!signal) return null;

  const topics = await db.many(
    'SELECT t.id, t.name, t.slug FROM signal_topics st JOIN topics t ON st.topic_id = t.id WHERE st.signal_id = ?',
    [id]
  );

  const images = await db.many(
    'SELECT * FROM signal_images WHERE signal_id = ? ORDER BY sort_order',
    [id]
  );

  return {
    ...parseSignalJson(signal),
    topics,
    images
  };
}

function parseSignalJson(row) {
  if (!row) return row;
  return {
    ...row,
    raw_data: row.raw_data ? JSON.parse(row.raw_data) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  };
}

export default router;
