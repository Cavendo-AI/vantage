import { Router } from 'express';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import {
  validateBody, validateParams, validateQuery,
  createSourceSchema, updateSourceSchema, idParamSchema, paginationSchema
} from '../utils/validation.js';

const router = Router();

// POST /api/sources
router.post('/', apiKeyAuth('write'), validateBody(createSourceSchema), async (req, res) => {
  try {
    const { name, bio, organization, credibility, platformHandles, avatarUrl, notes, metadata } = req.body;
    const result = await db.insert(
      `INSERT INTO sources (name, bio, organization, credibility, platform_handles, avatar_url, notes, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, bio, organization, credibility,
       platformHandles ? JSON.stringify(platformHandles) : null,
       avatarUrl, notes,
       metadata ? JSON.stringify(metadata) : null]
    );
    const source = await db.one('SELECT * FROM sources WHERE id = ?', [result.lastInsertRowid]);
    response.created(res, parseSourceJson(source));
  } catch (err) {
    console.error('Error creating source:', err);
    response.serverError(res, err.message);
  }
});

// GET /api/sources
router.get('/', apiKeyAuth('read'), validateQuery(paginationSchema), async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sources = await db.many(
      `SELECT s.*, (SELECT COUNT(*) FROM signals WHERE source_id = s.id) as signal_count
       FROM sources s ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const total = await db.one('SELECT COUNT(*) as count FROM sources');
    response.success(res, { sources: sources.map(parseSourceJson), total: total.count });
  } catch (err) {
    console.error('Error listing sources:', err);
    response.serverError(res, err.message);
  }
});

// GET /api/sources/:id
router.get('/:id', apiKeyAuth('read'), validateParams(idParamSchema), async (req, res) => {
  try {
    const source = await db.one(
      `SELECT s.*, (SELECT COUNT(*) FROM signals WHERE source_id = s.id) as signal_count
       FROM sources s WHERE s.id = ?`,
      [req.params.id]
    );
    if (!source) return response.notFound(res, 'Source');
    response.success(res, parseSourceJson(source));
  } catch (err) {
    console.error('Error getting source:', err);
    response.serverError(res, err.message);
  }
});

// PUT /api/sources/:id
router.put('/:id', apiKeyAuth('write'), validateParams(idParamSchema), validateBody(updateSourceSchema), async (req, res) => {
  try {
    const existing = await db.one('SELECT id FROM sources WHERE id = ?', [req.params.id]);
    if (!existing) return response.notFound(res, 'Source');

    const fields = [];
    const values = [];
    const { name, bio, organization, credibility, platformHandles, avatarUrl, notes, metadata } = req.body;

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
    if (organization !== undefined) { fields.push('organization = ?'); values.push(organization); }
    if (credibility !== undefined) { fields.push('credibility = ?'); values.push(credibility); }
    if (platformHandles !== undefined) { fields.push('platform_handles = ?'); values.push(platformHandles ? JSON.stringify(platformHandles) : null); }
    if (avatarUrl !== undefined) { fields.push('avatar_url = ?'); values.push(avatarUrl); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
    if (metadata !== undefined) { fields.push('metadata = ?'); values.push(metadata ? JSON.stringify(metadata) : null); }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(req.params.id);
      await db.exec(`UPDATE sources SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const source = await db.one('SELECT * FROM sources WHERE id = ?', [req.params.id]);
    response.success(res, parseSourceJson(source));
  } catch (err) {
    console.error('Error updating source:', err);
    response.serverError(res, err.message);
  }
});

// DELETE /api/sources/:id
router.delete('/:id', apiKeyAuth('write'), validateParams(idParamSchema), async (req, res) => {
  try {
    const { changes } = await db.exec('DELETE FROM sources WHERE id = ?', [req.params.id]);
    if (changes === 0) return response.notFound(res, 'Source');
    response.success(res, { deleted: true });
  } catch (err) {
    console.error('Error deleting source:', err);
    response.serverError(res, err.message);
  }
});

// GET /api/sources/:id/signals
router.get('/:id/signals', apiKeyAuth('read'), validateParams(idParamSchema), async (req, res) => {
  try {
    const source = await db.one('SELECT id FROM sources WHERE id = ?', [req.params.id]);
    if (!source) return response.notFound(res, 'Source');

    const signals = await db.many(
      'SELECT * FROM signals WHERE source_id = ? ORDER BY captured_at DESC LIMIT 100',
      [req.params.id]
    );
    response.success(res, signals.map(parseSignalJson));
  } catch (err) {
    console.error('Error listing source signals:', err);
    response.serverError(res, err.message);
  }
});

function parseSourceJson(row) {
  if (!row) return row;
  return {
    ...row,
    platform_handles: row.platform_handles ? JSON.parse(row.platform_handles) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
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
