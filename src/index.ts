/*
 * Argon version v1.0.0-dev (Revenant)
 * (c) 2017 - 2025 ether
 */

import express from 'express';
import { join } from 'path';
import { loadRouters } from './utils/routes_loader';
import { PORT } from './config';
import chalk from 'chalk';

const app = express();

app.use(express.json());

const routersDir = join(__dirname, 'routers');
app.use(loadRouters(routersDir));

app.listen(PORT, () => {
  console.log(chalk.italic('Tell all my competition that I love \'em but I brought \'em back just to kill \'em again'));
  console.log(`Argon v1.0.0-dev (Revenant) - running on port ${PORT}`);
});