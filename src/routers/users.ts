// src/routers/users.ts
import { Router } from 'express';
import { hash } from 'bcrypt';
import { db } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { Permissions } from '../permissions';

const router = Router();

// Get all users (admin only)
router.get(
  '/',
  authMiddleware,
  requirePermission(Permissions.ADMIN),
  async (req, res) => {
    try {
      const users = await db.users.findMany();
      // Remove sensitive data
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// Get single user (admin only)
router.get(
  '/:id',
  authMiddleware,
  requirePermission(Permissions.ADMIN),
  async (req, res) => {
    try {
      const user = await db.users.findUnique({ id: req.params.id });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      // Remove sensitive data
      const { password, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
);

// Create user (admin only)
router.post(
  '/',
  authMiddleware,
  requirePermission(Permissions.ADMIN),
  async (req, res) => {
    const { username, password, permissions } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    try {
      const existingUser = await db.users.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      const hashedPassword = await hash(password, 10);
      const user = await db.users.createUser(username, hashedPassword, permissions);
      
      // Remove sensitive data
      const { password: _, ...sanitizedUser } = user;
      res.status(201).json(sanitizedUser);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// Update user (admin only)
router.patch(
  '/:id',
  authMiddleware,
  requirePermission(Permissions.ADMIN),
  async (req, res) => {
    const { username, password, permissions } = req.body;
    const updates: any = {};

    if (username) updates.username = username;
    if (permissions) updates.permissions = permissions;
    if (password) {
      updates.password = await hash(password, 10);
    }

    try {
      const user = await db.users.updateUser({ id: req.params.id }, updates);
      // Remove sensitive data
      const { password: _, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// Delete user (admin only)
router.delete(
  '/:id',
  authMiddleware,
  requirePermission(Permissions.ADMIN),
  async (req, res) => {
    try {
      await db.users.delete({ id: req.params.id });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

export default router;