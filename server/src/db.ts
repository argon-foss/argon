// @ts-ignore
import { Database } from 'bun:sqlite';
import { createUsersRepository } from './db/users';
import { createNodesRepository } from './db/nodes';
import { createUnitsRepository } from './db/units';
import { createAllocationsRepository } from './db/allocations';
import { createServersRepository } from './db/servers';
import { createCargoRepository } from './db/cargo';
import { createProjectsRepository } from './db/projects';
import { createRegionsRepository } from './db/regions';
import { createApiKeysRepository } from './db/apiKeys';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get application root path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const MIGRATIONS_DIR = join(PROJECT_ROOT, 'migrations');

// Environment detection
const isMigrationCommand = process.argv.includes('bolt') && 
                          process.argv.includes('migrate');

export class DB {
  db: Database;
  readonly users;
  readonly nodes;
  readonly units;
  readonly allocations;
  readonly servers;
  readonly cargo;
  readonly projects;
  readonly regions;
  readonly apiKeys;

  constructor(dbPath: string = 'argon.db') {
    this.db = new Database(dbPath);
    
    // Enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON;');
    
    // Skip validation if we're running a migration command
    if (!isMigrationCommand) {
      this.validateSchema();
    } else {
      // For migration commands, just ensure migrations table exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          executed_at TEXT NOT NULL
        );
      `);
    }

    const context = { db: this.db };
    
    // Only initialize repositories if we're not running migrations or if schema is valid
    if (isMigrationCommand || this.isSchemaValid()) {
      this.users = createUsersRepository(context);
      this.nodes = createNodesRepository(context);
      this.units = createUnitsRepository(context);
      this.allocations = createAllocationsRepository(context);
      this.servers = createServersRepository(context);
      this.cargo = createCargoRepository(context);
      this.projects = createProjectsRepository(context);
      this.regions = createRegionsRepository(context);
      this.apiKeys = createApiKeysRepository(context);
    }
  }

  private isSchemaValid(): boolean {
    const requiredTables = [
      'users', 'nodes', 'units', 'allocations', 'servers', 
      'cargo', 'cargo_containers', 'unit_cargo_containers', 'projects', 'regions', 'api_keys'
    ];

    const existingTables = this.db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];

    const existingTableNames = new Set(existingTables.map(t => t.name));
    const missingTables = requiredTables.filter(t => !existingTableNames.has(t));

    return missingTables.length === 0;
  }

  private validateSchema() {
    // Check if required tables exist
    const requiredTables = [
      'users', 'nodes', 'units', 'allocations', 'servers', 
      'cargo', 'cargo_containers', 'unit_cargo_containers', 'projects', 'regions', 'api_keys'
    ];

    const existingTables = this.db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];

    const existingTableNames = new Set(existingTables.map(t => t.name));
    const missingTables = requiredTables.filter(t => !existingTableNames.has(t));

    // Check if migrations table exists
    const hasMigrationsTable = existingTableNames.has('migrations');

    if (missingTables.length > 0) {
      console.error(chalk.red('Database schema is incomplete. Missing tables:'));
      missingTables.forEach(table => {
        console.error(chalk.red(`- ${table}`));
      });
      
      // Check if migrations directory exists and contains the initial migration
      const initialMigrationExists = this.checkInitialMigration();
      
      if (initialMigrationExists) {
        console.error(chalk.yellow('\nPlease run Bolt migrations to set up the database:'));
        console.error(chalk.blue('  argon bolt migrate --run'));
      } else {
        console.error(chalk.yellow('\nInitial migration not found. Please ensure you have the init_schema migration in your migrations folder:'));
        console.error(chalk.blue('  migrations/[timestamp]_init_schema.ts'));
        console.error(chalk.yellow('\nThen run migrations:'));
        console.error(chalk.blue('  argon bolt migrate --run'));
      }
      
      process.exit(1);
    } else if (!hasMigrationsTable) {
      // If all tables exist but migrations table doesn't, it means the schema was 
      // created using the old method instead of migrations
      console.warn(chalk.yellow('\nWarning: Database exists but wasn\'t created using migrations.'));
      console.warn(chalk.yellow('This may cause issues with future updates.'));
      console.warn(chalk.yellow('Consider backing up your data and recreating the database using migrations.'));
      
      // Create migrations table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          executed_at TEXT NOT NULL
        );
      `);
    }
  }

  private checkInitialMigration(): boolean {
    if (!existsSync(MIGRATIONS_DIR)) {
      return false;
    }

    try {
      const fs = require('fs');
      const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter((file: string) => file.endsWith('.ts') && file.includes('init_schema'));
      
      return migrationFiles.length > 0;
    } catch (error) {
      console.error(chalk.red(`Error checking migrations: ${error.message}`));
      return false;
    }
  }
}

export const db = new DB();