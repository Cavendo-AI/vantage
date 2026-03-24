import crypto from 'crypto';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * API key authentication middleware.
 * Expects: Authorization: Bearer vtg_...
 */
export function apiKeyAuth(requiredScope = 'read') {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.unauthorized(res, 'Missing or invalid Authorization header');
    }

    const key = authHeader.slice(7);
    if (!key.startsWith('vtg_')) {
      return response.unauthorized(res, 'Invalid API key format');
    }

    const keyHash = hashKey(key);
    const row = await db.one(
      'SELECT id, scopes, expires_at, revoked_at FROM api_keys WHERE key_hash = ?',
      [keyHash]
    );

    if (!row) {
      return response.unauthorized(res, 'Invalid API key');
    }

    if (row.revoked_at) {
      return response.unauthorized(res, 'API key has been revoked');
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return response.unauthorized(res, 'API key has expired');
    }

    const scopes = JSON.parse(row.scopes || '[]');
    if (!scopes.includes(requiredScope) && !scopes.includes('*')) {
      return response.forbidden(res, `Insufficient scope. Required: ${requiredScope}`);
    }

    // Update last used
    await db.exec('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?', [row.id]);

    req.apiKeyId = row.id;
    req.apiKeyScopes = scopes;
    next();
  };
}

/**
 * Generate a new API key.
 * Returns the raw key (only shown once) and stores the hash.
 */
export async function generateApiKey(name, scopes = ['read', 'write']) {
  const raw = 'vtg_' + crypto.randomBytes(32).toString('hex');
  const keyHash = hashKey(raw);
  const keyPrefix = raw.slice(0, 15);

  const result = await db.insert(
    'INSERT INTO api_keys (key_hash, key_prefix, name, scopes) VALUES (?, ?, ?, ?)',
    [keyHash, keyPrefix, name, JSON.stringify(scopes)]
  );

  return {
    id: result.lastInsertRowid,
    key: raw,
    prefix: keyPrefix,
    name,
    scopes
  };
}
