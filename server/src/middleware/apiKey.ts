// src/middleware/apiKey.ts
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { Permission, hasPermission } from '../permissions';

declare global {
  namespace Express {
    interface Request {
      apiKey?: { 
        id: string;
        name: string;
        userId: string;
        permissions: Permission[];
      };
      user?: any;
    }
  }
}

/**
 * API Key authentication middleware
 * Checks for X-API-Key header and validates against the database
 */
export const apiKeyMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const apiKeyHeader = req.headers['x-api-key'];
    
    if (!apiKeyHeader) {
      return next(); // No API key provided, move to the next middleware
    }

    if (Array.isArray(apiKeyHeader)) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }

    const apiKey = await db.apiKeys.findByKey(apiKeyHeader);
    
    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check if the API key has expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key has expired' });
    }

    // Update last used timestamp
    await db.apiKeys.updateLastUsed(apiKey.id);

    // Attach API key data to request
    req.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      userId: apiKey.userId,
      permissions: apiKey.permissions as Permission[]
    };
    
    next();
  } catch (err) {
    console.error('API key middleware error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Permission check middleware for API keys
 * To be used after apiKeyMiddleware
 */
export const requireApiKeyPermission = (permission: string) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If we have a user already authenticated, proceed
  if (req.user) {
    return next();
  }

  // Check API key permissions
  if (!req.apiKey?.permissions) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!hasPermission(req.apiKey.permissions, permission)) {
    return res.status(403).json({ 
      error: 'Insufficient permissions',
      required: permission 
    });
  }

  next();
};