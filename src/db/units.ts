import { randomUUID } from 'crypto';
import { DatabaseContext, Unit, QueryOptions } from './types';
import { buildWhereClause, buildOrderByClause, parseDate } from './utils';

// Helper function to parse database rows into Unit objects
const parseUnitRow = (row: any): Unit => ({
  id: row.id,
  name: row.name,
  shortName: row.shortName,
  description: row.description,
  dockerImage: row.dockerImage,
  defaultStartupCommand: row.defaultStartupCommand,
  configFiles: JSON.parse(row.configFiles || '[]'),
  environmentVariables: JSON.parse(row.environmentVariables || '[]'),
  installScript: JSON.parse(row.installScript),
  startup: JSON.parse(row.startup || '{"userEditable":false}'),
  createdAt: parseDate(row.createdAt),
  updatedAt: parseDate(row.updatedAt)
});

export function createUnitsRepository({ db }: DatabaseContext) {
  const repository = {
    findMany: async (options?: QueryOptions<Unit>): Promise<Unit[]> => {
      const { clause: whereClause, params: whereParams } = buildWhereClause('units', options?.where);
      const orderByClause = buildOrderByClause('units', options?.orderBy);

      const query = `
        SELECT * FROM units
        ${whereClause}
        ${orderByClause}
      `;

      const rows = db.prepare(query).all(...whereParams) as any[];
      return rows.map(parseUnitRow);
    },

    findFirst: async (options?: QueryOptions<Unit>): Promise<Unit | null> => {
      const { clause: whereClause, params: whereParams } = buildWhereClause('units', options?.where);
      const orderByClause = buildOrderByClause('units', options?.orderBy);

      const query = `
        SELECT * FROM units
        ${whereClause}
        ${orderByClause}
        LIMIT 1
      `;

      const row = db.prepare(query).get(...whereParams) as any;
      return row ? parseUnitRow(row) : null;
    },

    findUnique: async (where: { id: string }): Promise<Unit | null> => {
      const row = db.prepare('SELECT * FROM units WHERE id = ?')
        .get(where.id) as any;
      return row ? parseUnitRow(row) : null;
    },

    create: async (data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Unit> => {
      const unit = {
        id: randomUUID(),
        ...data,
        configFiles: data.configFiles || [],
        environmentVariables: data.environmentVariables || [],
        startup: data.startup || { userEditable: false },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.prepare(`
        INSERT INTO units (
          id, name, shortName, description, dockerImage,
          defaultStartupCommand, configFiles, environmentVariables,
          installScript, startup, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        unit.id,
        unit.name,
        unit.shortName,
        unit.description,
        unit.dockerImage,
        unit.defaultStartupCommand,
        JSON.stringify(unit.configFiles),
        JSON.stringify(unit.environmentVariables),
        JSON.stringify(unit.installScript),
        JSON.stringify(unit.startup),
        unit.createdAt.toISOString(),
        unit.updatedAt.toISOString()
      );

      return unit;
    },

    update: async (where: { id: string }, data: Partial<Unit>): Promise<Unit> => {
      const current = await repository.findUnique(where);
      if (!current) throw new Error('Unit not found');

      const updated = {
        ...current,
        ...data,
        // Ensure arrays have defaults if not provided in update
        configFiles: data.configFiles || current.configFiles,
        environmentVariables: data.environmentVariables || current.environmentVariables,
        startup: data.startup || current.startup,
        updatedAt: new Date()
      };

      db.prepare(`
        UPDATE units
        SET name = ?, shortName = ?, description = ?, dockerImage = ?,
            defaultStartupCommand = ?, configFiles = ?, environmentVariables = ?,
            installScript = ?, startup = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        updated.name,
        updated.shortName,
        updated.description,
        updated.dockerImage,
        updated.defaultStartupCommand,
        JSON.stringify(updated.configFiles),
        JSON.stringify(updated.environmentVariables),
        JSON.stringify(updated.installScript),
        JSON.stringify(updated.startup),
        updated.updatedAt.toISOString(),
        where.id
      );

      return updated;
    },

    delete: async (where: { id: string }): Promise<void> => {
      const result = db.prepare('DELETE FROM units WHERE id = ?').run(where.id);
      if (result.changes === 0) {
        throw new Error('Unit not found');
      }
    }
  };

  return repository;
}