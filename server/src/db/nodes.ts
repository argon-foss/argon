// src/db/nodes.ts
import { randomUUID } from 'crypto';
import { DatabaseContext, Node } from './types';
import { parseDate, toBoolean } from './utils';

const parseNodeRow = (row: any): Node => ({
  ...row,
  isOnline: toBoolean(row.isOnline),
  lastChecked: parseDate(row.lastChecked),
  createdAt: parseDate(row.createdAt),
  updatedAt: parseDate(row.updatedAt)
});

export function createNodesRepository({ db }: DatabaseContext) {
  const repository = {
    findFirst: async ({ where }: { where: any } = { where: {} }): Promise<Node | null> => {
      const conditions = Object.entries(where).map(([key]) => `${key} = ?`);
      const values = Object.values(where);
      
      const query = conditions.length 
        ? `SELECT * FROM nodes WHERE ${conditions.join(' AND ')} LIMIT 1`
        : 'SELECT * FROM nodes LIMIT 1';

      const row = db.prepare(query).get(...values) as any;
      return row ? parseNodeRow(row) : null;
    },

    findMany: async ({ where }: { where?: any } = {}): Promise<Node[]> => {
      const conditions = where ? Object.entries(where).map(([key]) => `${key} = ?`) : [];
      const values = where ? Object.values(where) : [];
      
      const query = conditions.length 
        ? `SELECT * FROM nodes WHERE ${conditions.join(' AND ')}`
        : 'SELECT * FROM nodes';

      const rows = db.prepare(query).all(...values) as any[];
      
      const nodes = rows.map(parseNodeRow);
      
      // Load region information if available
      for (const node of nodes) {
        if (node.regionId) {
          const regionRow = db.prepare('SELECT * FROM regions WHERE id = ?').get(node.regionId) as any;
          if (regionRow) {
            node.region = {
              ...regionRow,
              serverLimit: regionRow.serverLimit ? Number(regionRow.serverLimit) : null,
              createdAt: parseDate(regionRow.createdAt),
              updatedAt: parseDate(regionRow.updatedAt)
            };
          }
        }
      }
      
      return nodes;
    },

    findUnique: async ({ id }: { id: string }): Promise<Node | null> => {
      const row = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as any;
      if (!row) return null;
      
      const node = parseNodeRow(row);
      
      // Load region information if available
      if (node.regionId) {
        const regionRow = db.prepare('SELECT * FROM regions WHERE id = ?').get(node.regionId) as any;
        if (regionRow) {
          node.region = {
            ...regionRow,
            serverLimit: regionRow.serverLimit ? Number(regionRow.serverLimit) : null,
            createdAt: parseDate(regionRow.createdAt),
            updatedAt: parseDate(regionRow.updatedAt)
          };
        }
      }
      
      return node;
    },

    create: async (data: Omit<Node, 'id' | 'connectionKey' | 'createdAt' | 'updatedAt'>): Promise<Node> => {
      const node = {
        id: randomUUID(),
        connectionKey: randomUUID(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.prepare(`
        INSERT INTO nodes (
          id, name, fqdn, port, connectionKey, isOnline, 
          lastChecked, regionId, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        node.id,
        node.name,
        node.fqdn,
        node.port,
        node.connectionKey,
        node.isOnline ? 1 : 0,
        node.lastChecked.toISOString(),
        node.regionId || null,
        node.createdAt.toISOString(),
        node.updatedAt.toISOString()
      );

      return node;
    },

    update: async function({ id }: { id: string }, data: Partial<Node>): Promise<Node> {
      const current = await repository.findUnique({ id });
      if (!current) throw new Error('Node not found');

      const updated = {
        ...current,
        ...data,
        updatedAt: new Date()
      };

      db.prepare(`
        UPDATE nodes
        SET name = ?, fqdn = ?, port = ?, connectionKey = ?, 
            isOnline = ?, lastChecked = ?, regionId = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        updated.name,
        updated.fqdn,
        updated.port,
        updated.connectionKey,
        updated.isOnline ? 1 : 0,
        updated.lastChecked.toISOString(),
        updated.regionId || null,
        updated.updatedAt.toISOString(),
        id
      );

      return updated;
    },

    delete: async ({ id }: { id: string }): Promise<void> => {
      const result = db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
      if (result.changes === 0) {
        throw new Error('Node not found');
      }
    }
  };

  return repository;
}