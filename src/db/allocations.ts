import { randomUUID } from 'crypto';
import { DatabaseContext, Allocation, QueryOptions } from './types';
import { buildWhereClause, buildOrderByClause, parseDate, toBoolean } from './utils';

const parseAllocationRow = (row: any): Allocation => ({
  ...row,
  assigned: toBoolean(row.assigned),
  createdAt: parseDate(row.createdAt),
  updatedAt: parseDate(row.updatedAt)
});

export function createAllocationsRepository({ db }: DatabaseContext) {
  const repository = {
    findMany: async (options?: QueryOptions<Allocation>): Promise<Allocation[]> => {
      const { clause: whereClause, params: whereParams } = buildWhereClause('allocations', options?.where);
      const orderByClause = buildOrderByClause('allocations', options?.orderBy);

      const query = `
        SELECT * FROM allocations
        ${whereClause}
        ${orderByClause}
      `;

      const rows = db.prepare(query).all(...whereParams) as any[];
      return rows.map(parseAllocationRow);
    },

    findUnique: async (where: { id: string }): Promise<Allocation | null> => {
      const row = db.prepare('SELECT * FROM allocations WHERE id = ?')
        .get(where.id) as any;
      return row ? parseAllocationRow(row) : null;
    },

    findFirst: async (options?: QueryOptions<Allocation>): Promise<Allocation | null> => {
      const { clause: whereClause, params: whereParams } = buildWhereClause('allocations', options?.where);
      const orderByClause = buildOrderByClause('allocations', options?.orderBy);

      const query = `
        SELECT * FROM allocations
        ${whereClause}
        ${orderByClause}
        LIMIT 1
      `;

      const row = db.prepare(query).get(...whereParams) as any;
      return row ? parseAllocationRow(row) : null;
    },

    create: async (data: Omit<Allocation, 'id' | 'assigned' | 'serverId' | 'createdAt' | 'updatedAt'>): Promise<Allocation> => {
      // Verify unique constraint
      const existing = await repository.findFirst({
        where: {
          nodeId: data.nodeId,
          bindAddress: data.bindAddress,
          port: data.port
        }
      });

      if (existing) {
        throw new Error('Port already allocated on this node and bind address');
      }

      const allocation = {
        id: randomUUID(),
        ...data,
        assigned: false,
        serverId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.prepare(`
        INSERT INTO allocations (
          id, nodeId, bindAddress, port, alias, notes,
          assigned, serverId, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        allocation.id,
        allocation.nodeId,
        allocation.bindAddress,
        allocation.port,
        allocation.alias,
        allocation.notes,
        allocation.assigned ? 1 : 0,
        allocation.serverId,
        allocation.createdAt.toISOString(),
        allocation.updatedAt.toISOString()
      );

      return allocation;
    },

    createMany: async (allocations: Array<Omit<Allocation, 'id' | 'assigned' | 'serverId' | 'createdAt' | 'updatedAt'>>): Promise<Allocation[]> => {
      const created: Allocation[] = [];

      const insertAllocation = db.prepare(`
        INSERT INTO allocations (
          id, nodeId, bindAddress, port, alias, notes,
          assigned, serverId, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      db.transaction(() => {
        for (const data of allocations) {
          const allocation = {
            id: randomUUID(),
            ...data,
            assigned: false,
            serverId: null,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          insertAllocation.run(
            allocation.id,
            allocation.nodeId,
            allocation.bindAddress,
            allocation.port,
            allocation.alias,
            allocation.notes,
            allocation.assigned ? 1 : 0,
            allocation.serverId,
            allocation.createdAt.toISOString(),
            allocation.updatedAt.toISOString()
          );

          created.push(allocation);
        }
      })();

      return created;
    },

    update: async (where: { id: string }, data: Partial<Allocation>): Promise<Allocation> => {
      const current = await repository.findUnique(where);
      if (!current) throw new Error('Allocation not found');

      const updated = {
        ...current,
        ...data,
        updatedAt: new Date()
      };

      db.prepare(`
        UPDATE allocations
        SET bindAddress = ?, port = ?, alias = ?, notes = ?,
            assigned = ?, serverId = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        updated.bindAddress,
        updated.port,
        updated.alias,
        updated.notes,
        updated.assigned ? 1 : 0,
        updated.serverId,
        updated.updatedAt.toISOString(),
        where.id
      );

      return updated;
    },

    delete: async (where: { id: string }): Promise<void> => {
      const allocation = await repository.findUnique(where);
      if (allocation?.assigned) {
        throw new Error('Cannot delete allocation that is assigned to a server');
      }

      const result = db.prepare('DELETE FROM allocations WHERE id = ?').run(where.id);
      if (result.changes === 0) {
        throw new Error('Allocation not found');
      }
    },

    createPortRange: async (
      nodeId: string,
      bindAddress: string,
      startPort: number,
      endPort: number,
      alias?: string,
      notes?: string
    ): Promise<Allocation[]> => {
      const allocations: Array<Omit<Allocation, 'id' | 'assigned' | 'serverId' | 'createdAt' | 'updatedAt'>> = [];
      for (let port = startPort; port <= endPort; port++) {
        allocations.push({
          nodeId,
          bindAddress,
          port,
          alias,
          notes
        });
      }
      return repository.createMany(allocations);
    }
  };

  return repository;
}