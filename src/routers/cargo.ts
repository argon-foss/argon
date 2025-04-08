import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import multer from 'multer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import axios from 'axios';
import mime from 'mime-types';
import { hasPermission } from '../permissions';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db';

let dataDirectory = 'storage/'

// Configure multer for file uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: './uploads/cargo',
        filename: (req, file, cb) => {
            cb(null, `${randomUUID()}-${file.originalname}`);
        }
    }),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Validation schemas
const cargoPropertiesSchema = z.object({
    hidden: z.boolean().optional(),
    readonly: z.boolean().optional(),
    noDelete: z.boolean().optional(),
    customProperties: z.record(z.any()).optional()
});

const createLocalCargoSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string(),
    properties: cargoPropertiesSchema
});

const createRemoteCargoSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string(),
    remoteUrl: z.string().url(),
    properties: cargoPropertiesSchema
});

const createContainerSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string(),
    items: z.array(z.object({
        cargoId: z.string().uuid(),
        targetPath: z.string().min(1)
    }))
});

const router = Router();
router.use(authMiddleware);

// Helper function to check admin permissions
const checkPermission = (permission: string) => (req: any, res: any, next: any) => {
    if (!hasPermission(req.user.permissions, permission)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
};

// Helper to calculate file hash
async function calculateFileHash(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const content = await fs.readFile(filePath);
    hash.update(content);
    return hash.digest('hex');
}

// Helper to validate remote URL
async function validateRemoteUrl(url: string): Promise<{ size: number; mimeType: string }> {
    try {
        const response = await axios.head(url);
        const size = parseInt(response.headers['content-length'] || '0', 10);
        const mimeType = response.headers['content-type'] || 'application/octet-stream';

        if (size === 0) {
            throw new Error('Could not determine file size');
        }

        return { size, mimeType };
    } catch (error) {
        throw new Error(`Failed to validate remote URL: ${error.message}`);
    }
}

// Upload local cargo
router.post(
    '/upload',
    checkPermission('admin'),
    upload.single('file'),
    async (req: any, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const data = createLocalCargoSchema.parse(JSON.parse(req.body.data));
            const hash = await calculateFileHash(req.file.path);

            // Check for duplicate by hash
            const existing = await db.cargo.findManyCargo({
                where: { hash }
            });

            if (existing.length > 0) {
                await fs.unlink(req.file.path);
                return res.status(400).json({ error: 'File already exists' });
            }

            // Move file to permanent storage
            const storageDir = path.join(dataDirectory, 'cargo', hash.substring(0, 2));
            await fs.mkdir(storageDir, { recursive: true });
            await fs.rename(req.file.path, path.join(storageDir, hash));

            const cargo = await db.cargo.createCargo({
                ...data,
                hash,
                size: req.file.size,
                mimeType: req.file.mimetype,
                type: 'local',
                properties: data.properties
            });

            res.status(201).json(cargo);
        } catch (error) {
            if (req.file) {
                await fs.unlink(req.file.path).catch(() => { });
            }
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Failed to upload cargo:', error);
            res.status(500).json({ error: 'Failed to upload cargo' });
        }
    }
);

// Create remote cargo
router.post('/remote', checkPermission('admin'), async (req, res) => {
    try {
        const data = createRemoteCargoSchema.parse(req.body);

        // Validate remote URL
        const { size, mimeType } = await validateRemoteUrl(data.remoteUrl);

        const cargo = await db.cargo.createCargo({
            ...data,
            hash: '',
            size,
            mimeType,
            type: 'remote',
            properties: data.properties
        });

        res.status(201).json(cargo);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Failed to create remote cargo:', error);
        res.status(500).json({ error: 'Failed to create remote cargo' });
    }
});

// List all cargo
router.get('/', checkPermission('admin'), async (req, res) => {
    try {
        const cargo = await db.cargo.findManyCargo();
        res.json(cargo);
    } catch (error) {
        console.error('Failed to list cargo:', error);
        res.status(500).json({ error: 'Failed to list cargo' });
    }
});

// Get specific cargo
router.get('/:id', checkPermission('admin'), async (req, res) => {
    try {
        const cargo = await db.cargo.findCargo(req.params.id);
        if (!cargo) {
            return res.status(404).json({ error: 'Cargo not found' });
        }
        res.json(cargo);
    } catch (error) {
        console.error('Failed to get cargo:', error);
        res.status(500).json({ error: 'Failed to get cargo' });
    }
});

// Download cargo file
router.get('/:id/download', checkPermission('admin'), async (req, res) => {
    try {
        const cargo = await db.cargo.findCargo(req.params.id);
        if (!cargo) {
            return res.status(404).json({ error: 'Cargo not found' });
        }

        if (cargo.type === 'remote') {
            // For remote cargo, redirect to the remote URL
            return res.redirect(cargo.remoteUrl!);
        }

        // For local cargo, serve the file
        const filePath = path.join(
            dataDirectory,
            'cargo',
            cargo.hash.substring(0, 2),
            cargo.hash
        );

        res.setHeader('Content-Type', cargo.mimeType);
        res.setHeader('Content-Length', cargo.size);
        res.setHeader('Content-Disposition', `attachment; filename="${cargo.name}"`);

        res.sendFile(filePath);
    } catch (error) {
        console.error('Failed to download cargo:', error);
        res.status(500).json({ error: 'Failed to download cargo' });
    }
});

