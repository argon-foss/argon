// src/routers/apiKeys.ts
import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { authMiddleware, checkPermission } from '../middleware/auth';
import { hasPermission, Permissions } from '../permissions';

const router = Router();

// Ensure all routes require authentication
router.use(authMiddleware);

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()),
  expiresAt: z.string().datetime().optional()
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional().nullable()
});

// Helper function to generate a random API key
function generateApiKey(length = 32): string {
  return randomBytes(length).toString('hex');
}

// Get all API keys for current user
router.get('/', checkPermission(Permissions.ADMIN), async (req, res) => {
  try {
    let apiKeys;
    
    // If admin, allow querying by userId
    if (req.user && hasPermission(req.user.permissions, Permissions.ADMIN) && req.query.userId) {
      apiKeys = await db.apiKeys.findMany({
        where: { userId: req.query.userId as string }
      });
    } else {
      // Regular users can only see their own API keys
      const userId = req.user?.id || req.apiKey?.userId;
      apiKeys = await db.apiKeys.findMany({
        where: { userId }
      });
    }
    
    // Remove the actual key for security
    const safeApiKeys = apiKeys.map(({ key, ...rest }) => ({
      ...rest,
      // Return only first and last 4 chars of the key
      keyPreview: key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : null
    }));
    
    res.json(safeApiKeys);
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Create a new API key
router.post('/', checkPermission(Permissions.ADMIN), async (req, res) => {
  try {
    const data = createApiKeySchema.parse(req.body);
    
    // Generate a new random API key
    const key = generateApiKey();
    
    // Parse expiration date
    let expiresAt: Date | null = null;
    if (data.expiresAt) {
      expiresAt = new Date(data.expiresAt);
    }
    
    // Create the API key
    const apiKey = await db.apiKeys.create({
      name: data.name,
      key,
      userId: req.user!.id,
      permissions: data.permissions,
      lastUsed: null,
      expiresAt
    });
    
    // Return the full API key only once during creation
    res.status(201).json({
      ...apiKey,
      keyFull: key // Include the full key only during creation
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to create API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// Get a specific API key by ID
router.get('/:id', checkPermission(Permissions.ADMIN), async (req, res) => {
  try {
    const apiKey = await db.apiKeys.findUnique({ id: req.params.id });
    
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    // Check if user owns the API key or is admin
    const isAdmin = req.user && hasPermission(req.user.permissions, Permissions.ADMIN);
    const isOwner = req.user?.id === apiKey.userId || req.apiKey?.userId === apiKey.userId;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Remove the actual key for security
    const { key, ...safeApiKey } = apiKey;
    
    res.json({
      ...safeApiKey,
      keyPreview: key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : null
    });
  } catch (error) {
    console.error('Failed to fetch API key:', error);
    res.status(500).json({ error: 'Failed to fetch API key' });
  }
});

// Update an API key
router.patch('/:id', checkPermission(Permissions.ADMIN), async (req, res) => {
  try {
    const data = updateApiKeySchema.parse(req.body);
    
    const apiKey = await db.apiKeys.findUnique({ id: req.params.id });
    
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    // Check if user owns the API key or is admin
    const isAdmin = req.user && hasPermission(req.user.permissions, Permissions.ADMIN);
    const isOwner = req.user?.id === apiKey.userId;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Parse expiration date
    let expiresAt = apiKey.expiresAt;
    if (data.expiresAt === null) {
      expiresAt = null;
    } else if (data.expiresAt) {
      expiresAt = new Date(data.expiresAt);
    }
    
    // Update the API key
    const updatedApiKey = await db.apiKeys.update(
      { id: req.params.id },
      {
        name: data.name,
        permissions: data.permissions,
        expiresAt
      }
    );
    
    // Remove the actual key for security
    const { key, ...safeApiKey } = updatedApiKey;
    
    res.json({
      ...safeApiKey,
      keyPreview: key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to update API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// Regenerate an API key
router.post('/:id/regenerate', checkPermission(Permissions.ADMIN), async (req, res) => {
  try {
    const apiKey = await db.apiKeys.findUnique({ id: req.params.id });
    
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    // Check if user owns the API key or is admin
    const isAdmin = req.user && hasPermission(req.user.permissions, Permissions.ADMIN);
    const isOwner = req.user?.id === apiKey.userId;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Generate a new random API key
    const newKey = generateApiKey();
    
    // Update the API key
    const updatedApiKey = await db.apiKeys.update(
      { id: req.params.id },
      { key: newKey }
    );
    
    res.json({
      ...updatedApiKey,
      keyFull: newKey // Include the full key only during regeneration
    });
  } catch (error) {
    console.error('Failed to regenerate API key:', error);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

// Delete an API key
router.delete('/:id', checkPermission(Permissions.ADMIN), async (req, res) => {
  try {
    const apiKey = await db.apiKeys.findUnique({ id: req.params.id });
    
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    // Check if user owns the API key or is admin
    const isAdmin = req.user && hasPermission(req.user.permissions, Permissions.ADMIN);
    const isOwner = req.user?.id === apiKey.userId;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.apiKeys.delete({ id: req.params.id });
    
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

export default router;