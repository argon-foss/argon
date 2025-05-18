// src/db/types.ts
// @ts-ignore
import { Database } from 'bun:sqlite';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  userId: string;
  permissions: string[];
  lastUsed: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface User {
  id: string;
  username: string;
  password: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Node {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  connectionKey: string;
  isOnline: boolean;
  lastChecked: Date;
  regionId?: string | null; // reference to a region
  region?: Region | null; // populated on queries when regionId exists
  createdAt: Date;
  updatedAt: Date;
}

export interface Allocation {
  id: string;
  nodeId: string;
  bindAddress: string;
  port: number;
  alias?: string;
  notes?: string;
  assigned: boolean;
  serverId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Unit {
  id: string;
  name: string;
  shortName: string;
  description: string;
  dockerImage: string;
  defaultStartupCommand: string;
  configFiles: Array<{ path: string; content: string; }>;
  environmentVariables: Array<{
    name: string;
    description?: string;
    defaultValue: string;
    required: boolean;
    userViewable: boolean;
    userEditable: boolean;
    rules: string;
  }>;
  installScript: {
    dockerImage: string;
    entrypoint: string;
    script: string;
  };
  startup: {
    done?: string;
    userEditable: boolean;
  };
  recommendedRequirements?: {
    memoryMiB?: number;
    diskMiB?: number;
    cpuPercent?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Server {
  id: string;
  internalId: string;
  name: string;
  nodeId: string;
  unitId: string;
  userId: string;
  allocationId: string;
  memoryMiB: number;
  diskMiB: number;
  cpuPercent: number;
  state: string;
  createdAt: Date;
  updatedAt: Date;
  node?: Node;
  unit?: Unit;
  user?: {
    id: string;
    username: string;
  };
  allocation?: Allocation;
  validationToken?: string;
  projectId?: string | null;
  project?: Project;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Region {
  id: string;
  name: string;
  identifier: string; // lowercase one-word identifier like "eu-north"
  countryId?: string | null; // optional country code (e.g., "EU", "GB")
  fallbackRegionId?: string | null; // ID of a fallback region
  fallbackRegion?: Region | null; // Populated on queries when fallbackRegionId exists
  serverLimit?: number | null; // Optional limit of servers in this region
  nodes: Node[]; // Nodes in this region (populated on queries)
  createdAt: Date;
  updatedAt: Date;
}

export type WhereInput<T> = Partial<{ [K in keyof T]: T[K] }>;
export type OrderByInput<T> = Partial<{ [K in keyof T]: 'asc' | 'desc' }>;

export interface QueryOptions<T> {
  where?: WhereInput<T>;
  orderBy?: OrderByInput<T>;
  include?: Record<string, boolean | Record<string, boolean>>;
}

export interface DatabaseContext {
  db: Database;
}