import express from 'express';
import amqp from 'amqplib';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import http from 'http';

const PORT = Number(process.env.PORT ?? 8080);
const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@rabbitmq:5672';
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://microtask:microtask@postgres:5432/microtask';

// Topic exchange shared by all event publishers/consumers (ADR-0006).
const EXCHANGE = 'micro-task';

const JWT_SECRET = process.env.JWT_SECRET ?? 'microtask-dev-secret';

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!token) return res.status(401).json({ error: 'unauthenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

function proxyToIdentity(req: express.Request, res: express.Response) {
  const opts: http.RequestOptions = {
    hostname: 'identity',
    port: 3001,
    path: req.originalUrl || req.url,
    method: req.method,
    headers: { ...req.headers, host: 'identity:3001' } as any,
  };
  const proxyReq = http.request(opts, (proxyRes) => {
    res.status(proxyRes.statusCode || 200);
    for (const [k, v] of Object.entries(proxyRes.headers)) {
      if (v !== undefined) res.setHeader(k, Array.isArray(v) ? v[0] : v);
    }
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => res.status(502).json({ error: 'identity unreachable' }));
  req.pipe(proxyReq);
}

const app = express();
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Identity endpoints exposed through Gateway with JWT validation (ADR-0004)
app.post('/register', proxyToIdentity);
app.post('/login', proxyToIdentity);
app.post('/teams', authMiddleware, proxyToIdentity);
app.post('/teams/:id/invite', authMiddleware, proxyToIdentity);
app.post('/invitations/:id/accept', authMiddleware, proxyToIdentity);
app.get('/teams/:id/members', authMiddleware, proxyToIdentity);

// Listen first so /health is served even while brokers are still starting.
app.listen(PORT, () => console.log(`gateway listening on :${PORT}`));

// Fire-and-forget infra wiring. Non-fatal: the health server stays up and
// retries until Postgres/RabbitMQ are reachable (see ADR-0005).
void initInfra();

async function initInfra(): Promise<void> {
  await retry('rabbitmq', declareExchange);
  await retry('postgres', checkPostgres);
}

async function declareExchange(): Promise<void> {
  const conn = await amqp.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  console.log(`declared topic exchange "${EXCHANGE}"`);
  await ch.close();
  await conn.close();
}

async function checkPostgres(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const result = await pool.query('SELECT 1');
  console.log('postgres reachable:', result.rows[0]);
  await pool.end();
}

// Retries forever (2s backoff) so the health server stays up until the broker
// it depends on is reachable (see ADR-0005: infra comes up with one command).
async function retry(label: string, fn: () => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      console.warn(`${label} not ready (attempt ${attempt}), retrying in 2s...`);
      await sleep(2000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
