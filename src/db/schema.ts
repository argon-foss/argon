export const initSchema = (db) => {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      fqdn TEXT NOT NULL,
      port INTEGER NOT NULL,
      connectionKey TEXT NOT NULL,
      isOnline BOOLEAN NOT NULL DEFAULT FALSE,
      lastChecked TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      shortName TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      dockerImage TEXT NOT NULL,
      defaultStartupCommand TEXT NOT NULL,
      configFiles TEXT NOT NULL DEFAULT '[]',
      environmentVariables TEXT NOT NULL DEFAULT '[]',
      installScript TEXT NOT NULL,
      startup TEXT NOT NULL DEFAULT '{}',
      recommendedRequirements TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS allocations (
      id TEXT PRIMARY KEY,
      nodeId TEXT NOT NULL,
      bindAddress TEXT NOT NULL,
      port INTEGER NOT NULL,
      alias TEXT,
      notes TEXT,
      assigned BOOLEAN NOT NULL DEFAULT FALSE,
      serverId TEXT UNIQUE,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(nodeId) REFERENCES nodes(id)
    );

CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  internalId TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  nodeId TEXT NOT NULL,
  unitId TEXT NOT NULL,
  userId TEXT NOT NULL,
  allocationId TEXT NOT NULL,
  memoryMiB INTEGER NOT NULL,
  diskMiB INTEGER NOT NULL,
  cpuPercent INTEGER NOT NULL,
  state TEXT NOT NULL,
  validationToken TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY(nodeId) REFERENCES nodes(id),
  FOREIGN KEY(unitId) REFERENCES units(id),
  FOREIGN KEY(userId) REFERENCES users(id),
  FOREIGN KEY(allocationId) REFERENCES allocations(id)
);

CREATE TABLE IF NOT EXISTS allocations (
  id TEXT PRIMARY KEY,
  nodeId TEXT NOT NULL,
  bindAddress TEXT NOT NULL,
  port INTEGER NOT NULL,
  alias TEXT,
  notes TEXT,
  assigned BOOLEAN NOT NULL DEFAULT FALSE,
  serverId TEXT UNIQUE REFERENCES servers(id),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY(nodeId) REFERENCES nodes(id)
);

    CREATE INDEX IF NOT EXISTS idx_servers_userid ON servers(userId);
    CREATE INDEX IF NOT EXISTS idx_servers_nodeid ON servers(nodeId);
    CREATE INDEX IF NOT EXISTS idx_allocations_nodeid ON allocations(nodeId);
    CREATE INDEX IF NOT EXISTS idx_allocations_serverid ON allocations(serverId);
  `);
};