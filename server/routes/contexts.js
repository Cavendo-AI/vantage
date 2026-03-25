import { Router } from 'express';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import {
  validateBody, validateParams,
  createContextSchema, updateContextSchema, idParamSchema
} from '../utils/validation.js';

const router = Router();

// POST /api/contexts
router.post('/', apiKeyAuth('write'), validateBody(createContextSchema), async (req, res) => {
  try {
    const { title, contextType, content, status, metadata } = req.body;
    const result = await db.insert(
      'INSERT INTO business_contexts (title, context_type, content, status, metadata) VALUES (?, ?, ?, ?, ?)',
      [title, contextType, content, status, metadata ? JSON.stringify(metadata) : null]
    );
    const ctx = await db.one('SELECT * FROM business_contexts WHERE id = ?', [result.lastInsertRowid]);
    response.created(res, parseJson(ctx));
  } catch (err) {
    console.error('Error creating context:', err);
    response.serverError(res, "Internal server error");
  }
});

// GET /api/contexts
router.get('/', apiKeyAuth('read'), async (req, res) => {
  try {
    const contexts = await db.many(
      'SELECT * FROM business_contexts WHERE status != ? ORDER BY created_at DESC',
      ['archived']
    );
    response.success(res, contexts.map(parseJson));
  } catch (err) {
    console.error('Error listing contexts:', err);
    response.serverError(res, "Internal server error");
  }
});

// GET /api/contexts/:id
router.get('/:id', apiKeyAuth('read'), validateParams(idParamSchema), async (req, res) => {
  try {
    const ctx = await db.one('SELECT * FROM business_contexts WHERE id = ?', [req.params.id]);
    if (!ctx) return response.notFound(res, 'Business context');
    response.success(res, parseJson(ctx));
  } catch (err) {
    console.error('Error getting context:', err);
    response.serverError(res, "Internal server error");
  }
});

// PUT /api/contexts/:id
router.put('/:id', apiKeyAuth('write'), validateParams(idParamSchema), validateBody(updateContextSchema), async (req, res) => {
  try {
    const existing = await db.one('SELECT id, version FROM business_contexts WHERE id = ?', [req.params.id]);
    if (!existing) return response.notFound(res, 'Business context');

    const fields = [];
    const values = [];
    const { title, contextType, content, status, metadata } = req.body;

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (contextType !== undefined) { fields.push('context_type = ?'); values.push(contextType); }
    if (content !== undefined) {
      fields.push('content = ?', 'version = ?');
      values.push(content, existing.version + 1);
    }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (metadata !== undefined) { fields.push('metadata = ?'); values.push(metadata ? JSON.stringify(metadata) : null); }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(req.params.id);
      await db.exec(`UPDATE business_contexts SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const ctx = await db.one('SELECT * FROM business_contexts WHERE id = ?', [req.params.id]);
    response.success(res, parseJson(ctx));
  } catch (err) {
    console.error('Error updating context:', err);
    response.serverError(res, "Internal server error");
  }
});

// DELETE /api/contexts/:id
router.delete('/:id', apiKeyAuth('write'), validateParams(idParamSchema), async (req, res) => {
  try {
    const { changes } = await db.exec('DELETE FROM business_contexts WHERE id = ?', [req.params.id]);
    if (changes === 0) return response.notFound(res, 'Business context');
    response.success(res, { deleted: true });
  } catch (err) {
    console.error('Error deleting context:', err);
    response.serverError(res, "Internal server error");
  }
});

function parseJson(row) {
  if (!row) return row;
  return { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null };
}

export default router;
