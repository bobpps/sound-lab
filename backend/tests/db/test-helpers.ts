import { createMemoryDb } from '../../src/db/local/client.js';
import type { WrappedDatabase } from '../../src/db/local/client.js';

export async function createTestDb(): Promise<WrappedDatabase> {
  return createMemoryDb();
}
