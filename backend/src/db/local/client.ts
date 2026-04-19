import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface WrappedStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { lastInsertRowid: number };
}

export interface WrappedDatabase {
  prepare(sql: string): WrappedStatement;
  exec(sql: string): void;
  pragma(statement: string): void;
  close(): void;
  saveToFile(): void;
}

function wrapDatabase(db: SqlJsDatabase, filePath?: string): WrappedDatabase {
  let inTransaction = false;

  function autoSave(): void {
    if (filePath && !inTransaction) wrapped.saveToFile();
  }

  const wrapped: WrappedDatabase = {
    prepare(sql: string): WrappedStatement {
      return {
        get(...params: unknown[]): unknown {
          const stmt = db.prepare(sql);
          try {
            if (params.length) stmt.bind(params as SqlValue[]);
            if (stmt.step()) {
              return stmt.getAsObject();
            }
            return undefined;
          } finally {
            stmt.free();
          }
        },

        all(...params: unknown[]): unknown[] {
          const stmt = db.prepare(sql);
          try {
            if (params.length) stmt.bind(params as SqlValue[]);
            const results: unknown[] = [];
            while (stmt.step()) {
              results.push(stmt.getAsObject());
            }
            return results;
          } finally {
            stmt.free();
          }
        },

        run(...params: unknown[]): { lastInsertRowid: number } {
          db.run(sql, params.length ? params as SqlValue[] : undefined);
          const result = db.exec('SELECT last_insert_rowid()');
          const rowid = (result[0]?.values[0]?.[0] as number) ?? 0;
          autoSave();
          return { lastInsertRowid: rowid };
        },
      };
    },

    exec(sql: string): void {
      const upper = sql.trim().toUpperCase();
      if (upper === 'BEGIN') inTransaction = true;
      db.exec(sql);
      if (upper === 'COMMIT' || upper === 'ROLLBACK') inTransaction = false;
      autoSave();
    },

    pragma(statement: string): void {
      db.run(`PRAGMA ${statement}`);
    },

    close(): void {
      if (filePath) wrapped.saveToFile();
      db.close();
    },

    saveToFile(): void {
      if (!filePath) return;
      const data = db.export();
      writeFileSync(filePath, Buffer.from(data));
    },
  };

  return wrapped;
}

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;
function getSql(): ReturnType<typeof initSqlJs> {
  if (!sqlPromise) sqlPromise = initSqlJs();
  return sqlPromise;
}

export async function createLocalDb(dbPath: string): Promise<WrappedDatabase> {
  const SQL = await getSql();
  mkdirSync(dirname(dbPath), { recursive: true });
  const fileBuffer = existsSync(dbPath) ? readFileSync(dbPath) : undefined;
  const db = new SQL.Database(fileBuffer);
  const wrapped = wrapDatabase(db, dbPath);
  wrapped.pragma('foreign_keys = ON');
  runMigrations(wrapped);
  return wrapped;
}

export async function createMemoryDb(): Promise<WrappedDatabase> {
  const SQL = await getSql();
  const db = new SQL.Database();
  const wrapped = wrapDatabase(db);
  wrapped.pragma('foreign_keys = ON');
  runMigrations(wrapped);
  return wrapped;
}

function runMigrations(db: WrappedDatabase): void {
  const migrationPath = resolve(__dirname, 'migrations/001_initial.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  db.exec(sql);
}
