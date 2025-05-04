// Panel: src/db/units.ts

import { randomUUID } from 'crypto';
import { DatabaseContext, Unit, QueryOptions } from './types';
import { buildWhereClause, buildOrderByClause, parseDate } from './utils';

// Helper function to parse database rows into Unit objects
const parseUnitRow = (row: any): Unit => {
  // Parse the JSON fields, handling potential V3 structure
  const dockerImages = row.dockerImages ? JSON.parse(row.dockerImages) : [];
  const dockerImage = row.dockerImage;
  
  // V3: If dockerImages is empty but dockerImage exists, create the dockerImages structure
  const finalDockerImages = dockerImages.length > 0 
    ? dockerImages 
    : dockerImage 
      ? [{ image: dockerImage, displayName: 'Default Image' }] 
      : [];
  
  // V3: Determine defaultDockerImage
  const defaultDockerImage = row.defaultDockerImage || dockerImage || (finalDockerImages.length > 0 ? finalDockerImages[0].image : '');
  
  // V3: Parse features section
  const features = row.features ? JSON.parse(row.features) : [];
  
  // V3: Parse meta section - if not present, add v3 marker
  let meta = row.meta ? JSON.parse(row.meta) : { version: 'argon/unit:v3' };
  if (!meta.version) {
    meta.version = 'argon/unit:v3';
  }
  
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    description: row.description,
    // V3: Support for multiple Docker images
    dockerImages: finalDockerImages,
    defaultDockerImage: defaultDockerImage,
    // Legacy field for backward compatibility
    dockerImage: dockerImage || defaultDockerImage,
    defaultStartupCommand: row.defaultStartupCommand,
    configFiles: JSON.parse(row.configFiles || '[]'),
    environmentVariables: JSON.parse(row.environmentVariables || '[]'),
    installScript: JSON.parse(row.installScript),
    // V3: Enhanced startup configuration with readyRegex and stopCommand
    startup: JSON.parse(row.startup || '{"userEditable":false}'),
    // V3: Features section
    features: features,
    // V3: Meta section
    meta: meta,
    recommendedRequirements: row.recommendedRequirements ? JSON.parse(row.recommendedRequirements) : undefined,
    createdAt: parseDate(row.createdAt),
    updatedAt: parseDate(row.updatedAt)
  };
};

