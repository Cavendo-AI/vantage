import { Router } from 'express';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { validateBody, validateParams, createAnalysisSchema, idParamSchema } from '../utils/validation.js';

const router = Router();

// POST /api/analyses
router.post('/', apiKeyAuth('write'), validateBody(createAnalysisSchema), async (req, res) => {
  try {
    const {
      title, analysisType, content, methodology,
      businessContextId, collectionId, signalIds,
      model, provider, inputTokens, outputTokens, metadata
    } = req.body;

    const result = await db.insert(
      `INSERT INTO analyses (title, analysis_type, content, methodology,
         business_context_id, collection_id, signal_ids,
         model, provider, input_tokens, output_tokens, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, analysisType, content, methodology,
       businessContextId, collectionId,
       signalIds ? JSON.stringify(signalIds) : null,
       model, provider, inputTokens, outputTokens,
       metadata ? JSON.stringify(metadata) : null]
    );

    const analysis = await db.one('SELECT * FROM analyses WHERE id = ?', [result.lastInsertRowid]);
    response.created(res, parseJson(analysis));
  } catch (err) {
    console.error('Error creating analysis:', err);
    response.serverError(res, err.message);
  }
});

// GET /api/analyses
router.get('/', apiKeyAuth('read'), async (req, res) => {
  try {
    const analyses = await db.many('SELECT * FROM analyses ORDER BY created_at DESC');
    response.success(res, analyses.map(parseJson));
  } catch (err) {
    console.error('Error listing analyses:', err);
    response.serverError(res, err.message);
  }
});

// GET /api/analyses/:id
router.get('/:id', apiKeyAuth('read'), validateParams(idParamSchema), async (req, res) => {
  try {
    const analysis = await db.one('SELECT * FROM analyses WHERE id = ?', [req.params.id]);
    if (!analysis) return response.notFound(res, 'Analysis');
    response.success(res, parseJson(analysis));
  } catch (err) {
    console.error('Error getting analysis:', err);
    response.serverError(res, err.message);
  }
});

// DELETE /api/analyses/:id
router.delete('/:id', apiKeyAuth('write'), validateParams(idParamSchema), async (req, res) => {
  try {
    const { changes } = await db.exec('DELETE FROM analyses WHERE id = ?', [req.params.id]);
    if (changes === 0) return response.notFound(res, 'Analysis');
    response.success(res, { deleted: true });
  } catch (err) {
    console.error('Error deleting analysis:', err);
    response.serverError(res, err.message);
  }
});

function parseJson(row) {
  if (!row) return row;
  return {
    ...row,
    signal_ids: row.signal_ids ? JSON.parse(row.signal_ids) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  };
}

export default router;
