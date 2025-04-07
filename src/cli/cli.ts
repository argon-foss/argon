#!/usr/bin/env bun
// @ts-nocheck
/**
 * Argon CLI
 * Version v1.0.0-dev (Revenant)
 * (c) 2017 - 2025 ether
 */

import { Command } from 'commander';
import { hash } from 'bcrypt';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { Database } from 'bun:sqlite';
import { spawn, spawnSync } from 'child_process';

// Get application root path (resolving symlinks for global installation)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// CLI is in src/cli/cli.ts, so go up two levels to reach project root
const PROJECT_ROOT = join(__dirname, '..', '..');

// Helper function to recursively list files
function listFilesRecursively(dir: string): string[] {
  let results: string[] = [];
  const list = readdirSync(dir);
  
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(listFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  }
  
  return results;
}

// Import the DB and Permissions from their original paths
let db;
let Permissions;

try {
  // Dynamic imports to avoid path issues
  const { DB } = await import(join(PROJECT_ROOT, 'src', 'db.ts'));
  Permissions = (await import(join(PROJECT_ROOT, 'src', 'permissions.ts'))).Permissions;
  
  // Initialize DB with the correct path
  class ArgonDB extends DB {
    constructor() {
      // Pass custom database path to parent constructor
      super(join(PROJECT_ROOT, 'argon.db'));
    }
  }
  
  db = new ArgonDB();
} catch (error) {
  console.error(chalk.red(`Error loading required modules: ${error.message}`));
  console.error(chalk.yellow(`Make sure you're running the CLI from within an Argon project or using the global installation correctly.`));
  process.exit(1);
}

const program = new Command();

program
  .command('where')
  .description('Show which Argon instance this CLI is operating on')
  .action(() => {
    console.log(chalk.blue(`Argon CLI location: ${__filename}`));
    console.log(chalk.blue(`Project root: ${PROJECT_ROOT}`));
    console.log(chalk.blue(`Database location: ${join(PROJECT_ROOT, 'argon.db')}`));
    
    // Check if this appears to be a valid Argon installation
    const packageJsonPath = join(PROJECT_ROOT, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        console.log(chalk.blue(`Package name: ${packageJson.name}`));
        console.log(chalk.blue(`Version: ${packageJson.version}`));
      } catch (error) {
        console.error(chalk.yellow(`Could not read package.json: ${error.message}`));
      }
    } else {
      console.warn(chalk.yellow(`Warning: This doesn't appear to be a valid Argon installation (no package.json found)`));
    }
  });
  
// Setup CLI metadata
program
  .name('argon')
  .description('Argon CLI for management')
  .version('v1.0.0-dev (Revenant)');

// User Create Command
program
  .command('user:create')
  .description('Create a new user')
  .option('-u, --username <username>', 'Username for the new user')
  .option('-p, --password <password>', 'Password for the new user')
  .option('-P, --permissions <permissions>', 'Comma-separated list of permissions')
  .action(async (options) => {
    try {
      // If options are not provided, prompt for them
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: 'Enter username:',
          when: !options.username,
          validate: (input) => input.length > 0 ? true : 'Username cannot be empty'
        },
        {
          type: 'password',
          name: 'password',
          message: 'Enter password:',
          when: !options.password,
          mask: '*',
          validate: (input) => input.length >= 8 ? true : 'Password must be at least 8 characters'
        },
        {
          type: 'checkbox',
          name: 'permissions',
          message: 'Select permissions:',
          when: !options.permissions,
          choices: Object.entries(Permissions).map(([key, value]) => ({
            name: key,
            value: value
          }))
        }
      ]);

      const username = options.username || answers.username;
      const password = options.password || answers.password;
      let permissions = options.permissions ? 
        options.permissions.split(',').reduce((acc, perm) => acc | Permissions[perm.trim().toUpperCase()], 0) :
        answers.permissions.reduce((acc, perm) => acc | perm, 0);

      // Check if user already exists
      const existingUser = await db.users.getUserByUsername(username);
      if (existingUser) {
        console.error(chalk.red(`Error: User '${username}' already exists`));
        process.exit(1);
      }

      // Hash password and create user
      const hashedPassword = await hash(password, 10);
      const user = await db.users.createUser(username, hashedPassword, permissions);
      
      console.log(chalk.green('User created successfully:'));
      console.log(chalk.green(`ID: ${user.id}`));
      console.log(chalk.green(`Username: ${user.username}`));
      console.log(chalk.green(`Permissions: ${formatPermissions(user.permissions)}`));
    } catch (error) {
      console.error(chalk.red(`Error creating user: ${error.message}`));
      process.exit(1);
    }
  });

