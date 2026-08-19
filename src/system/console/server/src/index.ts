import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import csrf from 'csurf';
import { expressjwt } from 'express-jwt';
import config from './lib/Config.js';
import { getFlypcRoot } from './lib/PathResolver.js';
import appsRouter from './routers/AppsRouter.js';
import filesRouter from './routers/FilesRouter.js';
import { createKonnectProxyRouter } from './routers/KonnectProxyRouter.js';
import { createKubeProxyRouter } from './routers/KubeProxyRouter.js';
import { initializeDatabase } from './db/index.js';
import { startNotificationCleanup } from './services/NotificationService.js';

const app = express();
app.set('trust proxy', 1);
const appConfig = config.getAll();
const port = appConfig.port || process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || 'flypc-jwt-secret';
const sessionSecret = process.env.SESSION_SECRET || 'flypc-session-secret';
const flypcRoot = getFlypcRoot();
const frontendDistPath = process.env.FLYPC_FE_DIST
  ? path.resolve(process.env.FLYPC_FE_DIST)
  : path.resolve(flypcRoot, 'dist/fe');
const frontendPublicPath = process.env.FLYPC_FE_PUBLIC
  ? path.resolve(process.env.FLYPC_FE_PUBLIC)
  : path.resolve(flypcRoot, 'src/system/console/client/web/flypc/public');
const wallpaperResourcesPaths = [
  path.join(frontendPublicPath, 'resources'),
  path.join(frontendDistPath, 'resources'),
];
const indexFilePath = path.join(frontendDistPath, 'index.html');
const currentFile = fileURLToPath(import.meta.url);
const shouldEnableCsrf = process.env.ENABLE_CSRF === 'true';
const csrfExcludedPrefixes = ['/user', '/settings', '/system', '/apps', '/files', '/auth/csrf-token', '/konnect', '/kube'];
const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const allowedCorsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const isAllowedCorsOrigin = (origin: string): boolean =>
  localhostOriginPattern.test(origin) || allowedCorsOrigins.includes(origin);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!origin || isAllowedCorsOrigin(origin)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(
  expressjwt({
    secret: jwtSecret,
    algorithms: ['HS256'],
    credentialsRequired: false,
    requestProperty: 'auth',
  })
);

if (shouldEnableCsrf) {
  const csrfMiddleware = csrf();

  app.use((req, res, next) => {
    const contentType = req.headers['content-type'] ?? '';
    const accept = req.headers.accept ?? '';
    const isJsonRequest = contentType.includes('application/json') || accept.includes('application/json');
    const isApiRoute = csrfExcludedPrefixes.some(
      (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)
    );
    const shouldSkipCsrf = isApiRoute || isJsonRequest;

    if (shouldSkipCsrf) {
      next();
      return;
    }

    csrfMiddleware(req, res, next);
  });
}

app.use(appsRouter);
app.use('/konnect', createKonnectProxyRouter());
app.use('/kube', createKubeProxyRouter());
app.use(filesRouter);
for (const resourcesPath of wallpaperResourcesPaths) {
  app.use('/resources', express.static(resourcesPath));
}
app.use(express.static(frontendDistPath));

app.get('/auth/csrf-token', (req, res) => {
  if (typeof req.csrfToken !== 'function') {
    return res.status(404).json({ error: 'CSRF protection is disabled (set ENABLE_CSRF=true to enable)' });
  }

  return res.json({ csrfToken: req.csrfToken() });
});

app.get('/', (_req, res) => {
  res.sendFile(indexFilePath);
});

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'UnauthorizedError'
  ) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'EBADCSRFTOKEN'
  ) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  return next(error);
});

const bootstrap = async (): Promise<void> => {
  await initializeDatabase();
  startNotificationCleanup();

  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);

    void import('./services/AppWarmStartService.js')
      .then(({ runKubernetesWarmStartOnBoot }) => runKubernetesWarmStartOnBoot())
      .catch((error) => {
        console.error('[warm-start]: Boot reconciliation failed', error);
      });
  });
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  bootstrap().catch((error) => {
    console.error('[server]: Failed to start', error);
    process.exit(1);
  });
}

export default app;
