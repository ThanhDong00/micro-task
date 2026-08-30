import express from 'express';
import amqp from 'amqplib';
import { Pool } from 'pg';

const PORT = Number(process.env.PORT ?? 8080);
const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@rabbitmq:5672';
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://microtask:microtask@postgres:5432/microtask';

// Topic exchange shared by all event publishers/consumers (ADR-0006).
const EXCHANGE = 'micro-task';

const app = express();
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

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
