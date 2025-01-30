// Panel: src/db/servers.ts
import { randomUUID } from 'crypto';
import { DatabaseContext, Server, QueryOptions } from './types';
import { buildWhereClause, buildOrderByClause, parseDate } from './utils';

const parseServerRow = (row: any): Server => ({
  ...row,
  memoryMiB: Number(row.memoryMiB),
  diskMiB: Number(row.diskMiB),
  cpuPercent: Number(row.cpuPercent),
  createdAt: parseDate(row.createdAt),
  updatedAt: parseDate(row.updatedAt)
});

export function createServersRepository({ db }: DatabaseContext) {
  const repository = {
    findMany: async (options?: QueryOptions<Server>): Promise<Server[]> => {
      const { clause: whereClause, params: whereParams } = buildWhereClause('servers', options?.where);
      const orderByClause = buildOrderByClause('servers', options?.orderBy);

      const query = `
        SELECT servers.* 
        FROM servers
        ${whereClause}
        ${orderByClause}
      `;

      const rows = db.prepare(query).all(...whereParams) as any[];
      const servers = rows.map(parseServerRow);

      if (options?.include) {
        await Promise.all(servers.map(async server => {
          if (options.include?.node) {
            const node = db.prepare(
              'SELECT * FROM nodes WHERE id = ?'
            ).get(server.nodeId) as any;
            if (node) {
              server.node = {
                ...node,
                isOnline: Boolean(node.isOnline),
                lastChecked: parseDate(node.lastChecked),
                createdAt: parseDate(node.createdAt),
                updatedAt: parseDate(node.updatedAt)
              };
            }
          }
          if (options.include?.unit) {
            const unit = db.prepare(
              'SELECT * FROM units WHERE id = ?'
            ).get(server.unitId) as any;
            if (unit) {
              server.unit = {
                ...unit,
                configFiles: JSON.parse(unit.configFiles),
                environmentVariables: JSON.parse(unit.environmentVariables),
                installScript: JSON.parse(unit.installScript),
                startup: JSON.parse(unit.startup),
                recommendedRequirements: unit.recommendedRequirements ? JSON.parse(unit.recommendedRequirements) : undefined,
                createdAt: parseDate(unit.createdAt),
                updatedAt: parseDate(unit.updatedAt)
              };
            }
          }
          if (options.include?.user) {
            const user = db.prepare(
              'SELECT id, username FROM users WHERE id = ?'
            ).get(server.userId) as any;
            if (user) {
              server.user = { id: user.id, username: user.username };
            }
          }
        }));
      }

      return servers;
    },

    findFirst: async (options?: QueryOptions<Server>): Promise<Server | null> => {
      const { clause: whereClause, params: whereParams } = buildWhereClause('servers', options?.where);
      const orderByClause = buildOrderByClause('servers', options?.orderBy);

      const query = `
        SELECT servers.* 
        FROM servers
        ${whereClause}
        ${orderByClause}
        LIMIT 1
      `;

      const row = db.prepare(query).get(...whereParams) as any;
      if (!row) return null;

      const server = parseServerRow(row);

      if (options?.include) {
        if (options.include?.node) {
          const node = db.prepare(
            'SELECT * FROM nodes WHERE id = ?'
          ).get(server.nodeId) as any;
          if (node) {
            server.node = {
              ...node,
              isOnline: Boolean(node.isOnline),
              lastChecked: parseDate(node.lastChecked),
              createdAt: parseDate(node.createdAt),
              updatedAt: parseDate(node.updatedAt)
            };
          }
        }
        if (options.include?.unit) {
          const unit = db.prepare(
            'SELECT * FROM units WHERE id = ?'
          ).get(server.unitId) as any;
          if (unit) {
            server.unit = {
              ...unit,
              configFiles: JSON.parse(unit.configFiles),
              environmentVariables: JSON.parse(unit.environmentVariables),
              installScript: JSON.parse(unit.installScript),
              startup: JSON.parse(unit.startup),
              recommendedRequirements: unit.recommendedRequirements ? JSON.parse(unit.recommendedRequirements) : undefined,
              createdAt: parseDate(unit.createdAt),
              updatedAt: parseDate(unit.updatedAt)
            };
          }
        }
        if (options.include?.user) {
          const user = db.prepare(
            'SELECT id, username FROM users WHERE id = ?'
          ).get(server.userId) as any;
          if (user) {
            server.user = { id: user.id, username: user.username };
          }
        }
      }

      return server;
    },

    findUnique: async (options: { 
      where: { id: string }, 
      include?: { 
        node?: boolean, 
        allocation?: boolean, 
        unit?: boolean,
        user?: boolean 
      } 
    }): Promise<Server | null> => {
      const row = db.prepare('SELECT * FROM servers WHERE id = ?')
        .get(options.where.id) as any;
      
      if (!row) return null;
    
      const server = parseServerRow(row);
    
      if (options.include) {
        if (options.include.node) {
          const node = db.prepare(
            'SELECT * FROM nodes WHERE id = ?'
          ).get(server.nodeId) as any;
          if (node) {
            server.node = {
              ...node,
              isOnline: Boolean(node.isOnline),
              lastChecked: parseDate(node.lastChecked),
              createdAt: parseDate(node.createdAt),
              updatedAt: parseDate(node.updatedAt)
            };
          }
        }
        if (options.include.allocation) {
          const allocation = db.prepare(
            'SELECT * FROM allocations WHERE id = ?'
          ).get(server.allocationId) as any;
          if (allocation) {
            server.allocation = {
              ...allocation,
              assigned: Boolean(allocation.assigned),
              createdAt: parseDate(allocation.createdAt),
              updatedAt: parseDate(allocation.updatedAt)
            };
          }
        }
        let include = options.include;
        if (include.unit) {
          const unit = db.prepare(
            'SELECT * FROM units WHERE id = ?'
          ).get(server.unitId) as any;
          if (unit) {
            server.unit = {
              ...unit,
              configFiles: JSON.parse(unit.configFiles),
              environmentVariables: JSON.parse(unit.environmentVariables),
              installScript: JSON.parse(unit.installScript),
              startup: JSON.parse(unit.startup),
              recommendedRequirements: unit.recommendedRequirements ? JSON.parse(unit.recommendedRequirements) : undefined,
              createdAt: parseDate(unit.createdAt),
              updatedAt: parseDate(unit.updatedAt)
            };
          }
        }
        if (include.user) {
          const user = db.prepare(
            'SELECT id, username FROM users WHERE id = ?'
          ).get(server.userId) as any;
          if (user) {
            server.user = { id: user.id, username: user.username };
          }
        }
      }

      return server;
    },

    // Update the create function in servers.ts
create: async (data: Omit<Server, 'id' | 'createdAt' | 'updatedAt'>): Promise<Server> => {
  const server = {
    id: randomUUID(),
    ...data,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  db.prepare(`
    INSERT INTO servers (
      id, internalId, name, nodeId, unitId, userId,
      allocationId, memoryMiB, diskMiB, cpuPercent,
      state, validationToken, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    server.id,
    server.internalId,
    server.name,
    server.nodeId,
    server.unitId,
    server.userId,
    server.allocationId,
    server.memoryMiB,
    server.diskMiB,
    server.cpuPercent,
    server.state,
    server.validationToken || null,
    server.createdAt.toISOString(),
    server.updatedAt.toISOString()
  );

  return server;
},

// Update the update function
update: async function(where: { id: string }, data: Partial<Server>): Promise<Server> {
  const current = await repository.findUnique({ where });
  if (!current) throw new Error('Server not found');

  const updated = {
    ...current,
    ...data,
    updatedAt: new Date()
  };

  db.prepare(`
    UPDATE servers
    SET name = ?, nodeId = ?, unitId = ?, userId = ?,
        allocationId = ?, memoryMiB = ?, diskMiB = ?,
        cpuPercent = ?, state = ?, internalId = ?,
        validationToken = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    updated.name,
    updated.nodeId,
    updated.unitId,
    updated.userId,
    updated.allocationId,
    updated.memoryMiB,
    updated.diskMiB,
    updated.cpuPercent,
    updated.state,
    updated.internalId,
    updated.validationToken || null,
    updated.updatedAt.toISOString(),
    where.id
  );

  return updated;
},

    delete: async (where: { id: string }): Promise<void> => {
      const result = db.prepare('DELETE FROM servers WHERE id = ?').run(where.id);
      if (result.changes === 0) {
        throw new Error('Server not found');
      }
    }
  };

  return repository;
}