import { Router } from 'express';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export const loadRouters = (dir: string): Router => {
  const mainRouter = Router();
  
  const loadRoutersRecursively = (currentPath: string) => {
    const items = readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = join(currentPath, item);
      
      if (statSync(fullPath).isDirectory()) {
        loadRoutersRecursively(fullPath);
        continue;
      }
      
      if (!item.endsWith('.ts') || item === 'index.ts') continue;
      
      const relativePath = fullPath.slice(dir.length).replace('.ts', '');
      const routePath = relativePath.replace(/\\/g, '/');
      
      const router = require(fullPath).default;
      mainRouter.use('/api' + routePath, router);
    }
  };

  loadRoutersRecursively(dir);
  return mainRouter;
};