// User Delete Command
program
  .command('user:delete')
  .description('Delete a user')
  .option('-i, --id <id>', 'User ID to delete')
  .option('-u, --username <username>', 'Username to delete')
  .option('-f, --force', 'Force deletion without confirmation')
  .action(async (options) => {
    try {
      if (!options.id && !options.username) {
        const users = await db.users.findMany();
        
        const { userId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'userId',
            message: 'Select user to delete:',
            choices: users.map(user => ({
              name: `${user.username} (ID: ${user.id})`,
              value: user.id
            }))
          }
        ]);
        
        options.id = userId;
      }

      let user;
      if (options.id) {
        user = await db.users.findUnique({ id: options.id });
      } else if (options.username) {
        user = await db.users.getUserByUsername(options.username);
      }

      if (!user) {
        console.error(chalk.red('Error: User not found'));
        process.exit(1);
      }

      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete user '${user.username}'?`,
            default: false
          }
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Deletion cancelled'));
          process.exit(0);
        }
      }

      await db.users.delete({ id: user.id });
      console.log(chalk.green(`User '${user.username}' deleted successfully`));
    } catch (error) {
      console.error(chalk.red(`Error deleting user: ${error.message}`));
      process.exit(1);
    }
  });

// User Modify Command
program
  .command('user:modify')
  .description('Modify an existing user')
  .option('-i, --id <id>', 'User ID to modify')
  .option('-u, --username <username>', 'Username to modify')
  .option('-n, --new-username <newUsername>', 'New username')
  .option('-p, --password', 'Change password')
  .option('-P, --permissions <permissions>', 'Comma-separated list of permissions')
  .action(async (options) => {
    try {
      if (!options.id && !options.username) {
        const users = await db.users.findMany();
        
        const { userId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'userId',
            message: 'Select user to modify:',
            choices: users.map(user => ({
              name: `${user.username} (ID: ${user.id})`,
              value: user.id
            }))
          }
        ]);
        
        options.id = userId;
      }

      let user;
      if (options.id) {
        user = await db.users.findUnique({ id: options.id });
      } else if (options.username) {
        user = await db.users.getUserByUsername(options.username);
      }

      if (!user) {
        console.error(chalk.red('Error: User not found'));
        process.exit(1);
      }

      const updates: any = {};

      // If no specific modification options are provided, prompt for what to change
      if (!options.newUsername && !options.password && !options.permissions) {
        const { modifications } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'modifications',
            message: 'What would you like to modify?',
            choices: [
              { name: 'Username', value: 'username' },
              { name: 'Password', value: 'password' },
              { name: 'Permissions', value: 'permissions' }
            ]
          }
        ]);

        if (modifications.includes('username')) {
          options.newUsername = true;
        }
        
        if (modifications.includes('password')) {
          options.password = true;
        }

        if (modifications.includes('permissions')) {
          options.permissions = true;
        }
      }

      // Prompt for new username if requested
      if (options.newUsername === true) {
        const { newUsername } = await inquirer.prompt([
          {
            type: 'input',
            name: 'newUsername',
            message: 'Enter new username:',
            default: user.username,
            validate: (input) => input.length > 0 ? true : 'Username cannot be empty'
          }
        ]);
        updates.username = newUsername;
      } else if (typeof options.newUsername === 'string') {
        updates.username = options.newUsername;
      }

      // Prompt for new password if requested
      if (options.password) {
        const { newPassword } = await inquirer.prompt([
          {
            type: 'password',
            name: 'newPassword',
            message: 'Enter new password:',
            mask: '*',
            validate: (input) => input.length >= 8 ? true : 'Password must be at least 8 characters'
          }
        ]);
        updates.password = await hash(newPassword, 10);
      }

      // Handle permissions
      if (options.permissions === true) {
        const { newPermissions } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'newPermissions',
            message: 'Select permissions:',
            choices: Object.entries(Permissions).map(([key, value]) => ({
              name: key,
              value: value,
              checked: Boolean(user.permissions & (value as unknown as number))
            }))
          }
        ]);
        updates.permissions = newPermissions.reduce((acc, perm) => acc | perm, 0);
      } else if (typeof options.permissions === 'string') {
        updates.permissions = options.permissions
          .split(',')
          .reduce((acc, perm) => acc | Permissions[perm.trim().toUpperCase()], 0);
      }

      if (Object.keys(updates).length === 0) {
        console.log(chalk.yellow('No changes requested'));
        process.exit(0);
      }

      const updatedUser = await db.users.updateUser({ id: user.id }, updates);
      console.log(chalk.green('User updated successfully:'));
      console.log(chalk.green(`ID: ${updatedUser.id}`));
      console.log(chalk.green(`Username: ${updatedUser.username}`));
      console.log(chalk.green(`Permissions: ${formatPermissions(updatedUser.permissions)}`));
    } catch (error) {
      console.error(chalk.red(`Error modifying user: ${error.message}`));
      process.exit(1);
    }
  });

// =========== BOLT COMMANDS ===========
// Bolt - Database Management System

// Create a bolt command group
const boltCommand = program
  .command('bolt')
  .description('Argon database management system');

// Bolt SQL command - Interactive SQL shell
boltCommand
  .command('sql')
  .description('Start an interactive SQL shell for the Argon database')
  .option('-q, --query <sql>', 'Execute a single SQL query and exit')
  .action(async (options) => {
    const dbPath = join(PROJECT_ROOT, 'argon.db');
    
    if (!existsSync(dbPath)) {
      console.error(chalk.red(`Database file not found at ${dbPath}`));
      process.exit(1);
    }
    
    if (options.query) {
      // Execute a single query and print results
      try {
        const db = new Database(dbPath);
        const results = db.query(options.query).all();
        console.table(results);
        process.exit(0);
      } catch (error) {
        console.error(chalk.red(`SQL Error: ${error.message}`));
        process.exit(1);
      }
    } else {
      // Start interactive SQL shell
      console.log(chalk.blue('=== Argon Bolt SQL Shell ==='));
      console.log(chalk.blue(`Connected to database: ${dbPath}`));
      console.log(chalk.blue('Enter SQL commands or "exit" to quit'));
      console.log(chalk.blue('-------------------------------'));
      
      const db = new Database(dbPath);
      
      // Simple REPL for SQL
      const repl = async () => {
        try {
          const { sql } = await inquirer.prompt([
            {
              type: 'input',
              name: 'sql',
              message: 'sql> ',
              validate: input => input.trim().length > 0 ? true : 'Please enter a SQL command'
            }
          ]);
          
          if (sql.toLowerCase() === 'exit') {
            console.log(chalk.blue('Goodbye!'));
            process.exit(0);
          }
          
          try {
            const startTime = Date.now();
            const results = db.query(sql).all();
            const duration = Date.now() - startTime;
            
            if (results.length > 0) {
              console.table(results);
            }
            console.log(chalk.green(`Query executed successfully in ${duration}ms (${results.length} rows affected)`));
          } catch (error) {
            console.error(chalk.red(`SQL Error: ${error.message}`));
          }
          
          // Continue REPL
          await repl();
        } catch (error) {
          console.error(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
      };
      
      await repl();
    }
  });

// Bolt Migrate command - Database migration
boltCommand
  .command('migrate')
  .description('Run database migrations')
  .option('-c, --create <name>', 'Create a new migration')
  .option('-r, --run', 'Run pending migrations')
  .option('-l, --list', 'List all migrations and their status')
  .option('-f, --force', 'Force run all migrations, even if previously applied')
  .action(async (options) => {
    const migrationsDir = join(PROJECT_ROOT, 'migrations');
    
    // Check if migrations directory exists
    if (!existsSync(migrationsDir)) {
      console.log(chalk.yellow(`Migrations directory not found. Creating at ${migrationsDir}`));
      // Create migrations directory correctly
      try {
        await mkdir(migrationsDir, { recursive: true });
        console.log(chalk.green(`Migrations directory created at ${migrationsDir}`));
      } catch (error) {
        console.error(chalk.red(`Failed to create migrations directory: ${error.message}`));
        process.exit(1);
      }
    }
    
    // Create a new migration file
    if (options.create) {
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const migrationName = `${timestamp}_${options.create.replace(/\s+/g, '_')}`;
      const migrationPath = join(migrationsDir, `${migrationName}.ts`);
      
      const migrationTemplate = `/**
 * Migration: ${options.create}
 * Generated: ${new Date().toISOString()}
 */

import { Database } from 'bun:sqlite';

export function up(db: Database) {
  // Write your migration code here
  db.exec(\`
    -- Your SQL to apply changes
  \`);
}

export function down(db: Database) {
  // Write your rollback code here
  db.exec(\`
    -- Your SQL to rollback changes
  \`);
}
`;

      await Bun.write(migrationPath, migrationTemplate);
      console.log(chalk.green(`Migration created at ${migrationPath}`));
      process.exit(0);
    }
    
    // List migrations
    if (options.list) {
      const dbPath = join(PROJECT_ROOT, 'argon.db');
      const db = new Database(dbPath);
      
      // Create migrations table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          executed_at TEXT NOT NULL
        );
      `);
      
      // Get applied migrations
      const applied = db.query(`SELECT id FROM migrations`).all() as { id: string }[];
      const appliedIds = new Set(applied.map(m => m.id));
      
      // Get migration files
      const migrationFiles = listFilesRecursively(migrationsDir)
        .filter(file => file.endsWith('.ts'))
        .map(file => {
          const filename = file.split('/').pop() || '';
          const id = filename.split('_')[0];
          const name = filename.replace(/\.ts$/, '').split('_').slice(1).join('_');
          
          return {
            id,
            name,
            filename,
            path: file,
            applied: appliedIds.has(id),
            status: appliedIds.has(id) ? 'Applied' : 'Pending'
          };
        })
        .sort((a, b) => a.id.localeCompare(b.id));
      
      console.log(chalk.blue('=== Argon Migrations ==='));
      console.table(migrationFiles.map(({ id, name, status }) => ({ id, name, status })));
      
      console.log(chalk.blue(`Total: ${migrationFiles.length}, Applied: ${applied.length}, Pending: ${migrationFiles.length - applied.length}`));
      process.exit(0);
    }
    
    // Run migrations
    if (options.run || options.force) {
      const dbPath = join(PROJECT_ROOT, 'argon.db');
      const db = new Database(dbPath);
      
      // Create migrations table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          executed_at TEXT NOT NULL
        );
      `);
      
      // Get applied migrations
      const applied = db.query(`SELECT id FROM migrations`).all() as { id: string }[];
      const appliedIds = new Set(applied.map(m => m.id));
      
      // Get migration files
      const migrationFiles = listFilesRecursively(migrationsDir)
        .filter(file => file.endsWith('.ts'))
        .map(file => {
          const filename = file.split('/').pop() || '';
          const id = filename.split('_')[0];
          const name = filename.replace(/\.ts$/, '').split('_').slice(1).join('_');
          
          return {
            id,
            name,
            filename,
            path: file,
            applied: appliedIds.has(id)
          };
        })
        .sort((a, b) => a.id.localeCompare(b.id));
      
      // Filter pending migrations unless --force flag is used
      const migrationsToRun = options.force 
        ? migrationFiles 
        : migrationFiles.filter(m => !m.applied);
      
      if (migrationsToRun.length === 0) {
        console.log(chalk.green('No pending migrations to run.'));
        process.exit(0);
      }
      
      console.log(chalk.blue(`Running ${migrationsToRun.length} migrations...`));
      
      // Run migrations in sequence
      for (const migration of migrationsToRun) {
        try {
          console.log(chalk.blue(`Applying migration: ${migration.name}...`));
          
          if (migration.applied && options.force) {
            console.log(chalk.yellow(`Migration ${migration.id} already applied, rerunning due to --force`));
          }
          
          // Execute the migration script
          // We need to import and run the migration file
          const migrationModule = await import(migration.path);
          
          if (typeof migrationModule.up !== 'function') {
            throw new Error(`Migration ${migration.id} does not export an up() function`);
          }
          
          migrationModule.up(db);
          
          // Record migration as applied
          if (!migration.applied) {
            db.exec(`
              INSERT INTO migrations (id, name, executed_at)
              VALUES (?, ?, ?)
            `, [migration.id, migration.name, new Date().toISOString()]);
          }
          
          console.log(chalk.green(`Migration applied successfully: ${migration.id}`));
        } catch (error) {
          console.error(chalk.red(`Error applying migration ${migration.id}: ${error.message}`));
          process.exit(1);
        }
      }
      
      console.log(chalk.green(`Successfully applied ${migrationsToRun.length} migrations`));
      process.exit(0);
    }
    
    // If no options provided, show help
    if (!options.create && !options.list && !options.run && !options.force) {
      console.log(chalk.yellow('No action specified. Use --help to see available options.'));
      process.exit(1);
    }
  });

// Bolt backup command - Database backup
boltCommand
  .command('backup')
  .description('Backup the Argon database')
  .option('-o, --output <path>', 'Specify backup file path')
  .action(async (options) => {
    const dbPath = join(PROJECT_ROOT, 'argon.db');
    
    if (!existsSync(dbPath)) {
      console.error(chalk.red(`Database file not found at ${dbPath}`));
      process.exit(1);
    }
    
    // Generate backup filename with timestamp if not specified
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
    const defaultBackupPath = join(PROJECT_ROOT, 'backups', `argon_backup_${timestamp}.db`);
    const backupPath = options.output || defaultBackupPath;
    
    // Create backups directory if it doesn't exist
    const backupsDir = join(PROJECT_ROOT, 'backups');
    if (!existsSync(backupsDir)) {
      console.log(chalk.yellow(`Backups directory not found. Creating at ${backupsDir}`));
      try {
        await mkdir(backupsDir, { recursive: true });
        console.log(chalk.green(`Backups directory created at ${backupsDir}`));
      } catch (error) {
        console.error(chalk.red(`Failed to create backups directory: ${error.message}`));
        process.exit(1);
      }
    }
    
    try {
      // Copy the database file
      await Bun.write(backupPath, Bun.file(dbPath));
      console.log(chalk.green(`Database backup created successfully: ${backupPath}`));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`Backup failed: ${error.message}`));
      process.exit(1);
    }
  });

// Bolt info command - Database information
boltCommand
  .command('info')
  .description('Display database information')
  .action(async () => {
    const dbPath = join(PROJECT_ROOT, 'argon.db');
    
    if (!existsSync(dbPath)) {
      console.error(chalk.red(`Database file not found at ${dbPath}`));
      process.exit(1);
    }
    
    try {
      const db = new Database(dbPath);
      
      // Get database size
      const stats = Bun.file(dbPath).size;
      const size = formatBytes(stats);
      
      // Get table information
      const tables = db.query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];
      
      const tableInfo = tables.map(table => {
        const count = db.query(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
        const columns = db.query(`PRAGMA table_info(${table.name})`).all();
        return {
          name: table.name,
          rowCount: count.count,
          columnCount: columns.length
        };
      });
      
      // Display information
      console.log(chalk.blue('=== Argon Database Information ==='));
      console.log(chalk.blue(`Database file: ${dbPath}`));
      console.log(chalk.blue(`Database size: ${size}`));
      console.log(chalk.blue(`Number of tables: ${tables.length}`));
      
      console.log(chalk.blue('\nTables:'));
      console.table(tableInfo);
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`Error retrieving database information: ${error.message}`));
      process.exit(1);
    }
  });

