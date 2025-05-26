import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authMiddleware, checkPermission } from '../middleware/auth';
import { Permissions } from '../permissions'; // Changed import from Permission to Permissions
import { z } from 'zod';
import { validateRequest } from '../middleware/validation';

const router = Router();

const updateSettingsSchema = z.object({
  panel_name: z.string().min(1, 'Panel name cannot be empty'),
});

router.put(
  '/system/settings',
  authMiddleware,
  checkPermission(Permissions.ADMIN), // Changed to Permissions.ADMIN
  validateRequest(updateSettingsSchema),
  async (req: Request, res: Response) => {
    const { panel_name } = req.body;

    try {
      // Check if the panel_name key exists
      const existingSetting = db.db.query(
        `SELECT id FROM system_settings WHERE key = 'panel_name'`
      ).get() as { id: string } | undefined;

      if (existingSetting) {
        // Update existing setting
        db.db.prepare(
          `UPDATE system_settings SET value = ?, updatedAt = datetime('now') WHERE key = 'panel_name'`
        ).run(panel_name);
      } else {
        // Insert new setting if it doesn't exist (should have been seeded by migration)
        db.db.prepare(
          `INSERT INTO system_settings (id, key, value, createdAt, updatedAt) 
           VALUES (?, 'panel_name', ?, datetime('now'), datetime('now'))`
        ).run(crypto.randomUUID(), panel_name);
      }
      
      res.status(200).json({ message: 'Panel name updated successfully' });
    } catch (error) {
      console.error('Error updating panel name:', error);
      res.status(500).json({ error: 'Failed to update panel name' });
    }
  }
);

export default router;
