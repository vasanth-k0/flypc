import express from 'express';
import path from 'node:path';
import config from './lib/Config.js';
import appsRouter from './routers/AppsRouter.js';
import systemRouter from './routers/SystemRouter.js';

const app = express();
const appConfig = config.getAll();
const port = appConfig.port || process.env.PORT || 3000;
const frontendDistPath = path.resolve(process.cwd(), '../../../../dist/fe');
const frontendPublicPath = path.resolve(process.cwd(), '../client/web/flypc/public');
const indexFilePath = path.join(frontendDistPath, 'index.html');

app.use('/system', systemRouter);
app.use('/apps', appsRouter);
app.use('/resources', express.static(path.join(frontendDistPath, 'resources')));
app.use('/resources', express.static(path.join(frontendPublicPath, 'resources')));
app.use(express.static(frontendDistPath));

app.get('/', (_req, res) => {
  res.sendFile(indexFilePath);
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
