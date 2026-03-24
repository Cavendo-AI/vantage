import { Router } from 'express';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import {
  validateBody, validateParams, validateQuery,
  createTopicSchema, updateTopicSchema, idParamSchema, paginationSchema
} from '../utils/validation.js';

const router = Router();

// POST /api/topics
router.post('/', apiKeyAuth('write'), validateBody(createTopicSchema), async (req, res) => {
  try {
    const { name, description, color, parentId } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = await db.one('SELECT id FROM topics WHERE slug = ?', [slug]);
    if (existing) return response.conflict(res, 'Topic with this name already exists');

    const result = await db.insert(
      'INSERT INTO topics (name, slug, description, color, parent_id) VALUES (?, ?, ?, ?, ?)',
      [name, slug, description, color, parentId]
    );
    const topic = await db.one('SELECT * FROM topics WHERE id = ?', [result.lastInsertRowid]);
    response.created(res, topic);
  } catch (err) {
    console.error('Error creating topic:', err);
    response.serverError(res, err.message);
  }
});

// GET /api/topics
router.get('/', apiKeyAuth('read'), async (req, res) => {
  try {
    const topics = await db.many(
      `SELECT t.*, (SELECT COUNT(*) FROM signal_topics WHERE topic_id = t.id) as signal_count
       FROM topics t ORDER BY t.name`
    );
    response.success(res, topics);
  } catch (err) {
    console.error('Error listing topics:', err);
    response.serverError(res, err.message);
  }
});

// GET /api/topics/:id
router.get('/:id', apiKeyAuth('read'), validateParams(idParamSchema), async (req, res) => {
  try {
    const topic = await db.one(
      `SELECT t.*, (SELECT COUNT(*) FROM signal_topics WHERE topic_id = t.id) as signal_count
       FROM topics t WHERE t.id = ?`,
      [req.params.id]
    );
    if (!topic) return response.notFound(res, 'Topic');
    response.success(res, topic);
  } catch (err) {
    console.error('Error getting topic:', err);
    response.serverError(res, err.message);
  }
});

// PUT /api/topics/:id
router.put('/:id', apiKeyAuth('write'), validateParams(idParamSchema), validateBody(updateTopicSchema), async (req, res) => {
  try {
    const existing = await db.one('SELECT id FROM topics WHERE id = ?', [req.params.id]);
    if (!existing) return response.notFound(res, 'Topic');

    const fields = [];
    const values = [];
    const { name, description, color, parentId } = req.body;

    if (name !== undefined) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      fields.push('name = ?', 'slug = ?');
      values.push(name, slug);
    }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (color !== undefined) { fields.push('color = ?'); values.push(color); }
    if (parentId !== undefined) { fields.push('parent_id = ?'); values.push(parentId); }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(req.params.id);
      await db.exec(`UPDATE topics SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const topic = await db.one('SELECT * FROM topics WHERE id = ?', [req.params.id]);
    response.success(res, topic);
  } catch (err) {
    console.error('Error updating topic:', err);
    response.serverError(res, err.message);
  }
});

// DELETE /api/topics/:id
router.delete('/:id', apiKeyAuth('write'), validateParams(idParamSchema), async (req, res) => {
  try {
    const { changes } = await db.exec('DELETE FROM topics WHERE id = ?', [req.params.id]);
    if (changes === 0) return response.notFound(res, 'Topic');
    response.success(res, { deleted: true });
  } catch (err) {
    console.error('Error deleting topic:', err);
    response.serverError(res, err.message);
  }
});

// GET /api/topics/:id/signals
router.get('/:id/signals', apiKeyAuth('read'), validateParams(idParamSchema), async (req, res) => {
  try {
    const topic = await db.one('SELECT id FROM topics WHERE id = ?', [req.params.id]);
    if (!topic) return response.notFound(res, 'Topic');

    const signals = await db.many(
      `SELECT s.*, src.name as source_name
       FROM signals s
       JOIN signal_topics st ON st.signal_id = s.id
       LEFT JOIN sources src ON s.source_id = src.id
       WHERE st.topic_id = ?
       ORDER BY s.captured_at DESC LIMIT 100`,
      [req.params.id]
    );
    response.success(res, signals.map(s => ({
      ...s,
      raw_data: s.raw_data ? JSON.parse(s.raw_data) : null,
      metadata: s.metadata ? JSON.parse(s.metadata) : null
    })));
  } catch (err) {
    console.error('Error listing topic signals:', err);
    response.serverError(res, err.message);
  }
});

export default router;
