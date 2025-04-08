// src/permissions.ts

/**
 * Centralized permissions definition and checking utilities
 */

// Define string literal type for all permission values
export type Permission = typeof Permissions[keyof typeof Permissions];

export const Permissions = {
  ADMIN: 'admin',
  USER: 'user'
} as const;

/**
 * Default permission sets for easier assignment
 */
export const PermissionSets = {
  // Default user permissions - basic server management
  DEFAULT: [
    Permissions.USER
  ],
  
  // Full admin access
  ADMIN: [
    Permissions.ADMIN
  ]
};

/**
 * Check if a user has a required permission
 * Handles wildcards and null/undefined values safely
 */
export function hasPermission(userPermissions: string[] | undefined | null, requiredPermission: string): boolean {
  if (!userPermissions?.length) {
    return false;
  }

  // Admin wildcard check
  if (userPermissions.includes(Permissions.ADMIN)) {
    return true;
  }

  // Check each permission
  return userPermissions.some(permission => {
    // Direct match
    if (permission === requiredPermission) {
      return true;
    }

    // Wildcard match
    if (permission.endsWith('.*')) {
      const prefix = permission.slice(0, -2);
      return requiredPermission.startsWith(prefix);
    }

    return false;
  });
}

/**
 * Generate middleware function for permission checking
 * Maintains same interface as original for router compatibility
 */
export const checkPermission = (permission: string) => (req: any, res: any, next: any) => {
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
 * Alias for checkPermission for use with the users router
 * This maintains backward compatibility with the existing code
 */
export const requirePermission = checkPermission;