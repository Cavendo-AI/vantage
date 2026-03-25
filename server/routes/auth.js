import { Router } from 'express';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';
import { validateBody } from '../utils/validation.js';
import { generateKeySchema } from '../utils/validation.js';
import { apiKeyAuth, authenticateApiKeyHeader, generateApiKey } from '../middleware/apiKeyAuth.js';

const router = Router();

function isLoopbackIp(ip = '') {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// POST /api/auth/keys — generate new API key
// First key can be created without auth (bootstrap). After that, requires an existing key.
router.post('/keys', validateBody(generateKeySchema), async (req, res) => {
  try {
    const { name, scopes } = req.body;
    const bootstrapToken = req.headers['x-vantage-bootstrap-token'];
    const configuredBootstrapToken = process.env.VANTAGE_BOOTSTRAP_TOKEN;

    const result = await db.tx(async tx => {
      const existing = await tx.one('SELECT COUNT(*) as count FROM api_keys WHERE revoked_at IS NULL');

      if (existing.count === 0) {
        const remoteBootstrapAllowed = configuredBootstrapToken &&
          typeof bootstrapToken === 'string' &&
          bootstrapToken === configuredBootstrapToken;
        if (!isLoopbackIp(req.ip) && !remoteBootstrapAllowed) {
          const err = new Error(
            'First API key creation is restricted to localhost. Set VANTAGE_BOOTSTRAP_TOKEN and send it in X-Vantage-Bootstrap-Token for remote bootstrap.'
          );
          err.code = 'FORBIDDEN';
          throw err;
        }
      } else {
        await authenticateApiKeyHeader(req.headers.authorization, 'write', { adapter: tx });
      }

      return generateApiKey(name, scopes, { adapter: tx });
    });

    response.created(res, {
      id: result.id,
      key: result.key,
      prefix: result.prefix,
      name: result.name,
      scopes: result.scopes,
      note: 'Save this key — it will not be shown again.'
    });
  } catch (err) {
    if (err.code === 'FORBIDDEN') {
      return response.forbidden(res, err.message);
    }
    if (
      err.message === 'Missing or invalid Authorization header' ||
      err.message === 'Invalid API key format' ||
      err.message === 'Invalid API key' ||
      err.message === 'API key has been revoked' ||
      err.message === 'API key has expired'
    ) {
      return response.unauthorized(res, err.message);
    }
    console.error('Error generating API key:', err);
    response.serverError(res, 'Internal server error');
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
    response.serverError(res, 'Internal server error');
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
    response.serverError(res, 'Internal server error');
  }
});

export default router;