export function createUnitsRepository({ db }: DatabaseContext) {
  // Migration function
  function migrateToV3(db) {
    // Check if schema migration is needed
    const tableInfo = db.prepare("PRAGMA table_info(units)").all() as any[];
    const hasDockerImages = tableInfo.some(col => col.name === 'dockerImages');
    const hasDefaultDockerImage = tableInfo.some(col => col.name === 'defaultDockerImage');
    const hasFeatures = tableInfo.some(col => col.name === 'features');
    const hasMeta = tableInfo.some(col => col.name === 'meta');
    
    if (!hasDockerImages || !hasDefaultDockerImage || !hasFeatures || !hasMeta) {
      console.log("Migrating units table to V3 schema...");
      
      // Start a transaction
      db.prepare("BEGIN TRANSACTION").run();
      
      try {
        if (!hasDockerImages) {
          db.prepare("ALTER TABLE units ADD COLUMN dockerImages TEXT").run();
        }
        
        if (!hasDefaultDockerImage) {
          db.prepare("ALTER TABLE units ADD COLUMN defaultDockerImage TEXT").run();
        }
        
        if (!hasFeatures) {
          db.prepare("ALTER TABLE units ADD COLUMN features TEXT").run();
        }
        
        if (!hasMeta) {
          db.prepare("ALTER TABLE units ADD COLUMN meta TEXT").run();
        }
        
        // Update existing records to set dockerImages based on dockerImage
        const units = db.prepare("SELECT id, dockerImage FROM units").all();
        const updateStmt = db.prepare(
          "UPDATE units SET dockerImages = ?, defaultDockerImage = ?, features = ?, meta = ? WHERE id = ?"
        );
        
        for (const unit of units) {
          if (unit.dockerImage) {
            const dockerImages = JSON.stringify([
              { image: unit.dockerImage, displayName: 'Default Image' }
            ]);
            const features = JSON.stringify([]);
            const meta = JSON.stringify({ version: 'argon/unit:v3' });
            
            updateStmt.run(dockerImages, unit.dockerImage, features, meta, unit.id);
          }
        }
        
        // Commit the transaction
        db.prepare("COMMIT").run();
        console.log("Migration to Units v3 completed successfully");
      } catch (error) {
        // Rollback on error
        db.prepare("ROLLBACK").run();
        console.error("Migration to Units v3 failed:", error);
        throw error;
      }
    }
  }
  
  // Run migration on repository creation
  migrateToV3(db);

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
      // V3: Handle Docker images
      const dockerImages = data.dockerImages || [];
      const defaultDockerImage = data.defaultDockerImage || (dockerImages.length > 0 ? dockerImages[0].image : data.dockerImage);
      
      // For backward compatibility
      const dockerImage = defaultDockerImage || data.dockerImage;

      // V3: Handle features
      const features = data.features || [];
      
      // V3: Handle meta - ensure it has a version
      const meta = data.meta || { version: 'argon/unit:v3' };
      if (!meta.version) {
        meta.version = 'argon/unit:v3';
      }

      const unit = {
        id: randomUUID(),
        ...data,
        dockerImages,
        defaultDockerImage,
        dockerImage,
        features,
        meta,
        configFiles: data.configFiles || [],
        environmentVariables: data.environmentVariables || [],
        startup: data.startup || { userEditable: false },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.prepare(`
        INSERT INTO units (
          id, name, shortName, description, dockerImage, defaultDockerImage, dockerImages,
          defaultStartupCommand, configFiles, environmentVariables,
          installScript, startup, features, meta, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        unit.id,
        unit.name,
        unit.shortName,
        unit.description,
        unit.dockerImage,
        unit.defaultDockerImage,
        JSON.stringify(unit.dockerImages),
        unit.defaultStartupCommand,
        JSON.stringify(unit.configFiles),
        JSON.stringify(unit.environmentVariables),
        JSON.stringify(unit.installScript),
        JSON.stringify(unit.startup),
        JSON.stringify(unit.features),
        JSON.stringify(unit.meta),
        unit.createdAt.toISOString(),
        unit.updatedAt.toISOString()
      );

      return unit;
    },

    update: async (where: { id: string }, data: Partial<Unit>): Promise<Unit> => {
      const current = await repository.findUnique(where);
      if (!current) throw new Error('Unit not found');

      // Handle V3 Docker image updates
      let dockerImages = data.dockerImages !== undefined ? data.dockerImages : current.dockerImages;
      let defaultDockerImage = data.defaultDockerImage !== undefined ? data.defaultDockerImage : current.defaultDockerImage;
      
      // For backward compatibility
      let dockerImage = defaultDockerImage;
      
      // If only dockerImage is provided (backward compatibility)
      if (data.dockerImage && !data.dockerImages && !data.defaultDockerImage) {
        dockerImage = data.dockerImage;
        defaultDockerImage = data.dockerImage;
        
        // Check if the image is already in the dockerImages array
        if (!dockerImages.some(di => di.image === dockerImage)) {
          dockerImages = [
            ...dockerImages,
            { image: dockerImage, displayName: 'Updated Image' }
          ];
        }
      }
      
      // V3: Handle features update
      const features = data.features !== undefined ? data.features : current.features || [];
      
      // V3: Handle meta update
      let meta = data.meta !== undefined ? data.meta : current.meta || { version: 'argon/unit:v3' };
      if (!meta.version) {
        meta.version = 'argon/unit:v3';
      }

      const updated = {
        ...current,
        ...data,
        // V3 fields
        dockerImages,
        defaultDockerImage,
        dockerImage,
        features,
        meta,
        // Ensure arrays have defaults if not provided in update
        configFiles: data.configFiles || current.configFiles,
        environmentVariables: data.environmentVariables || current.environmentVariables,
        startup: data.startup || current.startup,
        updatedAt: new Date()
      };

      db.prepare(`
        UPDATE units
        SET name = ?, shortName = ?, description = ?, dockerImage = ?,
            defaultDockerImage = ?, dockerImages = ?,
            defaultStartupCommand = ?, configFiles = ?, environmentVariables = ?,
            installScript = ?, startup = ?, features = ?, meta = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        updated.name,
        updated.shortName,
        updated.description,
        updated.dockerImage,
        updated.defaultDockerImage,
        JSON.stringify(updated.dockerImages),
        updated.defaultStartupCommand,
        JSON.stringify(updated.configFiles),
        JSON.stringify(updated.environmentVariables),
        JSON.stringify(updated.installScript),
        JSON.stringify(updated.startup),
        JSON.stringify(updated.features),
        JSON.stringify(updated.meta),
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
    },

    // Get cargo containers for a unit
    getUnitCargoContainers: async (unitId: string) => {
      const rows = db.prepare(`
        SELECT cc.* 
        FROM cargo_containers cc
        JOIN unit_cargo_containers ucc ON cc.id = ucc.container_id
        WHERE ucc.unit_id = ?
      `).all(unitId) as any[];

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        items: JSON.parse(row.items || '[]'),
        createdAt: parseDate(row.createdAt),
        updatedAt: parseDate(row.updatedAt)
      }));
    },

    // Assign a cargo container to a unit
    assignCargoContainer: async (unitId: string, containerId: string) => {
      db.prepare(`
        INSERT OR IGNORE INTO unit_cargo_containers (unit_id, container_id, created_at)
        VALUES (?, ?, datetime('now'))
      `).run(unitId, containerId);
    },

    // Remove a cargo container from a unit
    removeCargoContainer: async (unitId: string, containerId: string) => {
      db.prepare(`
        DELETE FROM unit_cargo_containers
        WHERE unit_id = ? AND container_id = ?
      `).run(unitId, containerId);
    }
  };

  return repository;
}