// Update cargo properties
router.patch('/:id', checkPermission('admin'), async (req, res) => {
    try {
        const cargo = await db.cargo.findCargo(req.params.id);
        if (!cargo) {
            return res.status(404).json({ error: 'Cargo not found' });
        }

        const data = z.object({
            name: z.string().min(1).max(255).optional(),
            description: z.string().optional(),
            properties: cargoPropertiesSchema.optional()
        }).parse(req.body);

        const updated = await db.cargo.updateCargo(req.params.id, data);
        res.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Failed to update cargo:', error);
        res.status(500).json({ error: 'Failed to update cargo' });
    }
});

// Delete cargo
router.delete('/:id', checkPermission('admin'), async (req, res) => {
    try {
        const cargo = await db.cargo.findCargo(req.params.id);
        if (!cargo) {
            return res.status(404).json({ error: 'Cargo not found' });
        }

        // Check if cargo is used in any containers
        const containers = await db.cargo.findManyContainers({
            where: {
                items: {
                    contains: cargo.id
                }
            }
        });

        if (containers.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete cargo that is used in containers',
                containers: containers.map(c => ({ id: c.id, name: c.name }))
            });
        }

        if (cargo.type === 'local') {
            // Delete the file
            const filePath = path.join(
                dataDirectory,
                'cargo',
                cargo.hash.substring(0, 2),
                cargo.hash
            );
            await fs.unlink(filePath).catch(() => { });
        }

        await db.cargo.deleteCargo(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Failed to delete cargo:', error);
        res.status(500).json({ error: 'Failed to delete cargo' });
    }
});

// Create container
router.post('/containers', checkPermission('admin'), async (req, res) => {
    try {
        const data = createContainerSchema.parse(req.body);

        // Verify all cargo items exist
        for (const item of data.items) {
            const cargo = await db.cargo.findCargo(item.cargoId);
            if (!cargo) {
                return res.status(400).json({ error: `Cargo ${item.cargoId} not found` });
            }
        }

        const container = await db.cargo.createContainer(data);
        res.status(201).json(container);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Failed to create container:', error);
        res.status(500).json({ error: 'Failed to create container' });
    }
});

// List containers
router.get('/containers', checkPermission('admin'), async (req, res) => {
    try {
        const containers = await db.cargo.findManyContainers();
        res.json(containers);
    } catch (error) {
        console.error('Failed to list containers:', error);
        res.status(500).json({ error: 'Failed to list containers' });
    }
});

// Get specific container
router.get('/containers/:id', checkPermission('admin'), async (req, res) => {
    try {
        const container = await db.cargo.findContainer(req.params.id);
        if (!container) {
            return res.status(404).json({ error: 'Container not found' });
        }
        res.json(container);
    } catch (error) {
        console.error('Failed to get container:', error);
        res.status(500).json({ error: 'Failed to get container' });
    }
});

// Update container
router.patch('/containers/:id', checkPermission('admin'), async (req, res) => {
    try {
        const data = createContainerSchema.partial().parse(req.body);

        // If updating items, verify all cargo exists
        if (data.items) {
            for (const item of data.items) {
                const cargo = await db.cargo.findCargo(item.cargoId);
                if (!cargo) {
                    return res.status(400).json({ error: `Cargo ${item.cargoId} not found` });
                }
            }
        }

        const updated = await db.cargo.updateContainer(req.params.id, data);
        res.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Failed to update container:', error);
        res.status(500).json({ error: 'Failed to update container' });
    }
});

// Delete container
router.delete('/containers/:id', checkPermission('admin'), async (req, res) => {
    try {
        // Check if container is assigned to any units
        const container = await db.cargo.findContainer(req.params.id);
        if (!container) {
            return res.status(404).json({ error: 'Container not found' });
        }

        await db.cargo.deleteContainer(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Failed to delete container:', error);
        res.status(500).json({ error: 'Failed to delete container' });
    }
});

// Assign container to unit
router.post('/containers/:containerId/units/:unitId', checkPermission('admin'), async (req, res) => {
    try {
        await db.cargo.assignContainerToUnit(req.params.unitId, req.params.containerId);
        res.status(204).send();
    } catch (error) {
        console.error('Failed to assign container to unit:', error);
        res.status(500).json({ error: 'Failed to assign container to unit' });
    }
});

// Remove container from unit
router.delete('/containers/:containerId/units/:unitId', checkPermission('admin'), async (req, res) => {
    try {
        await db.cargo.removeContainerFromUnit(req.params.unitId, req.params.containerId);
        res.status(204).send();
    } catch (error) {
        console.error('Failed to remove container from unit:', error);
        res.status(500).json({ error: 'Failed to remove container from unit' });
    }
});

export default router;