// =========== UNIT COMMANDS ===========
// Unit command group
const unitCommand = program
  .command('unit')
  .description('Manage Argon units');

// List units
unitCommand
  .command('list')
  .description('List all units')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const units = await db.units.findMany();
      
      if (options.json) {
        console.log(JSON.stringify(units, null, 2));
      } else {
        console.log(chalk.blue('=== Argon Units ==='));
        
        if (units.length === 0) {
          console.log(chalk.yellow('No units found'));
        } else {
          const tableData = units.map(unit => ({
            ID: unit.id,
            Name: unit.name,
            ShortName: unit.shortName,
            DockerImage: unit.dockerImage
          }));
          
          console.table(tableData);
          console.log(chalk.blue(`Total units: ${units.length}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error listing units: ${error.message}`));
      process.exit(1);
    }
  });

// Get unit details
unitCommand
  .command('get')
  .description('Get unit details')
  .option('-i, --id <id>', 'Unit ID')
  .option('-s, --short-name <shortName>', 'Unit short name')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      let unit;
      
      if (!options.id && !options.shortName) {
        const units = await db.units.findMany();
        
        if (units.length === 0) {
          console.error(chalk.red('No units found'));
          process.exit(1);
        }
        
        const { unitId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'unitId',
            message: 'Select a unit:',
            choices: units.map(unit => ({
              name: `${unit.name} (${unit.shortName})`,
              value: unit.id
            }))
          }
        ]);
        
        unit = await db.units.findUnique({ id: unitId });
      } else if (options.id) {
        unit = await db.units.findUnique({ id: options.id });
      } else if (options.shortName) {
        unit = await db.units.findFirst({ where: { shortName: options.shortName } });
      }
      
      if (!unit) {
        console.error(chalk.red('Unit not found'));
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(unit, null, 2));
      } else {
        console.log(chalk.blue(`=== Unit: ${unit.name} ===`));
        console.log(chalk.blue(`ID: ${unit.id}`));
        console.log(chalk.blue(`Short Name: ${unit.shortName}`));
        console.log(chalk.blue(`Description: ${unit.description}`));
        console.log(chalk.blue(`Docker Image: ${unit.dockerImage}`));
        console.log(chalk.blue(`Default Startup Command: ${unit.defaultStartupCommand}`));
        
        console.log(chalk.blue('\nEnvironment Variables:'));
        if (unit.environmentVariables.length === 0) {
          console.log(chalk.yellow('  No environment variables defined'));
        } else {
          unit.environmentVariables.forEach(env => {
            console.log(chalk.green(`  - ${env.name}`));
            console.log(`    Description: ${env.description || 'N/A'}`);
            console.log(`    Default: ${env.defaultValue}`);
            console.log(`    Required: ${env.required ? 'Yes' : 'No'}`);
            console.log(`    User Editable: ${env.userEditable ? 'Yes' : 'No'}`);
            console.log(``);
          });
        }
        
        console.log(chalk.blue('Config Files:'));
        if (unit.configFiles.length === 0) {
          console.log(chalk.yellow('  No config files defined'));
        } else {
          unit.configFiles.forEach(config => {
            console.log(chalk.green(`  - ${config.path}`));
          });
        }
        
        console.log(chalk.blue('\nInstall Script:'));
        console.log(`  Docker Image: ${unit.installScript.dockerImage}`);
        console.log(`  Entrypoint: ${unit.installScript.entrypoint}`);
        console.log(`  Script:\n${unit.installScript.script}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error getting unit: ${error.message}`));
      process.exit(1);
    }
  });

// Create unit
unitCommand
  .command('create')
  .description('Create a new unit')
  .option('-f, --file <path>', 'JSON file containing unit configuration')
  .option('-i, --interactive', 'Create unit interactively')
  .action(async (options) => {
    try {
      let unitData;
      
      if (options.file) {
        // Read from file
        if (!existsSync(options.file)) {
          console.error(chalk.red(`File not found: ${options.file}`));
          process.exit(1);
        }
        
        try {
          const fileContent = readFileSync(options.file, 'utf-8');
          unitData = JSON.parse(fileContent);
        } catch (error) {
          console.error(chalk.red(`Error parsing file: ${error.message}`));
          process.exit(1);
        }
      } else if (options.interactive) {
        // Interactive mode
        unitData = await promptUnitDetails();
      } else {
        console.error(chalk.yellow('Please specify either --file or --interactive'));
        process.exit(1);
      }
      
      // Check if shortName already exists
      const existing = await db.units.findFirst({
        where: { shortName: unitData.shortName }
      });
      
      if (existing) {
        console.error(chalk.red(`Error: A unit with short name '${unitData.shortName}' already exists`));
        process.exit(1);
      }
      
      // Create the unit
      const unit = await db.units.create(unitData);
      
      console.log(chalk.green(`Unit '${unit.name}' created successfully!`));
      console.log(chalk.green(`ID: ${unit.id}`));
      console.log(chalk.green(`Short Name: ${unit.shortName}`));
    } catch (error) {
      console.error(chalk.red(`Error creating unit: ${error.message}`));
      process.exit(1);
    }
  });

