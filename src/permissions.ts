// Define string literal type for all permission values
export type Permission = typeof Permissions[keyof typeof Permissions];

export const Permissions = {
  // Admin wildcard
  ADMIN: 'admin.*',

  // Node management (all admin only)
  ADMIN_NODES: 'admin.nodes.*',
  ADMIN_NODES_LIST: 'admin.nodes.list',
  ADMIN_NODES_CREATE: 'admin.nodes.create',
  ADMIN_NODES_MODIFY: 'admin.nodes.modify',
  ADMIN_NODES_DELETE: 'admin.nodes.delete',

  // Unit management (all admin only)
  ADMIN_UNITS: 'admin.units.*',
  ADMIN_UNITS_LIST: 'admin.units.list',
  ADMIN_UNITS_CREATE: 'admin.units.create',
  ADMIN_UNITS_MODIFY: 'admin.units.modify',
  ADMIN_UNITS_DELETE: 'admin.units.delete',

  // Server management (admin)
  ADMIN_SERVERS: 'admin.servers.*',
  ADMIN_SERVERS_LIST: 'admin.servers.list',
  ADMIN_SERVERS_CREATE: 'admin.servers.create', // Admin only
  ADMIN_SERVERS_DELETE: 'admin.servers.delete', // Admin only

  // Server access (user)
  SERVERS_VIEW: 'servers.view',     // Can view their servers
  SERVERS_MANAGE: 'servers.manage'  // Can modify, power control, reinstall their servers
} as const;

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