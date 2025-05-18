// src/db/projects.ts
import { randomUUID } from 'crypto';
import { DatabaseContext, Project, QueryOptions } from './types';
import { buildWhereClause, buildOrderByClause, parseDate } from './utils';

const parseProjectRow = (row: any): Project => ({
  ...row,
  createdAt: parseDate(row.createdAt),
  updatedAt: parseDate(row.updatedAt)
});

export function createProjectsRepository({ db }: DatabaseContext) {
  const repository = {
    findMany: async (options?: QueryOptions<Project>): Promise<Project[]> => {
      const { clause: whereClause, params: whereParams } = buildWhereClause('projects', options?.where);
      const orderByClause = buildOrderByClause('projects', options?.orderBy);

      const query = `
        SELECT projects.* 
        FROM projects
        ${whereClause}
        ${orderByClause}
      `;

      const rows = db.prepare(query).all(...whereParams) as any[];
      return rows.map(parseProjectRow);
    },

    findUnique: async (where: { id: string }): Promise<Project | null> => {
      const row = db.prepare('SELECT * FROM projects WHERE id = ?')
        .get(where.id) as any;
      return row ? parseProjectRow(row) : null;
    },

    create: async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> => {
      const project = {
        id: randomUUID(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.prepare(`
        INSERT INTO projects (
          id, name, description, userId, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        project.id,
        project.name,
        project.description || null,
        project.userId,
        project.createdAt.toISOString(),
        project.updatedAt.toISOString()
      );

      return project;
    },

    update: async function(where: { id: string }, data: Partial<Project>): Promise<Project> {
      const current = await repository.findUnique(where);
      if (!current) throw new Error('Project not found');

      const updated = {
        ...current,
        ...data,
        updatedAt: new Date()
      };

      db.prepare(`
        UPDATE projects
        SET name = ?, description = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        updated.name,
        updated.description || null,
        updated.updatedAt.toISOString(),
        where.id
      );

      return updated;
    },

    delete: async (where: { id: string }): Promise<void> => {
      const result = db.prepare('DELETE FROM projects WHERE id = ?').run(where.id);
      if (result.changes === 0) {
        throw new Error('Project not found');
      }
    },

    // Get project with servers count
    getProjectWithServerCount: async (projectId: string): Promise<(Project & { serverCount: number }) | null> => {
      const row = db.prepare(`
        SELECT 
          p.*,
          COUNT(s.id) as serverCount
        FROM projects p
        LEFT JOIN servers s ON p.id = s.projectId
        WHERE p.id = ?
        GROUP BY p.id
      `).get(projectId) as any;

      if (!row) return null;

      return {
        ...parseProjectRow(row),
        serverCount: row.serverCount
      };
    },

    // Get all projects for a user with server counts
    getUserProjectsWithServerCount: async (userId: string): Promise<(Project & { serverCount: number })[]> => {
      const rows = db.prepare(`
        SELECT 
          p.*,
          COUNT(s.id) as serverCount
        FROM projects p
        LEFT JOIN servers s ON p.id = s.projectId
        WHERE p.userId = ?
        GROUP BY p.id
        ORDER BY p.name ASC
      `).all(userId) as any[];

      return rows.map(row => ({
        ...parseProjectRow(row),
        serverCount: row.serverCount
      }));
    },

    // Get or create default project for a user
    getOrCreateDefaultProject: async (userId: string): Promise<Project> => {
      const defaultProject = db.prepare(`
        SELECT * FROM projects 
        WHERE userId = ? AND name = 'Default'
        LIMIT 1
      `).get(userId) as any;

      if (defaultProject) {
        return parseProjectRow(defaultProject);
      }

      // Create default project
      return await repository.create({
        name: 'Default',
        description: 'Default project',
        userId
      });
    }
  };

  return repository;
}