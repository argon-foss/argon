import { Router } from 'express';
import { z } from 'zod';
import { hasPermission } from '../permissions';
import { db } from '../db';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';

// Setup multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Schema for environment variables
// These get processed by the daemon using %VARIABLE_NAME% syntax
const environmentVariableSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  defaultValue: z.string(),
  required: z.boolean().default(false),
  userViewable: z.boolean().default(true),
  userEditable: z.boolean().default(false),
  rules: z.string() // Validation rules like 'required|string|max:20'
});

// Schema for config files that will be written during installation
const configFileSchema = z.object({
  path: z.string().min(1), // Path relative to /home/container
  content: z.string() // File content
});

// Schema for installation process
const installScriptSchema = z.object({
  dockerImage: z.string(), // Docker image used for installation
  entrypoint: z.string().default('bash'), // Entrypoint for running install script
  script: z.string() // The actual installation script
});

// Main unit schema
const unitSchema = z.object({
  name: z.string().min(1).max(100),
  shortName: z.string().min(1).max(20).regex(/^[a-z0-9-]+$/),
  description: z.string(),
  dockerImage: z.string(),
  defaultStartupCommand: z.string(),
  configFiles: z.array(configFileSchema).default([]),
  environmentVariables: z.array(environmentVariableSchema).default([]),
  installScript: installScriptSchema,
  startup: z.object({
    userEditable: z.boolean().default(false)
  }).default({})
});

const router = Router();
router.use(authMiddleware);

// Middleware to check admin permissions
const checkPermission = (permission: string) => (req: any, res: any, next: any) => {
  if (!hasPermission(req.user.permissions, permission)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// List all units
router.get('/', checkPermission('admin.units.list'), async (req, res) => {
  try {
    const units = await db.units.findMany({ 
      orderBy: { name: 'asc' }
    });
    res.json(units);
  } catch (error) {
    console.error('Failed to fetch units:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific unit
router.get('/:id', checkPermission('admin.units.list'), async (req, res) => {
  try {
    const unit = await db.units.findUnique({ id: req.params.id });

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.json(unit);
  } catch (error) {
    console.error('Failed to fetch unit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create unit
router.post('/', checkPermission('admin.units.create'), async (req, res) => {
  try {
    const data = unitSchema.parse(req.body);

    // Validate that shortName is unique
    const existing = await db.units.findFirst({
      where: { shortName: data.shortName }
    });

    if (existing) {
      return res.status(400).json({ error: 'Short name must be unique' });
    }

    // Create the unit
    const unit = await db.units.create({
      ...data,
      configFiles: data.configFiles || [],
      environmentVariables: data.environmentVariables || [],
      startup: data.startup || { userEditable: false }
    });

    res.status(201).json(unit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to create unit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update unit
router.patch('/:id', checkPermission('admin.units.modify'), async (req, res) => {
  try {
    const data = unitSchema.partial().parse(req.body);

    // If shortName is being updated, check uniqueness
    if (data.shortName) {
      const existing = await db.units.findFirst({
        where: { shortName: data.shortName }
      });

      if (existing && existing.id !== req.params.id) {
        return res.status(400).json({ error: 'Short name must be unique' });
      }
    }

    const unit = await db.units.update(
      { id: req.params.id },
      data
    );

    res.json(unit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to update unit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete unit
router.delete('/:id', checkPermission('admin.units.delete'), async (req, res) => {
  try {
    // Check if unit is in use by any servers
    const servers = await db.servers.findMany({
      where: { unitId: req.params.id }
    });

    if (servers.length > 0) {
      return res.status(400).json({ error: 'Cannot delete unit that is in use by servers' });
    }

    await db.units.delete({ id: req.params.id });
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete unit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export unit configuration
router.get('/:id/export', checkPermission('admin.units.list'), async (req, res) => {
  try {
    const unit = await db.units.findUnique({ id: req.params.id });

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

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

    res.attachment(`unit-${unit.shortName}.json`);
    res.json(exportData);
  } catch (error) {
    console.error('Failed to export unit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import unit configuration
router.post('/import', checkPermission('admin.units.create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const data = unitSchema.parse(JSON.parse(fileContent));

    // Generate unique shortName if needed
    let shortName = data.shortName;
    let counter = 1;

    while (await db.units.findFirst({ where: { shortName } })) {
      shortName = `${data.shortName}-${counter}`;
      counter++;
    }

    const unit = await db.units.create({
      ...data,
      shortName,
      configFiles: data.configFiles || [],
      environmentVariables: data.environmentVariables || [],
      startup: data.startup || { userEditable: false }
    });

    res.status(201).json(unit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid unit configuration' });
    }
    console.error('Failed to import unit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;