import { Router } from 'express';
import { compare, hash } from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { JWT_SECRET } from '../config';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { Permissions } from '../permissions';

const router = Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const existingUser = await db.users.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await hash(password, 10);
    const user = await db.users.createUser(username, hashedPassword);

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, permissions: user.permissions });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const user = await db.users.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, permissions: user.permissions });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/state', authMiddleware, (req, res) => {
  res.json({
    authenticated: true,
    username: req.user!.username,
    permissions: req.user!.permissions
  });
});

// Admin routes for managing permissions
router.put(
  '/users/:userId/permissions',
  authMiddleware,
  requirePermission(Permissions.ADMIN_NODES),
  async (req, res) => {
    const { permissions } = req.body;
    const { userId } = req.params;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
    }

    const success = await db.users.updateUserPermissions(userId, permissions);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true });
  }
);

export default router;