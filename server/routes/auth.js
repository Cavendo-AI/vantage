import { Router } from 'express';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';
import { validateBody } from '../utils/validation.js';
import { generateKeySchema } from '../utils/validation.js';
import { apiKeyAuth, generateApiKey } from '../middleware/apiKeyAuth.js';

const router = Router();

// POST /api/auth/keys — generate new API key
router.post('/keys', validateBody(generateKeySchema), async (req, res) => {
  try {
    const { name, scopes } = req.body;
    const result = await generateApiKey(name, scopes);
    response.created(res, {
      id: result.id,
      key: result.key,
      prefix: result.prefix,
      name: result.name,
      scopes: result.scopes,
      note: 'Save this key — it will not be shown again.'
    });
  } catch (err) {
    console.error('Error generating API key:', err);
    response.serverError(res, err.message);
  }
});

// GET /api/auth/keys — list API keys (prefix only)
router.get('/keys', apiKeyAuth('read'), async (req, res) => {
  try {
    const keys = await db.many(
      'SELECT id, key_prefix, name, scopes, last_used_at, created_at FROM api_keys WHERE revoked_at IS NULL ORDER BY created_at DESC'
    );
    response.success(res, keys.map(k => ({ ...k, scopes: JSON.parse(k.scopes || '[]') })));
  } catch (err) {
    console.error('Error listing API keys:', err);
    response.serverError(res, err.message);
  }
});

// DELETE /api/auth/keys/:id — revoke key
router.delete('/keys/:id', apiKeyAuth('write'), async (req, res) => {
  try {
    const { changes } = await db.exec(
      "UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL",
      [req.params.id]
    );
    if (changes === 0) return response.notFound(res, 'API key');
    response.success(res, { revoked: true });
  } catch (err) {
    console.error('Error revoking API key:', err);
    response.serverError(res, err.message);
  }
});

export default router;
