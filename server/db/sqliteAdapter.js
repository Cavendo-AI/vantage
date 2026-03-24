/**
 * SQLite Adapter — wraps better-sqlite3 in a flat async API.
 *
 * API:
 *   await db.one(sql, params?)      -> Row | undefined
 *   await db.many(sql, params?)     -> Row[]
 *   await db.exec(sql, params?)     -> { changes }
 *   await db.insert(sql, params?)   -> { lastInsertRowid, changes }
 *   await db.tx(async (tx) => {})   -> T
 *   await db.run(sql)               -> void  (raw exec, no params — DDL/PRAGMA)
 *   db.close()                      -> void
 *   db.dialect                      -> 'sqlite'
 */

import { AsyncLocalStorage } from 'node:async_hooks';

const txStore = new AsyncLocalStorage();

function guardOuterCall(method) {
  if (txStore.getStore()?.inTx) {
    throw new Error(`db.${method}() called during active transaction. Use tx.${method}() instead.`);
  }
}

function assertSingleInsert(sql) {
  const trimmed = sql.trimStart();
  if (!/^INSERT\b/i.test(trimmed)) {
    throw new Error('db.insert() only accepts INSERT statements');
  }
  if (/\bVALUES\s*\(.*\)\s*,\s*\(/is.test(sql)) {
    throw new Error('db.insert() only supports single-row INSERT');
  }
}

export function createSqliteAdapter(raw) {
  const adapter = {
    dialect: 'sqlite',
    _raw: raw,

    async one(sql, params) {
      guardOuterCall('one');
      return raw.prepare(sql).get(...(params || []));
    },

    async many(sql, params) {
      guardOuterCall('many');
      return raw.prepare(sql).all(...(params || []));
    },

    async exec(sql, params) {
      guardOuterCall('exec');
      const result = raw.prepare(sql).run(...(params || []));
      return { changes: result.changes };
    },

    async insert(sql, params) {
      guardOuterCall('insert');
      assertSingleInsert(sql);
      const result = raw.prepare(sql).run(...(params || []));
      return {
        lastInsertRowid: Number(result.lastInsertRowid),
        changes: result.changes
      };
    },

    async tx(fn) {
      if (txStore.getStore()?.inTx) {
        throw new Error('Nested transactions are not supported.');
      }
      return txStore.run({ inTx: true }, async () => {
        raw.exec('BEGIN');
        try {
          const tx = createTxProxy(raw);
          const result = await fn(tx);
          raw.exec('COMMIT');
          return result;
        } catch (err) {
          raw.exec('ROLLBACK');
          throw err;
        }
      });
    },

    async run(sql) {
      raw.exec(sql);
    },

    close() {
      raw.close();
    }
  };

  return adapter;
}

function createTxProxy(raw) {
  return {
    dialect: 'sqlite',
    async one(sql, params) { return raw.prepare(sql).get(...(params || [])); },
    async many(sql, params) { return raw.prepare(sql).all(...(params || [])); },
    async exec(sql, params) {
      const result = raw.prepare(sql).run(...(params || []));
      return { changes: result.changes };
    },
    async insert(sql, params) {
      assertSingleInsert(sql);
      const result = raw.prepare(sql).run(...(params || []));
      return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.changes };
    },
    async run(sql) { raw.exec(sql); }
  };
}
