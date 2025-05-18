/*
                              
   ____ __________ _____  ____ 
  / __ `/ ___/ __ `/ __ \/ __ \
 / /_/ / /  / /_/ / /_/ / / / /
 \__,_/_/   \__, /\____/_/ /_/ 
           /____/              
          
 Argon 0.8.0 (Matisse)
 © 2025 Argon Foundation (https://argon.software) - All rights reserved

*/

import express from 'express';
import { join, resolve } from 'path';
import { existsSync, statSync } from 'fs';
import { loadRouters } from './utils/routes_loader';
import { PORT } from './config';
import chalk from 'chalk';

const app = express();
const __dirname = process.cwd();

app.use(express.json());

const routersDir = join(__dirname, 'src', 'routers');
app.use(loadRouters(routersDir));

app.get('/api/system', (req, res) => {
  res.json({
    name: process.env.PANEL_NAME || 'Argon',
    version: '1.0.0'
  });
});

const frontendPath = resolve(__dirname, '../frontend/dist');
const indexPath = join(frontendPath, 'index.html');

const frontendExists = existsSync(frontendPath) && statSync(frontendPath).isDirectory();
const indexExists = existsSync(indexPath) && statSync(indexPath).isFile();

if (frontendExists && indexExists) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return;
    res.sendFile(indexPath);
  });
  console.log(chalk.blueBright('frontend' + chalk.white(' build found at') + chalk.gray(` ${frontendPath.trim()}`)));
} else {
  console.log(chalk.yellow('warning: frontend build not found, serving \'build not found\' page'));
  
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return;
    res.status(404).send(`
      <html>
        <head>
          <title>Argon - Frontend Not Found</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: #fff;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
              line-height: 1.6;
            }
            h1 { color: black; }
            .api-path { background: #f0f0f0; padding: 0.2rem 0.4rem; border-radius: 3px; }
            .info { }
          </style>
        </head>
        <body>
          <h1>Frontend Build Not Found</h1>
          <p class="info">The frontend build directory was not found at ${frontendPath}</p>
          <p>Please ensure you've built the frontend application and the files are in the correct location.</p>
          <p>API routes are still available at <span class="api-path">/api/*</span></p>
          <p>For more information, please refer to the <a href="https://docs.argon.software">Argon documentation</a>.</p>
          <p>If you need help, please join our <a href="https://discord.gg/qckQBHG8e3">Discord server</a>.</p>
          <p><i>Argon 0.8.x (Matisse)</i></p>
        </body>
      </html>
    `);
  });
}

// Start server
app.listen(PORT, () => {
  console.log(chalk.red('https server') + ' listening on ' + chalk.cyan(`0.0.0.0:${PORT} `) + chalk.gray('(argon@0.8.0)'));
});