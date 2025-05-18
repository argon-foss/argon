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

// Schema for Docker images (new in v3)
const dockerImageSchema = z.object({
  image: z.string().min(1), // Docker image path/name
  displayName: z.string().min(1) // Human readable name
});

// V3: Schema for unit features
const unitFeatureSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  iconPath: z.string().optional(), // Optional path to an icon
  type: z.enum(['required', 'optional']),
  uiData: z.object({
    component: z.string(), // e.g., 'checkbox', 'select', etc.
    props: z.record(z.any()).optional() // Custom properties for the component
  }).optional()
});

// V3: Schema for unit metadata
const unitMetaSchema = z.object({
  version: z.string().default('argon/unit:v3'), // Version identifier
  author: z.string().optional(),
  website: z.string().optional(),
  supportUrl: z.string().optional()
});

// Main unit schema updated for v3
const unitSchema = z.object({
  name: z.string().min(1).max(100),
  shortName: z.string().min(1).max(20).regex(/^[a-z0-9-]+$/),
  description: z.string(),
  // V3: Multiple docker images with display names
  dockerImages: z.array(dockerImageSchema).min(1),
  // V3: Default image to use (reference to one in the array)
  defaultDockerImage: z.string(),
  // Legacy field kept for backward compatibility
  dockerImage: z.string().optional(),
  defaultStartupCommand: z.string(),
  configFiles: z.array(configFileSchema).default([]),
  environmentVariables: z.array(environmentVariableSchema).default([]),
  installScript: installScriptSchema,
  // V3: Enhanced startup configuration
  startup: z.object({
    userEditable: z.boolean().default(false),
    // V3: Regex to detect when server is online
    readyRegex: z.string().optional(), 
    // V3: Command to gracefully stop the server
    stopCommand: z.string().optional() 
  }).default({}),
  // V3: Features section for UI customization
  features: z.array(unitFeatureSchema).default([]),
  // V3: Meta information
  meta: unitMetaSchema.default({
    version: 'argon/unit:v3'
  }),
  // Resource requirements
  recommendedRequirements: z.object({
    memoryMiB: z.number().int().positive().optional(),
    diskMiB: z.number().int().positive().optional(),
    cpuPercent: z.number().positive().optional()
  }).optional()
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
router.get('/', checkPermission('admin'), async (req, res) => {
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
router.get('/:id', checkPermission('admin'), async (req, res) => {
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
router.post('/', checkPermission('admin'), async (req, res) => {
  try {
    const data = unitSchema.parse(req.body);

    // Validate that shortName is unique
    const existing = await db.units.findFirst({
      where: { shortName: data.shortName }
    });

    if (existing) {
      return res.status(400).json({ error: 'Short name must be unique' });
    }

    // Handle backward compatibility - if dockerImage is provided but dockerImages isn't
    if (!data.dockerImages || data.dockerImages.length === 0) {
      if (data.dockerImage) {
        data.dockerImages = [{ 
          image: data.dockerImage, 
          displayName: 'Default Image' 
        }];
        data.defaultDockerImage = data.dockerImage;
      } else {
        return res.status(400).json({ error: 'At least one Docker image must be provided' });
      }
    }

    // If defaultDockerImage isn't specified, use the first image
    if (!data.defaultDockerImage && data.dockerImages.length > 0) {
      data.defaultDockerImage = data.dockerImages[0].image;
    }

    // Ensure defaultDockerImage exists in dockerImages
    if (!data.dockerImages.some(di => di.image === data.defaultDockerImage)) {
      return res.status(400).json({ 
        error: 'Default Docker image must be one of the provided Docker images' 
      });
    }

    // For backward compatibility, set the dockerImage field to match defaultDockerImage
    data.dockerImage = data.defaultDockerImage;

    // Ensure meta has the correct version
    if (!data.meta) {
      data.meta = { version: 'argon/unit:v3' };
    } else if (!data.meta.version) {
      data.meta.version = 'argon/unit:v3';
    }

    // Create the unit
    const unit = await db.units.create({
      ...data,
      configFiles: data.configFiles || [],
      environmentVariables: data.environmentVariables || [],
      startup: data.startup || { userEditable: false },
      features: data.features || [],
      meta: data.meta
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
router.patch('/:id', checkPermission('admin'), async (req, res) => {
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

    // V3: Handle Docker image updates
    if (data.dockerImages || data.defaultDockerImage) {
      // Get current unit data to merge with
      const currentUnit = await db.units.findUnique({ id: req.params.id });
      if (!currentUnit) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      const updatedDockerImages = data.dockerImages || currentUnit.dockerImages;
      const updatedDefaultImage = data.defaultDockerImage || currentUnit.defaultDockerImage;

      // Ensure defaultDockerImage exists in dockerImages
      if (updatedDefaultImage && 
          !updatedDockerImages.some(di => di.image === updatedDefaultImage)) {
        return res.status(400).json({ 
          error: 'Default Docker image must be one of the provided Docker images' 
        });
      }

      // Update the dockerImage field for backward compatibility
      if (data.defaultDockerImage) {
        data.dockerImage = data.defaultDockerImage;
      }
    }

    // V3: Handle features update
    if (data.features) {
      // Validate feature names are unique
      const featureNames = new Set();
      for (const feature of data.features) {
        if (featureNames.has(feature.name)) {
          return res.status(400).json({ 
            error: `Duplicate feature name: ${feature.name}` 
          });
        }
        featureNames.add(feature.name);
      }
    }

    // V3: Handle meta update - ensure version is preserved
    if (data.meta) {
      if (!data.meta.version) {
        data.meta.version = 'argon/unit:v3';
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
router.delete('/:id', checkPermission('admin'), async (req, res) => {
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
router.get('/:id/export', checkPermission('admin'), async (req, res) => {
  try {
    const unit = await db.units.findUnique({ id: req.params.id });

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const exportData = {
      name: unit.name,
      shortName: unit.shortName,
      description: unit.description,
      dockerImages: unit.dockerImages,
      defaultDockerImage: unit.defaultDockerImage,
      defaultStartupCommand: unit.defaultStartupCommand,
      configFiles: unit.configFiles,
      environmentVariables: unit.environmentVariables,
      installScript: unit.installScript,
      startup: unit.startup,
      features: unit.features,
      meta: unit.meta,
      recommendedRequirements: unit.recommendedRequirements
    };

    res.attachment(`unit-${unit.shortName}.json`);
    res.json(exportData);
  } catch (error) {
    console.error('Failed to export unit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import unit configuration
router.post('/import', checkPermission('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    let importData = JSON.parse(fileContent);
    
    // V3: Handle older export formats
    if (importData.dockerImage && (!importData.dockerImages || importData.dockerImages.length === 0)) {
      importData.dockerImages = [{ 
        image: importData.dockerImage, 
        displayName: 'Default Image' 
      }];
      importData.defaultDockerImage = importData.dockerImage;
    }
    
    // Add v3 meta if missing
    if (!importData.meta) {
      importData.meta = { version: 'argon/unit:v3' };
    } else if (!importData.meta.version) {
      importData.meta.version = 'argon/unit:v3';
    }
    
    // Validate the import data
    const data = unitSchema.parse(importData);

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
      startup: data.startup || { userEditable: false },
      features: data.features || [],
      meta: data.meta
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

// Get all cargo containers assigned to a unit
router.get('/:id/containers', checkPermission('admin'), async (req, res) => {
  try {
    const unit = await db.units.findUnique({ id: req.params.id });

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const containers = await db.units.getUnitCargoContainers(req.params.id);
    res.json(containers);
  } catch (error) {
    console.error('Failed to fetch unit containers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign a cargo container to a unit
router.post('/:unitId/containers/:containerId', checkPermission('admin'), async (req, res) => {
  try {
    const { unitId, containerId } = req.params;
    
    // Verify unit exists
    const unit = await db.units.findUnique({ id: unitId });
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    // Verify container exists
    const container = await db.cargo.findContainer(containerId);
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    // Assign container to unit
    await db.units.assignCargoContainer(unitId, containerId);
    
    res.status(204).send();
  } catch (error) {
    console.error('Failed to assign container to unit:', error);
    res.status(500).json({ error: 'Failed to assign container' });
  }
});

// Remove a cargo container from a unit
router.delete('/:unitId/containers/:containerId', checkPermission('admin'), async (req, res) => {
  try {
    const { unitId, containerId } = req.params;
    
    // Verify unit exists
    const unit = await db.units.findUnique({ id: unitId });
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    // Remove container from unit
    await db.units.removeCargoContainer(unitId, containerId);
    
    res.status(204).send();
  } catch (error) {
    console.error('Failed to remove container from unit:', error);
    res.status(500).json({ error: 'Failed to remove container' });
  }
});

// V3: Get available Docker images for a unit
router.get('/:id/docker-images', checkPermission('admin'), async (req, res) => {
  try {
    const unit = await db.units.findUnique({ id: req.params.id });

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.json({
      dockerImages: unit.dockerImages || [],
      defaultDockerImage: unit.defaultDockerImage
    });
  } catch (error) {
    console.error('Failed to fetch unit Docker images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// V3: Update Docker images for a unit
router.patch('/:id/docker-images', checkPermission('admin'), async (req, res) => {
  try {
    const schema = z.object({
      dockerImages: z.array(dockerImageSchema).min(1),
      defaultDockerImage: z.string().optional()
    });
    
    const data = schema.parse(req.body);
    
    // Get current unit
    const unit = await db.units.findUnique({ id: req.params.id });
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    // If defaultDockerImage isn't specified, keep current one if it's in the new images
    let defaultDockerImage = data.defaultDockerImage;
    if (!defaultDockerImage) {
      // Check if current default is in new images
      if (data.dockerImages.some(di => di.image === unit.defaultDockerImage)) {
        defaultDockerImage = unit.defaultDockerImage;
      } else {
        // Otherwise use the first new image
        defaultDockerImage = data.dockerImages[0].image;
      }
    } else {
      // Ensure specified default exists in the images
      if (!data.dockerImages.some(di => di.image === defaultDockerImage)) {
        return res.status(400).json({ 
          error: 'Default Docker image must be one of the provided Docker images' 
        });
      }
    }
    
    // Update the unit
    const updatedUnit = await db.units.update(
      { id: req.params.id },
      { 
        dockerImages: data.dockerImages,
        defaultDockerImage,
        // Update the legacy field for backward compatibility
        dockerImage: defaultDockerImage
      }
    );
    
    res.json({
      dockerImages: updatedUnit.dockerImages,
      defaultDockerImage: updatedUnit.defaultDockerImage
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to update unit Docker images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// V3: Get unit features
router.get('/:id/features', checkPermission('admin'), async (req, res) => {
  try {
    const unitId = req.params.id;
    
    // Get unit
    const unit = await db.units.findUnique({ id: unitId });
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    res.json({ features: unit.features || [] });
  } catch (error) {
    console.error('Failed to fetch unit features:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// V3: Update all unit features
router.patch('/:id/features', checkPermission('admin'), async (req, res) => {
  try {
    const unitId = req.params.id;
    
    // Validate the features array
    const schema = z.array(unitFeatureSchema);
    
    const features = schema.parse(req.body);
    
    // Get current unit
    const unit = await db.units.findUnique({ id: unitId });
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    // Validate feature names are unique
    const featureNames = new Set();
    for (const feature of features) {
      if (featureNames.has(feature.name)) {
        return res.status(400).json({ 
          error: `Duplicate feature name: ${feature.name}` 
        });
      }
      featureNames.add(feature.name);
    }
    
    // Update only the features
    const updatedUnit = await db.units.update(
      { id: unitId },
      { features: features }
    );
    
    res.json({ features: updatedUnit.features });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to update unit features:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// V3: Add a new feature to a unit
router.post('/:id/features', checkPermission('admin'), async (req, res) => {
  try {
    const unitId = req.params.id;
    
    // Validate the feature
    const schema = unitFeatureSchema;
    
    const newFeature = schema.parse(req.body);
    
    // Get current unit
    const unit = await db.units.findUnique({ id: unitId });
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    // Get current features and add the new one
    const currentFeatures = unit.features || [];
    
    // Check for duplicate feature names
    if (currentFeatures.some(f => f.name === newFeature.name)) {
      return res.status(400).json({ error: 'Feature with this name already exists' });
    }
    
    const updatedFeatures = [...currentFeatures, newFeature];
    
    // Update the unit with the new features array
    const updatedUnit = await db.units.update(
      { id: unitId },
      { features: updatedFeatures }
    );
    
    res.status(201).json({ 
      feature: newFeature,
      features: updatedUnit.features 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to add unit feature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// V3: Delete a feature from a unit
router.delete('/:id/features/:featureName', checkPermission('admin'), async (req, res) => {
  try {
    const unitId = req.params.id;
    const featureName = req.params.featureName;
    
    // Get current unit
    const unit = await db.units.findUnique({ id: unitId });
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    // Get current features and filter out the one to delete
    const currentFeatures = unit.features || [];
    const updatedFeatures = currentFeatures.filter(f => f.name !== featureName);
    
    // Check if the feature existed
    if (currentFeatures.length === updatedFeatures.length) {
      return res.status(404).json({ error: 'Feature not found' });
    }
    
    // Update the unit with the new features array
    await db.units.update(
      { id: unitId },
      { features: updatedFeatures }
    );
    
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete unit feature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// V3: Get unit meta
router.get('/:id/meta', checkPermission('admin'), async (req, res) => {
  try {
    const unitId = req.params.id;
    
    // Get unit
    const unit = await db.units.findUnique({ id: unitId });
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    // If meta is missing, create a default v3 meta
    const meta = unit.meta || { version: 'argon/unit:v3' };
    
    res.json({ meta });
  } catch (error) {
    console.error('Failed to fetch unit meta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// V3: Update unit meta
router.patch('/:id/meta', checkPermission('admin'), async (req, res) => {
  try {
    const unitId = req.params.id;
    
    // Validate the meta object
    const schema = unitMetaSchema;
    
    const metaData = schema.parse(req.body);
    
    // Ensure version is set to v3
    if (!metaData.version) {
      metaData.version = 'argon/unit:v3';
    }
    
    // Get current unit
    const unit = await db.units.findUnique({ id: unitId });
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    // Update only the meta
    const updatedUnit = await db.units.update(
      { id: unitId },
      { meta: metaData }
    );
    
    res.json({ meta: updatedUnit.meta });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to update unit meta:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// V3: Get version information
router.get('/version', checkPermission('admin'), async (req, res) => {
  try {
    res.json({
      version: 'argon/unit:v3'
    });
  } catch (error) {
    console.error('Failed to fetch version info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;