-- Schema-per-service (ADR-0001): each service owns its own schema namespace.
-- Runs once on first Postgres init via /docker-entrypoint-initdb.d.
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS task;
CREATE SCHEMA IF NOT EXISTS notification;
CREATE SCHEMA IF NOT EXISTS gateway;
