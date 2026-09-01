import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import amqp from 'amqplib';

const PORT = Number(process.env.PORT ?? 3001);
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://microtask:microtask@postgres:5432/microtask';
const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@rabbitmq:5672';
const JWT_SECRET = process.env.JWT_SECRET ?? 'microtask-dev-secret';
const EXCHANGE = 'micro-task';

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: DATABASE_URL });

// Minimal DB init — create schema tables if missing (lazy, one-time)
async function initDb() {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS identity`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS identity.users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS identity.teams (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      creator_id INTEGER REFERENCES identity.users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS identity.invitations (
      id SERIAL PRIMARY KEY,
      team_id INTEGER REFERENCES identity.teams(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES identity.users(id),
      state VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS identity.memberships (
      id SERIAL PRIMARY KEY,
      team_id INTEGER REFERENCES identity.teams(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES identity.users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, user_id)
    )
  `);
}

async function getChannel() {
  const conn = await amqp.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  return { conn, ch };
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

// Helper to publish events (fire-and-forget; don't block on broker failure)
async function publishEvent(routingKey: string, payload: object) {
  try {
    const { conn, ch } = await getChannel();
    ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify({ ...payload, createdAt: new Date().toISOString() })));
    await ch.close();
    await conn.close();
  } catch (e) {
    console.warn('event publish failed:', e);
  }
}

app.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query('INSERT INTO identity.users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email, hash]);
    res.status(201).json({ id: result.rows[0].id, email: result.rows[0].email });
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'email exists' });
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const result = await pool.query('SELECT id, password_hash FROM identity.users WHERE email = $1', [email]);
  if (result.rows.length === 0) return res.status(401).json({ error: 'invalid credentials' });
  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

app.post('/teams', authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const teamRes = await pool.query('INSERT INTO identity.teams (name, creator_id) VALUES ($1, $2) RETURNING id, name, creator_id', [name, userId]);
  const team = teamRes.rows[0];
  // Auto-add creator as member and emit event
  await pool.query('INSERT INTO identity.memberships (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [team.id, userId]);
  publishEvent('member.joined', { teamId: team.id, userId });
  res.status(201).json({ id: team.id, name: team.name, creatorId: team.creator_id });
});

app.post('/teams/:id/invite', authMiddleware, async (req, res) => {
  const callerId = (req as any).userId;
  const teamId = Number(req.params.id);
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  // Verify caller is a member of team
  const memberCheck = await pool.query('SELECT 1 FROM identity.memberships WHERE team_id = $1 AND user_id = $2', [teamId, callerId]);
  if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'not a member' });
  const inviteRes = await pool.query('INSERT INTO identity.invitations (team_id, user_id, state) VALUES ($1, $2, $3) RETURNING id, team_id, user_id, state', [teamId, userId, 'pending']);
  publishEvent('member.invited', { teamId, userId });
  res.status(201).json(inviteRes.rows[0]);
});

app.post('/invitations/:id/accept', authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const inviteId = Number(req.params.id);
  const inviteRes = await pool.query('SELECT * FROM identity.invitations WHERE id = $1', [inviteId]);
  if (inviteRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
  const inv = inviteRes.rows[0];
  if (inv.user_id !== userId) return res.status(403).json({ error: 'not your invitation' });
  if (inv.state !== 'pending') return res.status(400).json({ error: 'already processed' });
  await pool.query('UPDATE identity.invitations SET state = $1 WHERE id = $2', ['accepted', inviteId]);
  await pool.query('INSERT INTO identity.memberships (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [inv.team_id, userId]);
  publishEvent('member.joined', { teamId: inv.team_id, userId });
  res.json({ id: inviteId, state: 'accepted', teamId: inv.team_id, userId });
});

app.get('/teams/:id/members', authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const teamId = Number(req.params.id);
  const memberCheck = await pool.query('SELECT 1 FROM identity.memberships WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'not a member' });
  const result = await pool.query(`
    SELECT u.id, u.email FROM identity.memberships m
    JOIN identity.users u ON m.user_id = u.id
    WHERE m.team_id = $1
  `, [teamId]);
  res.json(result.rows);
});

app.listen(PORT, async () => {
  await initDb();
  console.log(`identity listening on :${PORT}`);
});
