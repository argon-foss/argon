import { randomUUID } from 'crypto';
import { DatabaseContext, ApiKey, QueryOptions } from './types';
import { buildWhereClause, buildOrderByClause, parseDate } from './utils';

const parseApiKeyRow = (row: any): ApiKey => ({
  ...row,
  permissions: JSON.parse(row.permissions),
  lastUsed: row.lastUsed ? parseDate(row.lastUsed) : null,
  expiresAt: row.expiresAt ? parseDate(row.expiresAt) : null,
  createdAt: parseDate(row.createdAt),
  updatedAt: parseDate(row.updatedAt)
});

export function createApiKeysRepository({ db }: DatabaseContext) {
  const repository = {
    findMany: async (options?: QueryOptions<ApiKey>): Promise<ApiKey[]> => {
      const { clause: whereClause, params: whereParams } = buildWhereClause('api_keys', options?.where);
      const orderByClause = buildOrderByClause('api_keys', options?.orderBy);

      const query = `
        SELECT * FROM api_keys
        ${whereClause}
        ${orderByClause}
      `;

      const rows = db.prepare(query).all(...whereParams) as any[];
      return rows.map(parseApiKeyRow);
    },

    findUnique: async (where: { id: string }): Promise<ApiKey | null> => {
      const row = db.prepare('SELECT * FROM api_keys WHERE id = ?')
        .get(where.id) as any;
      return row ? parseApiKeyRow(row) : null;
    },

    findByKey: async (key: string): Promise<ApiKey | null> => {
      const row = db.prepare('SELECT * FROM api_keys WHERE key = ?')
        .get(key) as any;
      return row ? parseApiKeyRow(row) : null;
    },

    create: async (data: Omit<ApiKey, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiKey> => {
      const apiKey = {
        id: randomUUID(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.prepare(`
        INSERT INTO api_keys (
          id, name, key, userId, permissions, 
          lastUsed, expiresAt, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        apiKey.id,
        apiKey.name,
        apiKey.key,
        apiKey.userId,
        JSON.stringify(apiKey.permissions),
        apiKey.lastUsed ? apiKey.lastUsed.toISOString() : null,
        apiKey.expiresAt ? apiKey.expiresAt.toISOString() : null,
        apiKey.createdAt.toISOString(),
        apiKey.updatedAt.toISOString()
      );

      return apiKey;
    },

    update: async (where: { id: string }, data: Partial<ApiKey>): Promise<ApiKey> => {
      const current = await repository.findUnique(where);
      if (!current) throw new Error('API key not found');

      const updated = {
        ...current,
        ...data,
        updatedAt: new Date()
      };

      db.prepare(`
        UPDATE api_keys
        SET name = ?, key = ?, userId = ?, permissions = ?,
            lastUsed = ?, expiresAt = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        updated.name,
        updated.key,
        updated.userId,
        JSON.stringify(updated.permissions),
        updated.lastUsed ? updated.lastUsed.toISOString() : null,
        updated.expiresAt ? updated.expiresAt.toISOString() : null,
        updated.updatedAt.toISOString(),
        where.id
      );

      return updated;
    },

    delete: async (where: { id: string }): Promise<void> => {
      const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(where.id);
      if (result.changes === 0) {
        throw new Error('API key not found');
      }
    },

    updateLastUsed: async (id: string): Promise<void> => {
      const now = new Date();
      db.prepare(`
        UPDATE api_keys
        SET lastUsed = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        now.toISOString(),
        now.toISOString(),
        id
      );
    }
  };

  return repository;
}