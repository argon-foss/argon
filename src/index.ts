/*
 * Argon version v1.0.0-dev (Revenant)
 * (c) 2017 - 2025 ether
 */

import express from 'express';
import { join, resolve } from 'path';
import { existsSync, statSync } from 'fs';
import { loadRouters } from './utils/routes_loader';
import { PORT } from './config';
import chalk from 'chalk';
import gradient from 'gradient-string';

const app = express();
const __dirname = process.cwd();

// Theme colors
const themeColors = {
  primary: '#a2b3ff',
  secondary: '#7c86ff',
  success: '#a2ffb3',
  info: '#a2d8ff',
  warn: '#ffd6a2',
  error: '#ffa2a2',
  neutral: '#e2e2e2',
  text: '#4a4a4a'
};

app.use(express.json());

// API routes
const routersDir = join(__dirname, 'src', 'routers');
app.use(loadRouters(routersDir));

// System API route
app.get('/api/system', (req, res) => {
  res.json({
    name: process.env.PANEL_NAME || 'Argon',
    version: '1.0.0',
    'powered-by': 'Argon'
  });
});

// Create a gradient for the ASCII art
const asciiPath = join(__dirname, '/', '_ascii.txt');
if (existsSync(asciiPath)) {
  const ascii = require('fs').readFileSync(asciiPath, 'utf-8');
  
  // Create a gradient from themeColors.primary to themeColors.secondary
  const asciiGradient = gradient('FFFFFF', themeColors.text);
  console.log(asciiGradient(ascii));
  
  console.log(); // Add a blank line for better spacing
} else {
  console.log(chalk.hex(themeColors.error)('┌─────────────────────────────────────────┐'));
  console.log(chalk.hex(themeColors.error)('│ ASCII art not found at ' + asciiPath.padEnd(34) + '│'));
  console.log(chalk.hex(themeColors.error)('│ Please ensure the file exists and is readable. │'));
  console.log(chalk.hex(themeColors.error)('└─────────────────────────────────────────┘'));
}

// Validate and serve frontend
const frontendPath = resolve(__dirname, './app/dist');
const indexPath = join(frontendPath, 'index.html');

// Check if frontend exists and has the required structure
const frontendExists = existsSync(frontendPath) && statSync(frontendPath).isDirectory();
const indexExists = existsSync(indexPath) && statSync(indexPath).isFile();

if (frontendExists && indexExists) {
  console.log(chalk.hex(themeColors.success)('✓ Frontend build detected and ready to serve'));
  
  // Serve static assets
  app.use(express.static(frontendPath));
  
  // Serve index.html for client-side routing
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return;
    res.sendFile(indexPath);
  });
} else {
  console.log(chalk.hex(themeColors.warn)('⚠ Frontend build not detected at ' + frontendPath));
  console.log(chalk.hex(themeColors.warn)('  Only API routes will be available'));
  
  // Fallback for non-API routes when frontend is missing
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
          <p><i>Argon 1.0.0-dev (Revenant)</i></p>
        </body>
      </html>
    `);
  });
}

// Start server
app.listen(PORT, () => {
  // Create a box for startup message
  const serverUrl = `http://localhost:${PORT}`;
  const boxWidth = Math.max(serverUrl.length + 24, 45);
  
  // Modern server start display
  console.log();
  console.log(chalk.hex(themeColors.neutral)('╭' + '─'.repeat(boxWidth - 2) + '╮'));
  
  // Content with white/gray text for the "server started" message
  console.log(chalk.hex(themeColors.neutral)('│') + 
              chalk.white(` Argon 1.0.0-dev (Revenant) `.padEnd(boxWidth - 2)) + 
              chalk.hex(themeColors.neutral)('│'));
              
  console.log(chalk.hex(themeColors.neutral)('│') + ' '.repeat(boxWidth - 2) + chalk.hex(themeColors.neutral)('│'));
  
  console.log(chalk.hex(themeColors.neutral)('│') + 
              gradient(themeColors.text, themeColors.text)(` Server: ${serverUrl} `.padEnd(boxWidth - 2)) + 
              chalk.hex(themeColors.neutral)('│'));
              
  console.log(chalk.hex(themeColors.neutral)('│') + 
              chalk.hex(themeColors.text)(` API routes available at /api/* `.padEnd(boxWidth - 2)) + 
              chalk.hex(themeColors.neutral)('│'));
  
  // Bottom border
  console.log(chalk.hex(themeColors.neutral)('╰' + '─'.repeat(boxWidth - 2) + '╯'));
  console.log();
});