// Delete unit
unitCommand
  .command('delete')
  .description('Delete a unit')
  .option('-i, --id <id>', 'Unit ID')
  .option('-s, --short-name <shortName>', 'Unit short name')
  .option('-f, --force', 'Force deletion without confirmation')
  .action(async (options) => {
    try {
      let unit;
      
      if (!options.id && !options.shortName) {
        const units = await db.units.findMany();
        
        if (units.length === 0) {
          console.error(chalk.red('No units found'));
          process.exit(1);
        }
        
        const { unitId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'unitId',
            message: 'Select a unit to delete:',
            choices: units.map(unit => ({
              name: `${unit.name} (${unit.shortName})`,
              value: unit.id
            }))
          }
        ]);
        
        unit = await db.units.findUnique({ id: unitId });
      } else if (options.id) {
        unit = await db.units.findUnique({ id: options.id });
      } else if (options.shortName) {
        unit = await db.units.findFirst({ where: { shortName: options.shortName } });
      }
      
      if (!unit) {
        console.error(chalk.red('Unit not found'));
        process.exit(1);
      }
      
      // Check if unit is in use by any servers
      const servers = await db.servers.findMany({
        where: { unitId: unit.id }
      });
      
      if (servers.length > 0) {
        console.error(chalk.red(`Cannot delete unit '${unit.name}' because it is in use by ${servers.length} servers`));
        process.exit(1);
      }
      
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete unit '${unit.name}'?`,
            default: false
          }
        ]);
        
        if (!confirm) {
          console.log(chalk.yellow('Deletion cancelled'));
          process.exit(0);
        }
      }
      
      await db.units.delete({ id: unit.id });
      console.log(chalk.green(`Unit '${unit.name}' deleted successfully`));
    } catch (error) {
      console.error(chalk.red(`Error deleting unit: ${error.message}`));
      process.exit(1);
    }
  });

// Export unit
unitCommand
  .command('export')
  .description('Export a unit to JSON')
  .option('-i, --id <id>', 'Unit ID')
  .option('-s, --short-name <shortName>', 'Unit short name')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    try {
      let unit;
      
      if (!options.id && !options.shortName) {
        const units = await db.units.findMany();
        
        if (units.length === 0) {
          console.error(chalk.red('No units found'));
          process.exit(1);
        }
        
        const { unitId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'unitId',
            message: 'Select a unit to export:',
            choices: units.map(unit => ({
              name: `${unit.name} (${unit.shortName})`,
              value: unit.id
            }))
          }
        ]);
        
        unit = await db.units.findUnique({ id: unitId });
      } else if (options.id) {
        unit = await db.units.findUnique({ id: options.id });
      } else if (options.shortName) {
        unit = await db.units.findFirst({ where: { shortName: options.shortName } });
      }
      
      if (!unit) {
        console.error(chalk.red('Unit not found'));
        process.exit(1);
      }
      
      // Prepare export data (omitting ID and timestamps)
      const exportData = {
        name: unit.name,
        shortName: unit.shortName,
        description: unit.description,
        dockerImage: unit.dockerImage,
        defaultStartupCommand: unit.defaultStartupCommand,
        configFiles: unit.configFiles,
        environmentVariables: unit.environmentVariables,
        installScript: unit.installScript,
        startup: unit.startup
      };
      
      // Determine output path
      const outputPath = options.output || `${unit.shortName}.json`;
      
      // Write to file
      writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
      
      console.log(chalk.green(`Unit '${unit.name}' exported to ${outputPath}`));
    } catch (error) {
      console.error(chalk.red(`Error exporting unit: ${error.message}`));
      process.exit(1);
    }
  });

// Import unit
unitCommand
  .command('import')
  .description('Import a unit from JSON')
  .option('-f, --file <path>', 'JSON file containing unit configuration')
  .action(async (options) => {
    try {
      if (!options.file) {
        // Prompt for file path
        const { filePath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'filePath',
            message: 'Enter the path to the unit JSON file:',
            validate: (input) => existsSync(input) ? true : 'File not found'
          }
        ]);
        
        options.file = filePath;
      }
      
      // Read and parse file
      const fileContent = readFileSync(options.file, 'utf-8');
      const unitData = JSON.parse(fileContent);
      
      // Check if shortName already exists
      const existing = await db.units.findFirst({
        where: { shortName: unitData.shortName }
      });
      
      let shortName = unitData.shortName;
      
      if (existing) {
        console.log(chalk.yellow(`A unit with short name '${shortName}' already exists`));
        
        // Generate a unique shortName by appending a number
        let counter = 1;
        while (await db.units.findFirst({ where: { shortName: `${shortName}-${counter}` } })) {
          counter++;
        }
        
        const { useGenerated } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useGenerated',
            message: `Would you like to use '${shortName}-${counter}' as the short name?`,
            default: true
          }
        ]);
        
        if (useGenerated) {
          shortName = `${shortName}-${counter}`;
        } else {
          const { newShortName } = await inquirer.prompt([
            {
              type: 'input',
              name: 'newShortName',
              message: 'Enter a new short name:',
              validate: async (input) => {
                if (!/^[a-z0-9-]+$/.test(input)) {
                  return 'Short name must contain only lowercase letters, numbers, and hyphens';
                }
                
                const exists = await db.units.findFirst({ where: { shortName: input } });
                return exists ? 'Short name already exists' : true;
              }
            }
          ]);
          
          shortName = newShortName;
        }
      }
      
      // Create the unit
      const unit = await db.units.create({
        ...unitData,
        shortName
      });
      
      console.log(chalk.green(`Unit '${unit.name}' imported successfully!`));
      console.log(chalk.green(`ID: ${unit.id}`));
      console.log(chalk.green(`Short Name: ${unit.shortName}`));
    } catch (error) {
      console.error(chalk.red(`Error importing unit: ${error.message}`));
      process.exit(1);
    }
  });

// Seed units command
unitCommand
  .command('seed')
  .description('Download and import units from GitHub repository')
  .option('-r, --repo <repo>', 'GitHub repository (default: argon-foss/units)')
  .option('-b, --branch <branch>', 'Branch name (default: main)')
  .option('-f, --force', 'Force overwrite existing units')
  .action(async (options) => {
    const repo = options.repo || 'argon-foss/units';
    const branch = options.branch || 'main';
    const baseUrl = `https://raw.githubusercontent.com/${repo}/${branch}`;
    
    console.log(chalk.blue(`Fetching units from ${repo} (${branch})...`));
    
    try {
      // Create a temp directory for downloads
      const tempDir = join(PROJECT_ROOT, 'temp_units');
      if (existsSync(tempDir)) {
        await rm(tempDir, { recursive: true, force: true });
      }
      await mkdir(tempDir, { recursive: true });
      
      // Download master.yaml file
      console.log(chalk.blue(`Downloading master.yaml...`));
      const masterYamlUrl = `${baseUrl}/master.yaml`;
      
      let masterYaml;
      try {
        const response = await fetch(masterYamlUrl);
        if (!response.ok) {
          throw new Error(`Failed to download master.yaml: ${response.statusText}`);
        }
        masterYaml = await response.text();
      } catch (error) {
        console.error(chalk.red(`Error downloading master.yaml: ${error.message}`));
        process.exit(1);
      }
      
      // Parse YAML
      const yaml = require('js-yaml');
      let masterConfig;
      try {
        masterConfig = yaml.load(masterYaml);
      } catch (error) {
        console.error(chalk.red(`Error parsing master.yaml: ${error.message}`));
        process.exit(1);
      }
      
      if (!masterConfig.images || !Array.isArray(masterConfig.images)) {
        console.error(chalk.red(`Invalid master.yaml format: 'images' array not found`));
        process.exit(1);
      }
      
      // Process each image
      const totalImages = masterConfig.images.length;
      console.log(chalk.blue(`Found ${totalImages} units to import`));
      
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < totalImages; i++) {
        const image = masterConfig.images[i];
        console.log(chalk.blue(`Processing [${i+1}/${totalImages}] ${image.name}...`));
        
        // Download unit JSON file
        const jsonPath = image.src;
        const jsonUrl = `${baseUrl}/${jsonPath}`;
        
        try {
          // Download JSON
          const response = await fetch(jsonUrl);
          if (!response.ok) {
            throw new Error(`Failed to download ${jsonPath}: ${response.statusText}`);
          }
          
          const unitJson = await response.text();
          const unitData = JSON.parse(unitJson);
          
          // Check if unit already exists
          const existingUnit = await db.units.findFirst({
            where: { shortName: unitData.shortName }
          });
          
          if (existingUnit && !options.force) {
            console.log(chalk.yellow(`Unit '${unitData.name}' (${unitData.shortName}) already exists, skipping`));
            skipCount++;
            continue;
          }
          
          if (existingUnit && options.force) {
            // Update existing unit
            console.log(chalk.yellow(`Updating existing unit '${unitData.name}' (${unitData.shortName})...`));
            await db.units.update({ id: existingUnit.id }, unitData);
            console.log(chalk.green(`Unit '${unitData.name}' updated successfully`));
          } else {
            // Create new unit
            const newUnit = await db.units.create(unitData);
            console.log(chalk.green(`Unit '${newUnit.name}' imported successfully`));
          }
          
          successCount++;
        } catch (error) {
          console.error(chalk.red(`Error processing ${image.name}: ${error.message}`));
          errorCount++;
        }
      }
      
      // Clean up temp directory
      await rm(tempDir, { recursive: true, force: true });
      
      // Print summary
      console.log(chalk.blue(`=== Import Summary ===`));
      console.log(chalk.green(`Successfully imported/updated: ${successCount}`));
      console.log(chalk.yellow(`Skipped: ${skipCount}`));
      console.log(chalk.red(`Errors: ${errorCount}`));
      
      if (errorCount > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`Error seeding units: ${error.message}`));
      process.exit(1);
    }
  });

// =========== CARGO COMMANDS ===========
// Cargo command group
const cargoCommand = program
  .command('cargo')
  .description('Manage Argon cargo');

// List cargo
cargoCommand
  .command('list')
  .description('List all cargo items')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const cargo = await db.cargo.findManyCargo();
      
      if (options.json) {
        console.log(JSON.stringify(cargo, null, 2));
      } else {
        console.log(chalk.blue('=== Argon Cargo ==='));
        
        if (cargo.length === 0) {
          console.log(chalk.yellow('No cargo items found'));
        } else {
          const tableData = cargo.map(item => ({
            ID: item.id,
            Name: item.name,
            Type: item.type,
            Size: formatBytes(item.size),
            MimeType: item.mimeType
          }));
          
          console.table(tableData);
          console.log(chalk.blue(`Total cargo items: ${cargo.length}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error listing cargo: ${error.message}`));
      process.exit(1);
    }
  });

