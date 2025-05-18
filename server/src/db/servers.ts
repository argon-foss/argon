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
        user?: boolean,
        project?: boolean
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
        if (options.include.project && server.projectId) {
          const project = db.prepare(
            'SELECT * FROM projects WHERE id = ?'
          ).get(server.projectId) as any;
          
          if (project) {
            server.project = {
              ...project,
              createdAt: parseDate(project.createdAt),
              updatedAt: parseDate(project.updatedAt)
            };
          }
        }
      }

      return server;
    },

// src/db/servers.ts - fixed create function
create: async function(data: Omit<Server, 'id' | 'createdAt' | 'updatedAt'>): Promise<Server> {
  // If no projectId is specified, we need to handle it differently
  let projectId = data.projectId;
  
  if (!projectId) {
    try {
      // Access the projects repository from the db context
      // This assumes db.projects is defined in your database context
      if (db.projects && typeof db.projects.getOrCreateDefaultProject === 'function') {
        const defaultProject = await db.projects.getOrCreateDefaultProject(data.userId);
        projectId = defaultProject.id;
      } else {
        // Fallback approach if projects repository isn't available
        // This will query the database directly to find the default project
        const defaultProject = db.prepare(`
          SELECT id FROM projects 
          WHERE userId = ? AND name = 'Default'
          LIMIT 1
        `).get(data.userId) as any;
        
        if (defaultProject) {
          projectId = defaultProject.id;
        } else {
          // Create a default project if it doesn't exist
          const newProjectId = randomUUID();
          db.prepare(`
            INSERT INTO projects (id, name, description, userId, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            newProjectId,
            'Default',
            'Default project',
            data.userId,
            new Date().toISOString(),
            new Date().toISOString()
          );
          projectId = newProjectId;
        }
      }
    } catch (error) {
      console.error('Failed to get default project:', error);
      // Continue without a project ID if we can't get the default project
    }
  }
  
  const server = {
    id: randomUUID(),
    ...data,
    projectId,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  db.prepare(`
    INSERT INTO servers (
      id, internalId, name, nodeId, unitId, userId,
      allocationId, memoryMiB, diskMiB, cpuPercent,
      state, validationToken, projectId, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    server.projectId,
    server.createdAt.toISOString(),
    server.updatedAt.toISOString()
  );

  return server;
},

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
            validationToken = ?, projectId = ?, updatedAt = ?
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
        updated.projectId || null,
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