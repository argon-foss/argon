// src/db/regions.ts
import { randomUUID } from 'crypto';
import { DatabaseContext, Region } from './types';
import { parseDate } from './utils';

const parseRegionRow = (row: any): Region => ({
  ...row,
  serverLimit: row.serverLimit ? Number(row.serverLimit) : null,
  createdAt: parseDate(row.createdAt),
  updatedAt: parseDate(row.updatedAt)
});

export function createRegionsRepository({ db }: DatabaseContext) {
  const repository = {
    findMany: async ({ where }: { where?: any } = {}): Promise<Region[]> => {
      const conditions = where ? Object.entries(where).map(([key]) => `${key} = ?`) : [];
      const values = where ? Object.values(where) : [];
      
      const query = conditions.length 
        ? `SELECT * FROM regions WHERE ${conditions.join(' AND ')}`
        : 'SELECT * FROM regions';

      const rows = db.prepare(query).all(...values) as any[];
      const regions = rows.map(parseRegionRow);

      // Load nodes for each region
      for (const region of regions) {
        const nodeRows = db.prepare(`
          SELECT * FROM nodes WHERE regionId = ?
        `).all(region.id) as any[];
        
        region.nodes = nodeRows.map(node => ({
          ...node,
          isOnline: !!node.isOnline,
          lastChecked: parseDate(node.lastChecked),
          createdAt: parseDate(node.createdAt),
          updatedAt: parseDate(node.updatedAt)
        }));
      }

      return regions;
    },

    findUnique: async ({ id }: { id: string }): Promise<Region | null> => {
      const row = db.prepare('SELECT * FROM regions WHERE id = ?').get(id) as any;
      
      if (!row) return null;
      
      const region = parseRegionRow(row);
      
      // Load fallback region if exists
      if (region.fallbackRegionId) {
        const fallbackRow = db.prepare('SELECT * FROM regions WHERE id = ?').get(region.fallbackRegionId) as any;
        if (fallbackRow) {
          region.fallbackRegion = parseRegionRow(fallbackRow);
        }
      }
      
      // Load nodes for this region
      const nodeRows = db.prepare(`
        SELECT * FROM nodes WHERE regionId = ?
      `).all(region.id) as any[];
      
      region.nodes = nodeRows.map(node => ({
        ...node,
        isOnline: !!node.isOnline,
        lastChecked: parseDate(node.lastChecked),
        createdAt: parseDate(node.createdAt),
        updatedAt: parseDate(node.updatedAt)
      }));
      
      return region;
    },

    findByIdentifier: async ({ identifier }: { identifier: string }): Promise<Region | null> => {
      const row = db.prepare('SELECT * FROM regions WHERE identifier = ?').get(identifier) as any;
      
      if (!row) return null;
      
      const region = parseRegionRow(row);
      
      // Load fallback region if exists
      if (region.fallbackRegionId) {
        const fallbackRow = db.prepare('SELECT * FROM regions WHERE id = ?').get(region.fallbackRegionId) as any;
        if (fallbackRow) {
          region.fallbackRegion = parseRegionRow(fallbackRow);
        }
      }
      
      // Load nodes for this region
      const nodeRows = db.prepare(`
        SELECT * FROM nodes WHERE regionId = ?
      `).all(region.id) as any[];
      
      region.nodes = nodeRows.map(node => ({
        ...node,
        isOnline: !!node.isOnline,
        lastChecked: parseDate(node.lastChecked),
        createdAt: parseDate(node.createdAt),
        updatedAt: parseDate(node.updatedAt)
      }));
      
      return region;
    },

    create: async (data: Omit<Region, 'id' | 'createdAt' | 'updatedAt' | 'nodes'>): Promise<Region> => {
      const region = {
        id: randomUUID(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.prepare(`
        INSERT INTO regions (
          id, name, identifier, countryId, fallbackRegionId, 
          serverLimit, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        region.id,
        region.name,
        region.identifier,
        region.countryId || null,
        region.fallbackRegionId || null,
        region.serverLimit || null,
        region.createdAt.toISOString(),
        region.updatedAt.toISOString()
      );

      return {
        ...region,
        nodes: []
      };
    },

    update: async ({ id }: { id: string }, data: Partial<Region>): Promise<Region> => {
      const current = await repository.findUnique({ id });
      if (!current) throw new Error('Region not found');

      const updated = {
        ...current,
        ...data,
        updatedAt: new Date()
      };

      db.prepare(`
        UPDATE regions
        SET name = ?, identifier = ?, countryId = ?, 
            fallbackRegionId = ?, serverLimit = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        updated.name,
        updated.identifier,
        updated.countryId || null,
        updated.fallbackRegionId || null,
        updated.serverLimit || null,
        updated.updatedAt.toISOString(),
        id
      );

      return updated;
    },

    delete: async ({ id }: { id: string }): Promise<void> => {
      // First check if any nodes are assigned to this region
      const nodeCount = db.prepare('SELECT COUNT(*) as count FROM nodes WHERE regionId = ?').get(id) as { count: number };
      
      if (nodeCount.count > 0) {
        throw new Error('Cannot delete region with assigned nodes');
      }
      
      // Check if any other regions use this as a fallback region
      const fallbackCount = db.prepare('SELECT COUNT(*) as count FROM regions WHERE fallbackRegionId = ?').get(id) as { count: number };
      
      if (fallbackCount.count > 0) {
        throw new Error('Cannot delete region that is used as a fallback by other regions');
      }

      const result = db.prepare('DELETE FROM regions WHERE id = ?').run(id);
      if (result.changes === 0) {
        throw new Error('Region not found');
      }
    },

    // Function to find the best node in a region for a new server
    findBestNodeInRegion: async (regionId: string): Promise<string | null> => {
      const region = await repository.findUnique({ id: regionId });
      if (!region) return null;
      
      // First, get all online nodes in this region
      const onlineNodes = region.nodes.filter(node => node.isOnline);
      
      if (onlineNodes.length === 0) {
        // If no nodes are online in this region, check fallback region if configured
        if (region.fallbackRegionId) {
          return repository.findBestNodeInRegion(region.fallbackRegionId);
        }
        return null;
      }
      
      // Get server count for each node
      const nodeServerCounts = await Promise.all(onlineNodes.map(async node => {
        const result = db.prepare('SELECT COUNT(*) as count FROM servers WHERE nodeId = ?').get(node.id) as { count: number };
        return {
          nodeId: node.id,
          serverCount: result.count
        };
      }));
      
      // Find the node with the fewest servers
      const bestNode = nodeServerCounts.sort((a, b) => a.serverCount - b.serverCount)[0];
      
      return bestNode.nodeId;
    },

    // Check if a region has reached its server limit
    isRegionAtCapacity: async (regionId: string): Promise<boolean> => {
      const region = await repository.findUnique({ id: regionId });
      if (!region) return true;
      
      // If no server limit is set, the region is not at capacity
      if (!region.serverLimit) return false;
      
      // Count servers across all nodes in this region
      const nodeIds = region.nodes.map(node => `'${node.id}'`).join(',');
      
      if (nodeIds.length === 0) return true;
      
      const result = db.prepare(`
        SELECT COUNT(*) as count FROM servers 
        WHERE nodeId IN (${nodeIds})
      `).get() as { count: number };
      
      return result.count >= region.serverLimit;
    }
  };

  return repository;
}