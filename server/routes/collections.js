import { Router } from 'express';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import {
  validateBody, validateParams,
  createCollectionSchema, updateCollectionSchema, addCollectionSignalSchema, idParamSchema
} from '../utils/validation.js';

const router = Router();

// POST /api/collections
router.post('/', apiKeyAuth('write'), validateBody(createCollectionSchema), async (req, res) => {
  try {
    const { name, description, purpose, metadata } = req.body;
    const result = await db.insert(
      'INSERT INTO collections (name, description, purpose, metadata) VALUES (?, ?, ?, ?)',
      [name, description, purpose, metadata ? JSON.stringify(metadata) : null]
    );
    const collection = await db.one('SELECT * FROM collections WHERE id = ?', [result.lastInsertRowid]);
    response.created(res, parseJson(collection));
  } catch (err) {
    console.error('Error creating collection:', err);
    response.serverError(res, "Internal server error");
  }
});

// GET /api/collections
router.get('/', apiKeyAuth('read'), async (req, res) => {
  try {
    const collections = await db.many(
      `SELECT c.*, (SELECT COUNT(*) FROM collection_signals WHERE collection_id = c.id) as signal_count
       FROM collections c ORDER BY c.created_at DESC`
    );
    response.success(res, collections.map(parseJson));
  } catch (err) {
    console.error('Error listing collections:', err);
    response.serverError(res, "Internal server error");
  }
});

// GET /api/collections/:id
router.get('/:id', apiKeyAuth('read'), validateParams(idParamSchema), async (req, res) => {
  try {
    const collection = await db.one('SELECT * FROM collections WHERE id = ?', [req.params.id]);
    if (!collection) return response.notFound(res, 'Collection');

    const signals = await db.many(
      `SELECT s.*, cs.notes as collection_notes, cs.added_at, src.name as source_name
       FROM collection_signals cs
       JOIN signals s ON cs.signal_id = s.id
       LEFT JOIN sources src ON s.source_id = src.id
       WHERE cs.collection_id = ?
       ORDER BY cs.added_at DESC`,
      [req.params.id]
    );

    response.success(res, {
      ...parseJson(collection),
      signals: signals.map(s => ({
        ...s,
        raw_data: s.raw_data ? JSON.parse(s.raw_data) : null,
        metadata: s.metadata ? JSON.parse(s.metadata) : null
      }))
    });
  } catch (err) {
    console.error('Error getting collection:', err);
    response.serverError(res, "Internal server error");
  }
});

// PUT /api/collections/:id
router.put('/:id', apiKeyAuth('write'), validateParams(idParamSchema), validateBody(updateCollectionSchema), async (req, res) => {
  try {
    const existing = await db.one('SELECT id FROM collections WHERE id = ?', [req.params.id]);
    if (!existing) return response.notFound(res, 'Collection');

    const fields = [];
    const values = [];
    const { name, description, purpose, status, metadata } = req.body;

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (purpose !== undefined) { fields.push('purpose = ?'); values.push(purpose); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (metadata !== undefined) { fields.push('metadata = ?'); values.push(metadata ? JSON.stringify(metadata) : null); }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(req.params.id);
      await db.exec(`UPDATE collections SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const collection = await db.one('SELECT * FROM collections WHERE id = ?', [req.params.id]);
    response.success(res, parseJson(collection));
  } catch (err) {
    console.error('Error updating collection:', err);
    response.serverError(res, "Internal server error");
  }
});

// DELETE /api/collections/:id
router.delete('/:id', apiKeyAuth('write'), validateParams(idParamSchema), async (req, res) => {
  try {
    const { changes } = await db.exec('DELETE FROM collections WHERE id = ?', [req.params.id]);
    if (changes === 0) return response.notFound(res, 'Collection');
    response.success(res, { deleted: true });
  } catch (err) {
    console.error('Error deleting collection:', err);
    response.serverError(res, "Internal server error");
  }
});

// POST /api/collections/:id/signals — add signal to collection
router.post('/:id/signals', apiKeyAuth('write'), validateParams(idParamSchema), validateBody(addCollectionSignalSchema), async (req, res) => {
  try {
    const collection = await db.one('SELECT id FROM collections WHERE id = ?', [req.params.id]);
    if (!collection) return response.notFound(res, 'Collection');

    const signal = await db.one('SELECT id FROM signals WHERE id = ?', [req.body.signalId]);
    if (!signal) return response.notFound(res, 'Signal');

    await db.exec(
      'INSERT OR IGNORE INTO collection_signals (collection_id, signal_id, notes) VALUES (?, ?, ?)',
      [req.params.id, req.body.signalId, req.body.notes]
    );
    response.created(res, { added: true });
  } catch (err) {
    console.error('Error adding signal to collection:', err);
    response.serverError(res, "Internal server error");
  }
});

// DELETE /api/collections/:id/signals/:signalId
router.delete('/:id/signals/:signalId', apiKeyAuth('write'), async (req, res) => {
  try {
    const { changes } = await db.exec(
      'DELETE FROM collection_signals WHERE collection_id = ? AND signal_id = ?',
      [req.params.id, req.params.signalId]
    );
    if (changes === 0) return response.notFound(res, 'Signal in collection');
    response.success(res, { removed: true });
  } catch (err) {
    console.error('Error removing signal from collection:', err);
    response.serverError(res, "Internal server error");
  }
});

function parseJson(row) {
  if (!row) return row;
  return { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null };
}

export default router;