// Get cargo details
cargoCommand
  .command('get')
  .description('Get cargo details')
  .option('-i, --id <id>', 'Cargo ID')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      let cargoItem;
      
      if (!options.id) {
        const cargoItems = await db.cargo.findManyCargo();
        
        if (cargoItems.length === 0) {
          console.error(chalk.red('No cargo items found'));
          process.exit(1);
        }
        
        const { cargoId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'cargoId',
            message: 'Select a cargo item:',
            choices: cargoItems.map(item => ({
              name: `${item.name} (${item.type})`,
              value: item.id
            }))
          }
        ]);
        
        cargoItem = await db.cargo.findCargo(cargoId);
      } else {
        cargoItem = await db.cargo.findCargo(options.id);
      }
      
      if (!cargoItem) {
        console.error(chalk.red('Cargo item not found'));
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(cargoItem, null, 2));
      } else {
        console.log(chalk.blue(`=== Cargo: ${cargoItem.name} ===`));
        console.log(chalk.blue(`ID: ${cargoItem.id}`));
        console.log(chalk.blue(`Description: ${cargoItem.description}`));
        console.log(chalk.blue(`Type: ${cargoItem.type}`));
        console.log(chalk.blue(`Size: ${formatBytes(cargoItem.size)}`));
        console.log(chalk.blue(`MIME Type: ${cargoItem.mimeType}`));
        
        if (cargoItem.type === 'remote') {
          console.log(chalk.blue(`Remote URL: ${cargoItem.remoteUrl}`));
        } else {
          console.log(chalk.blue(`Hash: ${cargoItem.hash}`));
        }
        
        console.log(chalk.blue('\nProperties:'));
        for (const [key, value] of Object.entries(cargoItem.properties)) {
          console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error getting cargo: ${error.message}`));
      process.exit(1);
    }
  });

// Upload local cargo
cargoCommand
  .command('upload')
  .description('Upload a local file as cargo')
  .option('-f, --file <path>', 'File to upload')
  .option('-n, --name <name>', 'Cargo name')
  .option('-d, --description <description>', 'Cargo description')
  .action(async (options) => {
    try {
      // Prompt for file if not provided
      if (!options.file) {
        const { filePath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'filePath',
            message: 'Enter path to file:',
            validate: (input) => existsSync(input) ? true : 'File not found'
          }
        ]);
        options.file = filePath;
      }
      
      // Validate file exists
      if (!existsSync(options.file)) {
        console.error(chalk.red(`File not found: ${options.file}`));
        process.exit(1);
      }
      
      // Get file stats
      const stats = statSync(options.file);
      if (!stats.isFile()) {
        console.error(chalk.red(`Not a file: ${options.file}`));
        process.exit(1);
      }
      
      // Prompt for name and description if not provided
      const fileName = options.file.split('/').pop() || 'unknown';
      
      if (!options.name) {
        const { name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter cargo name:',
            default: fileName,
            validate: (input) => input.length > 0 ? true : 'Name cannot be empty'
          }
        ]);
        options.name = name;
      }
      
      if (!options.description) {
        const { description } = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Enter cargo description:',
            default: `Uploaded file: ${fileName}`
          }
        ]);
        options.description = description;
      }
      
      // Calculate hash
      console.log(chalk.blue('Calculating file hash...'));
      const fileBuffer = readFileSync(options.file);
      const hash = createHash('sha256').update(fileBuffer).digest('hex');
      
      // Check for duplicate by hash
      const existing = await db.cargo.findManyCargo({
        where: { hash }
      });
      
      if (existing.length > 0) {
        console.error(chalk.red(`Error: File with the same hash already exists as '${existing[0].name}'`));
        process.exit(1);
      }
      
      // Determine MIME type
      const mimeType = mime.lookup(options.file) || 'application/octet-stream';
      
      // Create storage directory
      const storageDir = join(PROJECT_ROOT, 'storage', 'cargo', hash.substring(0, 2));
      await mkdir(storageDir, { recursive: true });
      
      // Copy file to storage
      console.log(chalk.blue('Copying file to storage...'));
      const storagePath = join(storageDir, hash);
      await Bun.write(storagePath, fileBuffer);
      
      // Create cargo record
      const cargoData = {
        name: options.name,
        description: options.description,
        hash,
        size: stats.size,
        mimeType,
        type: 'local',
        properties: {}
      };
      
      const cargo = await db.cargo.createCargo(cargoData);
      
      console.log(chalk.green(`Cargo '${cargo.name}' uploaded successfully!`));
      console.log(chalk.green(`ID: ${cargo.id}`));
      console.log(chalk.green(`Size: ${formatBytes(cargo.size)}`));
      console.log(chalk.green(`MIME Type: ${cargo.mimeType}`));
    } catch (error) {
      console.error(chalk.red(`Error uploading cargo: ${error.message}`));
      process.exit(1);
    }
  });

// Add remote cargo
cargoCommand
  .command('remote-add')
  .description('Add a remote URL as cargo')
  .option('-u, --url <url>', 'Remote URL')
  .option('-n, --name <name>', 'Cargo name')
  .option('-d, --description <description>', 'Cargo description')
  .action(async (options) => {
    try {
      // Prompt for URL if not provided
      if (!options.url) {
        const { url } = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: 'Enter remote URL:',
            validate: (input) => {
              try {
                new URL(input);
                return true;
              } catch {
                return 'Invalid URL';
              }
            }
          }
        ]);
        options.url = url;
      }
      
      // Validate URL
      console.log(chalk.blue('Validating remote URL...'));
      let size, mimeType;
      try {
        const response = await fetch(options.url, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
        
        size = parseInt(response.headers.get('content-length') || '0', 10);
        mimeType = response.headers.get('content-type') || 'application/octet-stream';
        
        if (size === 0) {
          console.log(chalk.yellow('Warning: Could not determine file size'));
          
          // Try with a GET request to get the size
          const getResponse = await fetch(options.url);
          const buffer = await getResponse.arrayBuffer();
          size = buffer.byteLength;
        }
      } catch (error) {
        console.error(chalk.red(`Failed to validate remote URL: ${error.message}`));
        process.exit(1);
      }
      
      // Extract filename from URL for default name
      const urlObj = new URL(options.url);
      const fileName = urlObj.pathname.split('/').pop() || 'remote-file';
      
      // Prompt for name and description if not provided
      if (!options.name) {
        const { name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter cargo name:',
            default: fileName,
            validate: (input) => input.length > 0 ? true : 'Name cannot be empty'
          }
        ]);
        options.name = name;
      }
      
      if (!options.description) {
        const { description } = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Enter cargo description:',
            default: `Remote file: ${options.url}`
          }
        ]);
        options.description = description;
      }
      
      // Create cargo record
      const cargoData = {
        name: options.name,
        description: options.description,
        hash: '',
        size,
        mimeType,
        type: 'remote',
        remoteUrl: options.url,
        properties: {}
      };
      
      const cargo = await db.cargo.createCargo(cargoData);
      
      console.log(chalk.green(`Remote cargo '${cargo.name}' added successfully!`));
      console.log(chalk.green(`ID: ${cargo.id}`));
      console.log(chalk.green(`Size: ${formatBytes(cargo.size)}`));
      console.log(chalk.green(`MIME Type: ${cargo.mimeType}`));
      console.log(chalk.green(`Remote URL: ${cargo.remoteUrl}`));
    } catch (error) {
      console.error(chalk.red(`Error adding remote cargo: ${error.message}`));
      process.exit(1);
    }
  });

// Delete cargo
cargoCommand
  .command('delete')
  .description('Delete a cargo item')
  .option('-i, --id <id>', 'Cargo ID')
  .option('-f, --force', 'Force deletion without confirmation')
  .action(async (options) => {
    try {
      let cargoItem;
      
      if (!options.id) {
        const cargoItems = await db.cargo.findManyCargo();
        
        if (cargoItems.length === 0) {
          console.error(chalk.red('No cargo items found'));
          process.exit(1);
        }
        
        const { cargoId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'cargoId',
            message: 'Select a cargo item to delete:',
            choices: cargoItems.map(item => ({
              name: `${item.name} (${item.type})`,
              value: item.id
            }))
          }
        ]);
        
        cargoItem = await db.cargo.findCargo(cargoId);
      } else {
        cargoItem = await db.cargo.findCargo(options.id);
      }
      
      if (!cargoItem) {
        console.error(chalk.red('Cargo item not found'));
        process.exit(1);
      }
      
      // Check if cargo is used in any containers
      const containers = await db.cargo.findManyContainers({
        where: {
          items: {
            contains: cargoItem.id
          }
        }
      });
      
      if (containers.length > 0) {
        console.error(chalk.red(`Cannot delete cargo '${cargoItem.name}' because it is used in ${containers.length} containers:`));
        containers.forEach(container => {
          console.log(chalk.yellow(`- ${container.name} (${container.id})`));
        });
        process.exit(1);
      }
      
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete cargo '${cargoItem.name}'?`,
            default: false
          }
        ]);
        
        if (!confirm) {
          console.log(chalk.yellow('Deletion cancelled'));
          process.exit(0);
        }
      }
      
      // Delete the cargo item
      if (cargoItem.type === 'local') {
        // Delete the file
        const filePath = join(
          PROJECT_ROOT,
          'storage',
          'cargo',
          cargoItem.hash.substring(0, 2),
          cargoItem.hash
        );
        
        if (existsSync(filePath)) {
          console.log(chalk.blue(`Deleting file: ${filePath}`));
          await rm(filePath, { force: true });
        }
      }
      
      await db.cargo.deleteCargo(cargoItem.id);
      console.log(chalk.green(`Cargo '${cargoItem.name}' deleted successfully`));
    } catch (error) {
      console.error(chalk.red(`Error deleting cargo: ${error.message}`));
      process.exit(1);
    }
  });

// Download cargo
cargoCommand
  .command('download')
  .description('Download a cargo item')
  .option('-i, --id <id>', 'Cargo ID')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    try {
      let cargoItem;
      
      if (!options.id) {
        const cargoItems = await db.cargo.findManyCargo();
        
        if (cargoItems.length === 0) {
          console.error(chalk.red('No cargo items found'));
          process.exit(1);
        }
        
        const { cargoId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'cargoId',
            message: 'Select a cargo item to download:',
            choices: cargoItems.map(item => ({
              name: `${item.name} (${item.type})`,
              value: item.id
            }))
          }
        ]);
        
        cargoItem = await db.cargo.findCargo(cargoId);
      } else {
        cargoItem = await db.cargo.findCargo(options.id);
      }
      
      if (!cargoItem) {
        console.error(chalk.red('Cargo item not found'));
        process.exit(1);
      }
      
      // Determine output filename
      let outputPath = options.output;
      if (!outputPath) {
        const defaultName = cargoItem.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        const { filename } = await inquirer.prompt([
          {
            type: 'input',
            name: 'filename',
            message: 'Enter output filename:',
            default: defaultName
          }
        ]);
        
        outputPath = filename;
      }
      
      if (existsSync(outputPath) && statSync(outputPath).isDirectory()) {
        outputPath = join(outputPath, cargoItem.name.replace(/[^a-zA-Z0-9._-]/g, '_'));
      }
      
      // Download the file
      if (cargoItem.type === 'remote') {
        console.log(chalk.blue(`Downloading from URL: ${cargoItem.remoteUrl}`));
        
        const response = await fetch(cargoItem.remoteUrl!);
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
        
        const fileBuffer = await response.arrayBuffer();
        await Bun.write(outputPath, Buffer.from(fileBuffer));
      } else {
        // Copy local file
        const sourcePath = join(
          PROJECT_ROOT,
          'storage',
          'cargo',
          cargoItem.hash.substring(0, 2),
          cargoItem.hash
        );
        
        if (!existsSync(sourcePath)) {
          throw new Error(`Source file not found: ${sourcePath}`);
        }
        
        console.log(chalk.blue(`Copying file from storage`));
        await Bun.write(outputPath, Bun.file(sourcePath));
      }
      
      console.log(chalk.green(`Cargo '${cargoItem.name}' downloaded to ${outputPath}`));
    } catch (error) {
      console.error(chalk.red(`Error downloading cargo: ${error.message}`));
      process.exit(1);
    }
  });

// =========== CONTAINER COMMANDS ===========
// Containers subcommand group
cargoCommand
  .command('containers')
  .description('Manage cargo containers');

// List containers
cargoCommand
  .command('containers:list')
  .description('List all cargo containers')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const containers = await db.cargo.findManyContainers();
      
      if (options.json) {
        console.log(JSON.stringify(containers, null, 2));
      } else {
        console.log(chalk.blue('=== Cargo Containers ==='));
        
        if (containers.length === 0) {
          console.log(chalk.yellow('No containers found'));
        } else {
          const tableData = containers.map(container => ({
            ID: container.id,
            Name: container.name,
            Items: container.items.length
          }));
          
          console.table(tableData);
          console.log(chalk.blue(`Total containers: ${containers.length}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error listing containers: ${error.message}`));
      process.exit(1);
    }
  });

