import { randomUUID } from 'crypto';
import { DatabaseContext, QueryOptions } from './types';
import { buildWhereClause, buildOrderByClause, parseDate } from './utils';

// Types
export interface Cargo {
  id: string;
  name: string;
  description: string;
  hash: string;
  size: number;
  mimeType: string;
  type: 'local' | 'remote';
  remoteUrl?: string;
  properties: {
    hidden?: boolean;
    readonly?: boolean;
    noDelete?: boolean;
    customProperties?: Record<string, any>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CargoContainer {
  id: string;
  name: string;
  description: string;
  items: Array<{
    cargoId: string;
    targetPath: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// Helper functions to parse database rows
const parseCargoRow = (row: any): Cargo => ({
  id: row.id,
  name: row.name,
  description: row.description,
  hash: row.hash,
  size: row.size,
  mimeType: row.mimeType,
  type: row.type,
  remoteUrl: row.remoteUrl,
  properties: JSON.parse(row.properties),
  createdAt: parseDate(row.createdAt),
  updatedAt: parseDate(row.updatedAt)
});

const parseCargoContainerRow = (row: any): CargoContainer => ({
  id: row.id,
  name: row.name,
  description: row.description,
  items: JSON.parse(row.items),
  createdAt: parseDate(row.createdAt),
  updatedAt: parseDate(row.updatedAt)
});

export function createCargoRepository({ db }: DatabaseContext) {
  const repository = {
    // Cargo CRUD operations
    findManyCargo: async (options?: QueryOptions<Cargo>): Promise<Cargo[]> => {
      const { clause: whereClause, params: whereParams } = buildWhereClause('cargo', options?.where);
      const orderByClause = buildOrderByClause('cargo', options?.orderBy);

      const query = `
        SELECT * FROM cargo
        ${whereClause}
        ${orderByClause}
      `;

      const rows = db.prepare(query).all(...whereParams) as any[];
      return rows.map(parseCargoRow);
    },

    findCargo: async (id: string): Promise<Cargo | null> => {
      const row = db.prepare('SELECT * FROM cargo WHERE id = ?')
        .get(id) as any;
      return row ? parseCargoRow(row) : null;
    },

    createCargo: async (data: Omit<Cargo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Cargo> => {
      const cargo = {
        id: randomUUID(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.prepare(`
        INSERT INTO cargo (
          id, name, description, hash, size, mimeType,
          type, remoteUrl, properties, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cargo.id,
        cargo.name,
        cargo.description,
        cargo.hash,
        cargo.size,
        cargo.mimeType,
        cargo.type,
        cargo.remoteUrl,
        JSON.stringify(cargo.properties),
        cargo.createdAt.toISOString(),
        cargo.updatedAt.toISOString()
      );

      return cargo;
    },

    updateCargo: async (id: string, data: Partial<Cargo>): Promise<Cargo> => {
      const current = await repository.findCargo(id);
      if (!current) throw new Error('Cargo not found');

      const updated = {
        ...current,
        ...data,
        updatedAt: new Date()
      };

      db.prepare(`
        UPDATE cargo
        SET name = ?, description = ?, hash = ?, size = ?,
            mimeType = ?, type = ?, remoteUrl = ?, properties = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(
        updated.name,
        updated.description,
        updated.hash,
        updated.size,
        updated.mimeType,
        updated.type,
        updated.remoteUrl,
        JSON.stringify(updated.properties),
        updated.updatedAt.toISOString(),
        id
      );

      return updated;
    },

    deleteCargo: async (id: string): Promise<void> => {
      const result = db.prepare('DELETE FROM cargo WHERE id = ?').run(id);
      if (result.changes === 0) {
        throw new Error('Cargo not found');
      }
    },

    // Container CRUD operations
    findManyContainers: async (options?: QueryOptions<CargoContainer>): Promise<CargoContainer[]> => {
      const { clause: whereClause, params: whereParams } = buildWhereClause('cargo_containers', options?.where);
      const orderByClause = buildOrderByClause('cargo_containers', options?.orderBy);

      const query = `
        SELECT * FROM cargo_containers
        ${whereClause}
        ${orderByClause}
      `;

      const rows = db.prepare(query).all(...whereParams) as any[];
      return rows.map(parseCargoContainerRow);
    },

    findContainer: async (id: string): Promise<CargoContainer | null> => {
      const row = db.prepare('SELECT * FROM cargo_containers WHERE id = ?')
        .get(id) as any;
      return row ? parseCargoContainerRow(row) : null;
    },

    createContainer: async (data: Omit<CargoContainer, 'id' | 'createdAt' | 'updatedAt'>): Promise<CargoContainer> => {
      const container = {
        id: randomUUID(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.prepare(`
        INSERT INTO cargo_containers (
          id, name, description, items, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        container.id,
        container.name,
        container.description,
        JSON.stringify(container.items),
        container.createdAt.toISOString(),
        container.updatedAt.toISOString()
      );

      return container;
    },

    updateContainer: async (id: string, data: Partial<CargoContainer>): Promise<CargoContainer> => {
      const current = await repository.findContainer(id);
      if (!current) throw new Error('Container not found');

      const updated = {
        ...current,
        ...data,
        updatedAt: new Date()
      };

      db.prepare(`
        UPDATE cargo_containers
        SET name = ?, description = ?, items = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        updated.name,
        updated.description,
        JSON.stringify(updated.items),
        updated.updatedAt.toISOString(),
        id
      );

      return updated;
    },

    deleteContainer: async (id: string): Promise<void> => {
      const result = db.prepare('DELETE FROM cargo_containers WHERE id = ?').run(id);
      if (result.changes === 0) {
        throw new Error('Container not found');
      }
    },

    // Unit association operations
    assignContainerToUnit: async (unitId: string, containerId: string): Promise<void> => {
      db.prepare(`
        INSERT INTO unit_cargo_containers (unit_id, container_id)
        VALUES (?, ?)
      `).run(unitId, containerId);
    },

    removeContainerFromUnit: async (unitId: string, containerId: string): Promise<void> => {
      db.prepare(`
        DELETE FROM unit_cargo_containers
        WHERE unit_id = ? AND container_id = ?
      `).run(unitId, containerId);
    },

    getUnitContainers: async (unitId: string): Promise<CargoContainer[]> => {
      const rows = db.prepare(`
        SELECT c.* FROM cargo_containers c
        JOIN unit_cargo_containers uc ON c.id = uc.container_id
        WHERE uc.unit_id = ?
      `).all(unitId) as any[];

      return rows.map(parseCargoContainerRow);
    }
  };

  return repository;
}