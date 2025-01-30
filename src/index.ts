/*
 * Argon version v0.0.0-dev (Revenant)
 * (c) 2017 - 2025 Matt James
 */

import express from 'express';
import { join } from 'path';
import { loadRouters } from './utils/routes_loader';
import { PORT } from './config';

const app = express();

app.use(express.json());

const routersDir = join(__dirname, 'routers');
app.use(loadRouters(routersDir));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});