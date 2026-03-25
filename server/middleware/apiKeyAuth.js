import crypto from 'crypto';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function lookupApiKey(adapter, key) {
  const keyHash = hashKey(key);
  return adapter.one(
    'SELECT id, scopes, expires_at, revoked_at FROM api_keys WHERE key_hash = ?',
    [keyHash]
  );
}

export async function authenticateApiKeyHeader(authHeader, requiredScope = 'read', options = {}) {
  const {
    adapter = db,
    touchLastUsed = false
  } = options;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const key = authHeader.slice(7);
  if (!key.startsWith('vtg_')) {
    throw new Error('Invalid API key format');
  }

  const row = await lookupApiKey(adapter, key);

  if (!row) {
    throw new Error('Invalid API key');
  }

  if (row.revoked_at) {
    throw new Error('API key has been revoked');
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    throw new Error('API key has expired');
  }

  const scopes = JSON.parse(row.scopes || '[]');
  if (!scopes.includes(requiredScope) && !scopes.includes('*')) {
    const err = new Error(`Insufficient scope. Required: ${requiredScope}`);
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (touchLastUsed) {
    await adapter.exec("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?", [row.id]);
  }

  return {
    id: row.id,
    scopes
  };
}

async function insertApiKey(adapter, name, scopes = ['read', 'write']) {
  const raw = 'vtg_' + crypto.randomBytes(32).toString('hex');
  const keyHash = hashKey(raw);
  const keyPrefix = raw.slice(0, 15);

  const result = await adapter.insert(
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

/**
 * API key authentication middleware.
 * Expects: Authorization: Bearer vtg_...
 */
export function apiKeyAuth(requiredScope = 'read') {
  return async (req, res, next) => {
    try {
      const auth = await authenticateApiKeyHeader(req.headers.authorization, requiredScope, {
        adapter: db,
        touchLastUsed: true
      });
      req.apiKeyId = auth.id;
      req.apiKeyScopes = auth.scopes;
      next();
    } catch (err) {
      if (err.code === 'FORBIDDEN') {
        return response.forbidden(res, err.message);
      }
      return response.unauthorized(res, err.message);
    }
  };
}

/**
 * Generate a new API key.
 * Returns the raw key (only shown once) and stores the hash.
 */
export async function generateApiKey(name, scopes = ['read', 'write'], options = {}) {
  const adapter = options.adapter || db;
  return insertApiKey(adapter, name, scopes);
}