// Get container details
cargoCommand
  .command('containers:get')
  .description('Get container details')
  .option('-i, --id <id>', 'Container ID')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      let container;
      
      if (!options.id) {
        const containers = await db.cargo.findManyContainers();
        
        if (containers.length === 0) {
          console.error(chalk.red('No containers found'));
          process.exit(1);
        }
        
        const { containerId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'containerId',
            message: 'Select a container:',
            choices: containers.map(container => ({
              name: `${container.name} (${container.items.length} items)`,
              value: container.id
            }))
          }
        ]);
        
        container = await db.cargo.findContainer(containerId);
      } else {
        container = await db.cargo.findContainer(options.id);
      }
      
      if (!container) {
        console.error(chalk.red('Container not found'));
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(container, null, 2));
      } else {
        console.log(chalk.blue(`=== Container: ${container.name} ===`));
        console.log(chalk.blue(`ID: ${container.id}`));
        console.log(chalk.blue(`Description: ${container.description}`));
        console.log(chalk.blue(`Created: ${container.createdAt.toISOString()}`));
        console.log(chalk.blue(`Updated: ${container.updatedAt.toISOString()}`));
        
        console.log(chalk.blue(`\nItems (${container.items.length}):`));
        
        if (container.items.length === 0) {
          console.log(chalk.yellow('  No items in this container'));
        } else {
          // Fetch cargo details for each item
          for (const item of container.items) {
            const cargo = await db.cargo.findCargo(item.cargoId);
            if (cargo) {
              console.log(chalk.green(`  - ${cargo.name} (${cargo.id})`));
              console.log(`    Target Path: ${item.targetPath}`);
              console.log(`    Type: ${cargo.type}`);
              console.log(`    Size: ${formatBytes(cargo.size)}`);
              console.log(``);
            } else {
              console.log(chalk.yellow(`  - Unknown cargo (${item.cargoId})`));
              console.log(`    Target Path: ${item.targetPath}`);
              console.log(``);
            }
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error getting container: ${error.message}`));
      process.exit(1);
    }
  });

// Create container
cargoCommand
  .command('containers:create')
  .description('Create a new cargo container')
  .option('-n, --name <name>', 'Container name')
  .option('-d, --description <description>', 'Container description')
  .option('-i, --interactive', 'Add items interactively')
  .action(async (options) => {
    try {
      // Prompt for container details if not provided
      if (!options.name) {
        const { name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter container name:',
            validate: (input) => input.length > 0 ? true : 'Name cannot be empty'
          }
        ]);
        options.name = name;
      }
      
      if (!options.description) {
        const { description } = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Enter container description:',
            default: `Container for ${options.name}`
          }
        ]);
        options.description = description;
      }
      
      // Create container with empty items
      let items = [];
      
      // Add items interactively if requested
      if (options.interactive) {
        const cargoItems = await db.cargo.findManyCargo();
        
        if (cargoItems.length === 0) {
          console.error(chalk.red('No cargo items found. Create cargo items first.'));
          process.exit(1);
        }
        
        const { addItems } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addItems',
            message: 'Would you like to add items to this container?',
            default: true
          }
        ]);
        
        if (addItems) {
          let addMore = true;
          
          while (addMore) {
            // Select cargo item
            const { cargoId } = await inquirer.prompt([
              {
                type: 'list',
                name: 'cargoId',
                message: 'Select a cargo item to add:',
                choices: cargoItems.map(item => ({
                  name: `${item.name} (${item.type})`,
                  value: item.id
                }))
              }
            ]);
            
            // Get target path
            const { targetPath } = await inquirer.prompt([
              {
                type: 'input',
                name: 'targetPath',
                message: 'Enter target path (relative to /home/container):',
                validate: (input) => {
                  if (input.length === 0) return 'Path cannot be empty';
                  // Check for absolute path starting with /
                  if (input.startsWith('/')) {
                    return 'Please enter a relative path (without leading /)';
                  }
                  return true;
                }
              }
            ]);
            
            // Add item to list
            items.push({
              cargoId,
              targetPath
            });
            
            // Ask if user wants to add more items
            const { continueAdding } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'continueAdding',
                message: 'Add another item?',
                default: false
              }
            ]);
            
            addMore = continueAdding;
          }
        }
      }
      
      // Create the container
      const containerData = {
        name: options.name,
        description: options.description,
        items
      };
      
      const container = await db.cargo.createContainer(containerData);
      
      console.log(chalk.green(`Container '${container.name}' created successfully!`));
      console.log(chalk.green(`ID: ${container.id}`));
      console.log(chalk.green(`Items: ${container.items.length}`));
    } catch (error) {
      console.error(chalk.red(`Error creating container: ${error.message}`));
      process.exit(1);
    }
  });

// Update container
cargoCommand
  .command('containers:update')
  .description('Update a cargo container')
  .option('-i, --id <id>', 'Container ID')
  .option('-n, --name <name>', 'New container name')
  .option('-d, --description <description>', 'New container description')
  .option('-a, --add-items', 'Add items to container')
  .option('-r, --remove-items', 'Remove items from container')
  .action(async (options) => {
    try {
      let container;
      
      if (!options.id) {
        const containers = await db.cargo.findManyContainers();
        
        if (containers.length === 0) {
          console.error(chalk.red('No containers found'));
          process.exit(1);
        }
        
        const { containerId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'containerId',
            message: 'Select a container to update:',
            choices: containers.map(container => ({
              name: `${container.name} (${container.items.length} items)`,
              value: container.id
            }))
          }
        ]);
        
        container = await db.cargo.findContainer(containerId);
      } else {
        container = await db.cargo.findContainer(options.id);
      }
      
      if (!container) {
        console.error(chalk.red('Container not found'));
        process.exit(1);
      }
      
      // Prepare update data
      const updateData: any = {};
      
      // Update name if provided
      if (options.name) {
        updateData.name = options.name;
      }
      
      // Update description if provided
      if (options.description) {
        updateData.description = options.description;
      }
      
      // Handle adding items
      if (options.addItems) {
        const cargoItems = await db.cargo.findManyCargo();
        
        if (cargoItems.length === 0) {
          console.error(chalk.red('No cargo items found. Create cargo items first.'));
          process.exit(1);
        }
        
        let addMore = true;
        const newItems = [...container.items];
        
        while (addMore) {
          // Select cargo item
          const { cargoId } = await inquirer.prompt([
            {
              type: 'list',
              name: 'cargoId',
              message: 'Select a cargo item to add:',
              choices: cargoItems.map(item => ({
                name: `${item.name} (${item.type})`,
                value: item.id
              }))
            }
          ]);
          
          // Get target path
          const { targetPath } = await inquirer.prompt([
            {
              type: 'input',
              name: 'targetPath',
              message: 'Enter target path (relative to /home/container):',
              validate: (input) => {
                if (input.length === 0) return 'Path cannot be empty';
                // Check for absolute path starting with /
                if (input.startsWith('/')) {
                  return 'Please enter a relative path (without leading /)';
                }
                return true;
              }
            }
          ]);
          
          // Add item to list
          newItems.push({
            cargoId,
            targetPath
          });
          
          // Ask if user wants to add more items
          const { continueAdding } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continueAdding',
              message: 'Add another item?',
              default: false
            }
          ]);
          
          addMore = continueAdding;
        }
        
        updateData.items = newItems;
      }
      
      // Handle removing items
      if (options.removeItems && container.items.length > 0) {
        // Get cargo details for display
        const itemsWithDetails = await Promise.all(
          container.items.map(async item => {
            const cargo = await db.cargo.findCargo(item.cargoId);
            return {
              ...item,
              cargoName: cargo ? cargo.name : 'Unknown'
            };
          })
        );
        
        const { itemsToRemove } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'itemsToRemove',
            message: 'Select items to remove:',
            choices: itemsWithDetails.map((item, index) => ({
              name: `${item.cargoName} -> ${item.targetPath}`,
              value: index
            }))
          }
        ]);
        
        if (itemsToRemove.length > 0) {
          // Create new items array without the removed items
          const newItems = container.items.filter((_, index) => !itemsToRemove.includes(index));
          updateData.items = newItems;
        }
      }
      
      // Update container if changes were made
      if (Object.keys(updateData).length > 0) {
        await db.cargo.updateContainer(container.id, updateData);
        console.log(chalk.green(`Container '${container.name}' updated successfully!`));
      } else {
        console.log(chalk.yellow('No changes to update'));
      }
    } catch (error) {
      console.error(chalk.red(`Error updating container: ${error.message}`));
      process.exit(1);
    }
  });

// Delete container
cargoCommand
  .command('containers:delete')
  .description('Delete a cargo container')
  .option('-i, --id <id>', 'Container ID')
  .option('-f, --force', 'Force deletion without confirmation')
  .action(async (options) => {
    try {
      let container;
      
      if (!options.id) {
        const containers = await db.cargo.findManyContainers();
        
        if (containers.length === 0) {
          console.error(chalk.red('No containers found'));
          process.exit(1);
        }
        
        const { containerId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'containerId',
            message: 'Select a container to delete:',
            choices: containers.map(container => ({
              name: `${container.name} (${container.items.length} items)`,
              value: container.id
            }))
          }
        ]);
        
        container = await db.cargo.findContainer(containerId);
      } else {
        container = await db.cargo.findContainer(options.id);
      }
      
      if (!container) {
        console.error(chalk.red('Container not found'));
        process.exit(1);
      }
      
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete container '${container.name}'?`,
            default: false
          }
        ]);
        
        if (!confirm) {
          console.log(chalk.yellow('Deletion cancelled'));
          process.exit(0);
        }
      }
      
      await db.cargo.deleteContainer(container.id);
      console.log(chalk.green(`Container '${container.name}' deleted successfully`));
    } catch (error) {
      console.error(chalk.red(`Error deleting container: ${error.message}`));
      process.exit(1);
    }
  });

// =========== HELPER FUNCTIONS ===========

