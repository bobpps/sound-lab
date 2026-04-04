import { createMemoryDb } from '../../src/db/local/client.js';
import type Database from 'better-sqlite3';

export function createTestDb(): Database.Database {
  return createMemoryDb();
}
