import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { db } from '../db';
import { Permission, hasPermission } from '../permissions';

// Enhance type definitions for better safety
declare global {
  namespace Express {
    interface Request {
      user?: { 
        id: string;
        username: string;
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
 * Authentication middleware
 * Verifies JWT and attaches user data to request
 */
export const authMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or invalid format' });
    }

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
      
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Token has expired' });
      } else if (err instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: 'Invalid token format' });
      }
      throw err;
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Permission check middleware - original style
 * Used by node/server/unit routers
 */
export const checkPermission = (permission: string) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.permissions) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!hasPermission(req.user.permissions, permission)) {
    return res.status(403).json({ 
      error: 'Insufficient permissions',
      required: permission 
    });
  }

  next();
};

/**
 * Permission check middleware - new style
 * Used by auth router
 */
export const requirePermission = (permission: string) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.permissions) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!hasPermission(req.user.permissions, permission)) {
    return res.status(403).json({ 
      error: 'Insufficient permissions',
      required: permission 
    });
  }

  next();
};