// Helper function to prompt for unit details when creating a unit interactively
async function promptUnitDetails() {
  const unitData: any = {};
  
  // Basic information
  const basicInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter unit name:',
      validate: (input) => input.length > 0 ? true : 'Name cannot be empty'
    },
    {
      type: 'input',
      name: 'shortName',
      message: 'Enter unit short name (lowercase, alphanumeric with hyphens):',
      validate: (input) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Short name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'description',
      message: 'Enter unit description:',
      validate: (input) => input.length > 0 ? true : 'Description cannot be empty'
    },
    {
      type: 'input',
      name: 'dockerImage',
      message: 'Enter Docker image:',
      validate: (input) => input.length > 0 ? true : 'Docker image cannot be empty'
    },
    {
      type: 'input',
      name: 'defaultStartupCommand',
      message: 'Enter default startup command:',
      validate: (input) => input.length > 0 ? true : 'Startup command cannot be empty'
    }
  ]);
  
  Object.assign(unitData, basicInfo);
  
  // Environment variables
  unitData.environmentVariables = [];
  
  const { addEnvVars } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addEnvVars',
      message: 'Would you like to add environment variables?',
      default: true
    }
  ]);
  
  if (addEnvVars) {
    let addMore = true;
    
    while (addMore) {
      const envVar = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Environment variable name:',
          validate: (input) => input.length > 0 ? true : 'Name cannot be empty'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description:',
        },
        {
          type: 'input',
          name: 'defaultValue',
          message: 'Default value:',
          validate: (input) => input !== undefined ? true : 'Default value is required'
        },
        {
          type: 'confirm',
          name: 'required',
          message: 'Is this variable required?',
          default: false
        },
        {
          type: 'confirm',
          name: 'userViewable',
          message: 'Is this variable viewable by users?',
          default: true
        },
        {
          type: 'confirm',
          name: 'userEditable',
          message: 'Is this variable editable by users?',
          default: false
        },
        {
          type: 'input',
          name: 'rules',
          message: 'Validation rules (e.g., required|string|max:20):',
          default: 'string'
        }
      ]);
      
      unitData.environmentVariables.push(envVar);
      
      const { continueAdding } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAdding',
          message: 'Add another environment variable?',
          default: false
        }
      ]);
      
      addMore = continueAdding;
    }
  }
  
  // Config files
  unitData.configFiles = [];
  
  const { addConfigFiles } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addConfigFiles',
      message: 'Would you like to add config files?',
      default: false
    }
  ]);
  
  if (addConfigFiles) {
    let addMore = true;
    
    while (addMore) {
      const configFile = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'File path (relative to /home/container):',
          validate: (input) => input.length > 0 ? true : 'Path cannot be empty'
        },
        {
          type: 'editor',
          name: 'content',
          message: 'File content:',
        }
      ]);
      
      unitData.configFiles.push(configFile);
      
      const { continueAdding } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAdding',
          message: 'Add another config file?',
          default: false
        }
      ]);
      
      addMore = continueAdding;
    }
  }
  
  // Installation script
  const installScript = await inquirer.prompt([
    {
      type: 'input',
      name: 'dockerImage',
      message: 'Install script Docker image:',
      default: 'debian:bullseye-slim'
    },
    {
      type: 'input',
      name: 'entrypoint',
      message: 'Install script entrypoint:',
      default: 'bash'
    },
    {
      type: 'editor',
      name: 'script',
      message: 'Installation script content:',
    }
  ]);
  
  unitData.installScript = installScript;
  
  // Startup settings
  const { userEditable } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'userEditable',
      message: 'Allow users to edit startup command?',
      default: false
    }
  ]);
  
  unitData.startup = { userEditable };
  
  return unitData;
}

