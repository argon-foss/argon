// @ts-ignore
import { Database } from 'bun:sqlite';
import { initSchema } from './db/schema';
import { createUsersRepository } from './db/users';
import { createNodesRepository } from './db/nodes';
import { createUnitsRepository } from './db/units';
import { createAllocationsRepository } from './db/allocations';
import { createServersRepository } from './db/servers';
import { createCargoRepository } from './db/cargo';

export class DB {
  private db: Database;
  readonly users;
  readonly nodes;
  readonly units;
  readonly allocations;
  readonly servers;
  readonly cargo;

  constructor() {
    this.db = new Database('argon.db');
    initSchema(this.db);

    const context = { db: this.db };
    this.users = createUsersRepository(context);
    this.nodes = createNodesRepository(context);
    this.units = createUnitsRepository(context);
    this.allocations = createAllocationsRepository(context);
    this.servers = createServersRepository(context);
    this.cargo = createCargoRepository(context);
  }
}

export const db = new DB();