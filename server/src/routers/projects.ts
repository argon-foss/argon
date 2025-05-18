// src/routers/projects.ts
import { Router } from 'express';
import { z } from 'zod';
// @ts-ignore
import { Database } from 'bun:sqlite';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { hasPermission } from '../permissions';
import { Permissions } from '../permissions';

const router = Router();
const database = new Database('argon.db');

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional()
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable()
});

// Get all projects for the authenticated user
router.get('/', async (req: any, res) => {
  try {
    const isAdmin = hasPermission(req.user.permissions, Permissions.ADMIN);
    let projects;
    
    if (isAdmin && req.query.userId) {
      // Admin can view all projects for any user
      projects = await db.projects.getUserProjectsWithServerCount(req.query.userId);
    } else {
      // Regular users can only view their own projects
      projects = await db.projects.getUserProjectsWithServerCount(req.user.id);
    }
    
    res.json(projects);
  } catch (error: any) {
    console.error('Failed to fetch projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get a specific project
router.get('/:id', async (req: any, res) => {
  try {
    const project = await db.projects.getProjectWithServerCount(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if user has access to this project
    const isAdmin = hasPermission(req.user.permissions, Permissions.ADMIN);
    if (!isAdmin && project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(project);
  } catch (error: any) {
    console.error('Failed to fetch project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create a new project
router.post('/', async (req: any, res) => {
  try {
    const data = createProjectSchema.parse(req.body);
    
    const project = await db.projects.create({
      ...data,
      userId: req.user.id
    });
    
    res.status(201).json(project);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to create project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update a project
router.patch('/:id', async (req: any, res) => {
  try {
    const project = await db.projects.findUnique({ id: req.params.id });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if user has access to update this project
    const isAdmin = hasPermission(req.user.permissions, Permissions.ADMIN);
    if (!isAdmin && project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const data = updateProjectSchema.parse(req.body);
    const updatedProject = await db.projects.update({ id: req.params.id }, data);
    
    res.json(updatedProject);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to update project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete a project
router.delete('/:id', async (req: any, res) => {
  try {
    const project = await db.projects.findUnique({ id: req.params.id });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if this is the default project
    if (project.name === 'Default') {
      return res.status(400).json({ error: 'Cannot delete the default project' });
    }
    
    // Check if user has access to delete this project
    const isAdmin = hasPermission(req.user.permissions, Permissions.ADMIN);
    if (!isAdmin && project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get the default project for this user
    const defaultProject = await db.projects.getOrCreateDefaultProject(project.userId);
    
    // Begin transaction
    database.prepare('BEGIN TRANSACTION').run();
    
    try {
      // Move all servers in this project to the default project
      database.prepare(`
        UPDATE servers
        SET projectId = ?, updatedAt = ?
        WHERE projectId = ?
      `).run(
        defaultProject.id,
        new Date().toISOString(),
        project.id
      );
      
      // Delete the project
      await db.projects.delete({ id: project.id });
      
      // Commit transaction
      database.prepare('COMMIT').run();
      
      res.status(204).send();
    } catch (error) {
      // Rollback on error
      database.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error: any) {
    console.error('Failed to delete project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Get servers in a project
router.get('/:id/servers', async (req: any, res) => {
  try {
    const project = await db.projects.findUnique({ id: req.params.id });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if user has access to this project
    const isAdmin = hasPermission(req.user.permissions, Permissions.ADMIN);
    if (!isAdmin && project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get servers in this project
    const servers = await db.servers.findMany({
      where: { projectId: project.id },
      include: {
        node: true,
        unit: true,
        allocation: true
      }
    });
    
    res.json(servers);
  } catch (error: any) {
    console.error('Failed to fetch servers in project:', error);
    res.status(500).json({ error: 'Failed to fetch servers in project' });
  }
});

// Move a server to a different project
router.post('/:projectId/servers/:serverId', async (req: any, res) => {
  try {
    const { projectId, serverId } = req.params;
    
    const project = await db.projects.findUnique({ id: projectId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const server = await db.servers.findUnique({ where: { id: serverId } });
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    // Check if user has access to both the server and project
    const isAdmin = hasPermission(req.user.permissions, Permissions.ADMIN);
    if (!isAdmin) {
      if (project.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied to project' });
      }
      if (server.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied to server' });
      }
    }
    
    // Update the server's project
    const updatedServer = await db.servers.update(
      { id: serverId },
      { projectId }
    );
    
    res.json(updatedServer);
  } catch (error: any) {
    console.error('Failed to move server to project:', error);
    res.status(500).json({ error: 'Failed to move server to project' });
  }
});

export default router;