// =========== DEPLOY COMMAND ===========
// Deploy Command
program
  .command('deploy')
  .description('Deploy Argon with UI')
  .option('-f, --force', 'Skip confirmations')
  .option('-l, --local', 'Force local deployment')
  .option('-d, --domain <domain>', 'Specify domain for production deployment')
  .option('-s, --ssl-path <path>', 'Path to SSL certificates')
  .option('-p, --port <port>', 'API port (default: 3000)')
  .option('-w, --web-port <port>', 'Web server port for local deployment (default: 3001)')
  .option('-c, --config <path>', 'Path to saved configuration')
  .action(async (options) => {
    // Load config if provided
    let config: any = {};
    const configDir = join(PROJECT_ROOT, 'src/cli');
    const defaultConfigPath = join(configDir, 'deploy.json');
    const configPath = options.config || defaultConfigPath;
    
    console.log(configPath)
    if (existsSync(configPath)) {
      try {
        config = JSON.parse(readFileSync(configPath, 'utf-8'));
        console.log(chalk.blue(`Loaded configuration from ${configPath}`));
      } catch (error) {
        console.error(chalk.yellow(`Failed to load config from ${configPath}: ${error.message}`));
      }
    }
    
    // Set defaults from config
    options = {
      ...config,
      ...options
    };
    
    // Find argon-ui
    const expectedUIPath = resolve(PROJECT_ROOT, '..', 'argon-ui');
    let uiPath = expectedUIPath;
    
    // Check if argon-ui exists
    if (!options.force && !existsSync(uiPath)) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Please confirm that 'argon-ui' is located in the preceding folder to 'argon-core' (the current directory)`,
          default: true
        }
      ]);
      
      if (!confirm) {
        const { customPath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customPath',
            message: 'Enter the path to argon-ui:',
            validate: (input) => existsSync(input) ? true : 'Path does not exist'
          }
        ]);
        uiPath = customPath;
      }
    }
    
    console.log(chalk.blue(`Looking for 'argon-ui'...`));
    
    if (!existsSync(uiPath)) {
      console.error(chalk.red(`argon-ui not found at ${uiPath}`));
      process.exit(1);
    }
    
    console.log(chalk.green(`Found argon-ui at ${uiPath}!`));
    
    // Install dependencies
    console.log(chalk.blue(`Installing modules (bun install)...`));
    const installResult = spawnSync('bun', ['install'], { 
      cwd: uiPath,
      stdio: 'inherit'
    });
    
    if (installResult.status !== 0) {
      console.error(chalk.red(`Failed to install dependencies in argon-ui`));
      process.exit(1);
    }
    
    // Determine deployment type
    let deploymentType = options.local ? 'local' : (options.domain ? 'domain' : null);
    
    if (!deploymentType && !options.force) {
      const { deployment } = await inquirer.prompt([
        {
          type: 'list',
          name: 'deployment',
          message: 'Do you have a domain or would you like to run Argon locally?',
          choices: [
            { name: 'Run locally', value: 'local' },
            { name: 'Deploy with domain', value: 'domain' }
          ]
        }
      ]);
      
      deploymentType = deployment;
    }
    
    // Set API port
    const apiPort = options.port || config.port || 3000;
    
    // Configure based on deployment type
    let apiUrl;
    let sslPath;
    let webPort;
    
    if (deploymentType === 'local') {
      console.log(chalk.blue(`Ok, we'll run the API on port ${apiPort} as per defaults`));
      apiUrl = `http://localhost:${apiPort}`;
      webPort = options.webPort || config.webPort || 3001;
    } else {
      let domain = options.domain || config.domain;
      
      if (!domain && !options.force) {
        const { domainAnswer } = await inquirer.prompt([
          {
            type: 'input',
            name: 'domainAnswer',
            message: 'Please enter the domain (e.g., panel.example.com):',
            validate: (input) => input.length > 0 ? true : 'Domain cannot be empty'
          }
        ]);
        
        domain = domainAnswer;
      }
      
      // Check SSL certificates
      let hasSSL = options.sslPath || config.sslPath;
      
      if (!hasSSL && !options.force) {
        const { sslConfirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'sslConfirm',
            message: 'Have you generated a Let\'s Encrypt SSL certificate for your domain?',
            default: false
          }
        ]);
        
        if (sslConfirm) {
          const { sslPathAnswer } = await inquirer.prompt([
            {
              type: 'input',
              name: 'sslPathAnswer',
              message: 'Enter the path to your SSL certificates directory:',
              validate: (input) => existsSync(input) ? true : 'Path does not exist'
            }
          ]);
          
          sslPath = sslPathAnswer;
        } else {
          console.log(chalk.yellow(`Warning: Proceeding without SSL certificates. Your deployment will not be secure.`));
        }
      } else {
        sslPath = options.sslPath || config.sslPath;
        
        if (sslPath) {
          console.log(chalk.blue(`Checking if SSL certificates exist at ${sslPath}...`));
          
          if (!existsSync(sslPath)) {
            console.error(chalk.red(`SSL certificates directory not found at ${sslPath}`));
            process.exit(1);
          }
          
          // Check for key and cert files
          const hasKey = existsSync(join(sslPath, 'privkey.pem'));
          const hasCert = existsSync(join(sslPath, 'fullchain.pem'));
          
          if (!hasKey || !hasCert) {
            console.error(chalk.red(`SSL certificates incomplete. Could not find privkey.pem and/or fullchain.pem in ${sslPath}`));
            process.exit(1);
          }
          
          console.log(chalk.green(`SSL certificates found!`));
        }
      }
      
      apiUrl = `https://${domain}`;
      console.log(chalk.blue(`Ok, we'll run the API on port ${apiPort}, but with the public domain as the API URL`));
    }
    
    // Write .env file for argon-ui
    console.log(chalk.blue(`Writing \`argon-ui\` .env file with "API_URL=${apiUrl}"`));
    
    try {
      writeFileSync(join(uiPath, '.env'), `API_URL=${apiUrl}\n`);
    } catch (error) {
      console.error(chalk.red(`Failed to write .env file: ${error.message}`));
      process.exit(1);
    }
    
    // Build for production
    console.log(chalk.blue(`Building for production...`));
    const buildResult = spawnSync('bun', ['run', 'build'], {
      cwd: uiPath,
      stdio: 'inherit'
    });
    
    if (buildResult.status !== 0) {
      console.error(chalk.red(`Build failed. Please check the build output for errors.`));
      process.exit(1);
    }
    
    // Create _dist directory in argon-core
    const distDir = join(PROJECT_ROOT, '_dist');
    
    if (existsSync(distDir)) {
      console.log(chalk.blue(`Cleaning existing _dist directory...`));
      await rm(distDir, { recursive: true, force: true });
    }
    
    try {
      await mkdir(distDir, { recursive: true });
    } catch (error) {
      console.error(chalk.red(`Failed to create _dist directory: ${error.message}`));
      process.exit(1);
    }
    
    // Copy files from argon-ui/dist to argon-core/_dist
    console.log(chalk.blue(`Copying \`dist\` files from \`argon-ui\` to \`argon-core/_dist\`...`));
    
    const uiDistPath = join(uiPath, 'dist');
    
    if (!existsSync(uiDistPath)) {
      console.error(chalk.red(`Build output not found at ${uiDistPath}`));
      process.exit(1);
    }
    
    const distFiles = listFilesRecursively(uiDistPath);
    
    for (const file of distFiles) {
      const relativePath = file.replace(uiDistPath, '');
      const targetPath = join(distDir, relativePath);
      const targetDir = dirname(targetPath);
      
      if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true });
      }
      
      await Bun.write(targetPath, Bun.file(file));
    }
    
    console.log(chalk.green(`Done copying files!`));
    
    // Save configuration if requested
    const saveConfig = async () => {
      const config = {
        port: apiPort,
        webPort,
        domain: deploymentType === 'domain' ? options.domain : undefined,
        sslPath,
        uiPath
      };
      
      if (!existsSync(configDir)) {
        await mkdir(configDir, { recursive: true });
      }
      
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green(`Configuration saved to ${configPath}`));
    };
    
    if (!options.force) {
      const { saveConfigConfirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'saveConfigConfirm',
          message: `Would you like to save these settings (${configPath})?`,
          default: true
        }
      ]);
      
      if (saveConfigConfirm) {
        await saveConfig();
      }
    } else {
      await saveConfig();
    }
    
    // Start servers
    console.log(chalk.blue(`Starting servers...`));
    
    // Start API server
    console.log(chalk.blue(`Starting API server on port ${apiPort}...`));
    
    const apiProcess = spawn('bun', ['run', 'start'], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: apiPort.toString()
      }
    });
    
    // Start web server with proxy
    if (deploymentType === 'local') {
      console.log(chalk.blue(`Starting web server with API proxy on port ${webPort}...`));
      
      // Create a web server with API proxy using Bun
      const server = Bun.serve({
        port: webPort,
        async fetch(req) {
          const url = new URL(req.url);
          const path = url.pathname;
          
          // Proxy API requests to the API server
          if (path.startsWith('/api/')) {
            // Create a new request to forward to the API server
            const apiUrl = new URL(path, `http://localhost:${apiPort}`);
            
            // Copy search params
            url.searchParams.forEach((value, key) => {
              apiUrl.searchParams.append(key, value);
            });
            
            // Forward the request to the API server
            try {
              const apiResponse = await fetch(apiUrl, {
                method: req.method,
                headers: req.headers,
                body: req.body
              });
              
              // Create a new response with the API response
              return new Response(apiResponse.body, {
                status: apiResponse.status,
                statusText: apiResponse.statusText,
                headers: apiResponse.headers
              });
            } catch (error) {
              console.error(chalk.red(`Error proxying to API: ${error.message}`));
              return new Response(`API server error: ${error.message}`, { status: 502 });
            }
          }
          
          // Serve static files for non-API requests
          let filePath = path;
          
          // Default to index.html for root or client-side routing paths without file extensions
          if (filePath === '/' || (!filePath.includes('.') && !filePath.endsWith('/'))) {
            filePath = '/index.html';
          }
          
          // Try to serve the file from _dist
          const fullPath = join(distDir, filePath);
          
          if (existsSync(fullPath) && statSync(fullPath).isFile()) {
            return new Response(Bun.file(fullPath));
          }
          
          // If we're here and the path doesn't have an extension, it might be a client-side route
          // Serve index.html for client-side routing
          if (!path.includes('.')) {
            return new Response(Bun.file(join(distDir, 'index.html')));
          }
          
          // 404 if file not found
          return new Response('Not Found', { status: 404 });
        },
      });
      
      console.log(chalk.green(`Webserver online on port ${webPort}`));
      console.log(chalk.green(`API proxy is set up to forward /api/* requests to http://localhost:${apiPort}`));
      console.log(chalk.green(`You can access Argon at http://localhost:${webPort}`));
    } else {
      // Production deployment with domain
      console.log(chalk.blue(`Setting up production server with API proxy...`));
      
      let server;
      
      // Check if we have SSL
      if (sslPath) {
        // SSL configuration for HTTPS
        try {
          const keyFile = join(sslPath, 'privkey.pem');
          const certFile = join(sslPath, 'fullchain.pem');
          
          // Read SSL files
          const key = readFileSync(keyFile, 'utf-8');
          const cert = readFileSync(certFile, 'utf-8');
          
          // Create HTTPS server
          server = Bun.serve({
            port: 443,
            tls: {
              key,
              cert
            },
            async fetch(req) {
              const url = new URL(req.url);
              const path = url.pathname;
              
              // Proxy API requests to the API server
              if (path.startsWith('/api/')) {
                // Create a new request to forward to the API server
                const apiUrl = new URL(path, `http://localhost:${apiPort}`);
                
                // Copy search params
                url.searchParams.forEach((value, key) => {
                  apiUrl.searchParams.append(key, value);
                });
                
                // Forward the request to the API server
                try {
                  const apiResponse = await fetch(apiUrl, {
                    method: req.method,
                    headers: req.headers,
                    body: req.body
                  });
                  
                  // Create a new response with the API response
                  return new Response(apiResponse.body, {
                    status: apiResponse.status,
                    statusText: apiResponse.statusText,
                    headers: apiResponse.headers
                  });
                } catch (error) {
                  console.error(chalk.red(`Error proxying to API: ${error.message}`));
                  return new Response(`API server error: ${error.message}`, { status: 502 });
                }
              }
              
              // Serve static files for non-API requests
              let filePath = path;
              
              // Default to index.html for root or client-side routing paths
              if (filePath === '/' || (!filePath.includes('.') && !filePath.endsWith('/'))) {
                filePath = '/index.html';
              }
              
              // Try to serve the file from _dist
              const fullPath = join(distDir, filePath);
              
              if (existsSync(fullPath) && statSync(fullPath).isFile()) {
                return new Response(Bun.file(fullPath));
              }
              
              // If we're here and the path doesn't have an extension, it might be a client-side route
              // Serve index.html for client-side routing
              if (!path.includes('.')) {
                return new Response(Bun.file(join(distDir, 'index.html')));
              }
              
              // 404 if file not found
              return new Response('Not Found', { status: 404 });
            },
          });
          
          // Also set up HTTP to HTTPS redirect on port 80
          Bun.serve({
            port: 80,
            fetch(req) {
              const url = new URL(req.url);
              url.protocol = 'https:';
              url.port = '443';
              
              return new Response(null, {
                status: 301,
                headers: {
                  'Location': url.toString()
                }
              });
            }
          });
          
          console.log(chalk.green(`HTTPS server with SSL running on port 443`));
          console.log(chalk.green(`HTTP to HTTPS redirect running on port 80`));
        } catch (error) {
          console.error(chalk.red(`Failed to start HTTPS server: ${error.message}`));
          console.log(chalk.yellow(`Falling back to HTTP server...`));
          
          // Fall back to HTTP
          setupHttpServer();
        }
      } else {
        // HTTP only setup
        setupHttpServer();
      }
      
      function setupHttpServer() {
        server = Bun.serve({
          port: 80,
          async fetch(req) {
            const url = new URL(req.url);
            const path = url.pathname;
            
            // Proxy API requests to the API server
            if (path.startsWith('/api/')) {
              // Create a new request to forward to the API server
              const apiUrl = new URL(path, `http://localhost:${apiPort}`);
              
              // Copy search params
              url.searchParams.forEach((value, key) => {
                apiUrl.searchParams.append(key, value);
              });
              
              // Forward the request to the API server
              try {
                const apiResponse = await fetch(apiUrl, {
                  method: req.method,
                  headers: req.headers,
                  body: req.body
                });
                
                // Create a new response with the API response
                return new Response(apiResponse.body, {
                  status: apiResponse.status,
                  statusText: apiResponse.statusText,
                  headers: apiResponse.headers
                });
              } catch (error) {
                console.error(chalk.red(`Error proxying to API: ${error.message}`));
                return new Response(`API server error: ${error.message}`, { status: 502 });
              }
            }
            
            // Serve static files for non-API requests
            let filePath = path;
            
            // Default to index.html for root or client-side routing paths
            if (filePath === '/' || (!filePath.includes('.') && !filePath.endsWith('/'))) {
              filePath = '/index.html';
            }
            
            // Try to serve the file from _dist
            const fullPath = join(distDir, filePath);
            
            if (existsSync(fullPath) && statSync(fullPath).isFile()) {
              return new Response(Bun.file(fullPath));
            }
            
            // If we're here and the path doesn't have an extension, it might be a client-side route
            // Serve index.html for client-side routing
            if (!path.includes('.')) {
              return new Response(Bun.file(join(distDir, 'index.html')));
            }
            
            // 404 if file not found
            return new Response('Not Found', { status: 404 });
          },
        });
        
        console.log(chalk.green(`HTTP server running on port 80`));
      }
      
      console.log(chalk.green(`API proxy is set up to forward /api/* requests to http://localhost:${apiPort}`));
      console.log(chalk.green(`You can access Argon at ${apiUrl.replace('/api', '')}`));
    }
    
    // Handle graceful shutdown
    const cleanup = () => {
      console.log(chalk.blue('\nShutting down servers...'));
      
      // Kill the API process
      if (apiProcess && !apiProcess.killed) {
        apiProcess.kill();
      }
      
      process.exit(0);
    };
    
    // Listen for termination signals
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Keep the process running
    await new Promise(() => {});
  });

// Helper function to format permissions
function formatPermissions(permissionBitmap: number): string {
  return Object.entries(Permissions)
    .filter(([key, value]) => typeof value === 'number' && (permissionBitmap & value) === value)
    .map(([key]) => key)
    .join(', ');
}

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Parse command line arguments
program.parse();

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}