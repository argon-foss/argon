import { Router } from 'express';
import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

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

      // Get the relative path from the base directory, remove extension
      let relativePath = relative(dir, fullPath).replace(/\.ts$/, '');
      // Ensure forward slashes for route paths
      relativePath = relativePath.split(sep).join('/');

      const router = require(fullPath).default;
      mainRouter.use('/api/' + relativePath, router);
    }
  };

  loadRoutersRecursively(dir);
  return mainRouter;
};