import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { db } from '../db';
import { Permission, hasPermission } from '../permissions';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      apiKey?: { 
        id: string;
        name: string;
        userId: string;
        permissions: Permission[];
      };
    }
  }
}

interface JWTPayload {
  id: string;
  username: string;
  exp?: number;
  iat?: number;
}

/**
 * Combined authentication middleware
 * Tries JWT first, then falls back to API key
 */
export const authMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    // Try JWT authentication
    const authHeader = req.headers.authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        
        // Check token expiration explicitly
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ error: 'Token has expired' });
        }
        
        const user = await db.users.getUserByUsername(decoded.username);
        
        if (!user) {
          return res.status(401).json({ error: 'User no longer exists' });
        }

        // Attach full user data to request
        req.user = {
          id: user.id,
          username: user.username,
          permissions: user.permissions as Permission[]
        };
        
        return next();
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          return res.status(401).json({ error: 'Token has expired' });
        } else if (err instanceof jwt.JsonWebTokenError) {
          return res.status(401).json({ error: 'Invalid token format' });
        }
        throw err;
      }
    }
    
    // Try API key authentication
    const apiKeyHeader = req.headers['x-api-key'];
    
    if (apiKeyHeader) {
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
      
      return next();
    }
    
    // No authentication method provided
    return res.status(401).json({ error: 'Authentication required' });
    
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Permission check middleware
 * Works with both JWT and API key authentication
 */
export const checkPermission = (permission: string) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check user permissions first
  if (req.user?.permissions) {
    if (hasPermission(req.user.permissions, permission)) {
      return next();
    }
  }

  // If no user or insufficient user permissions, check API key
  if (req.apiKey?.permissions) {
    if (hasPermission(req.apiKey.permissions, permission)) {
      return next();
    }
  }

  // Neither authentication method has sufficient permissions
  return res.status(403).json({ 
    error: 'Insufficient permissions',
    required: permission 
  });
};

/**
 * Permission check middleware - original style
 * Used by node/server/unit routers
 */
export const requirePermission = checkPermission;