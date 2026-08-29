# 01: Scaffold monorepo + podman-compose infra

**What to build:** A runnable foundation: `podman-compose up` brings up Postgres (ready for schema-per-service), RabbitMQ with the `micro-task` topic exchange, and one placeholder service with a health endpoint. The repo layout `services/{gateway,identity,task,notification}`, `frontend/`, and `infra/` is established, each service with its own Dockerfile and `package.json`. This is the prefactoring/foundation ticket everything else builds on.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `podman-compose up` starts Postgres + RabbitMQ + one health service with no manual steps
- [ ] RabbitMQ has the `micro-task` topic exchange declared
- [ ] Postgres is reachable and each service has its own schema namespace
- [ ] Repo layout `services/{gateway,identity,task,notification}`, `frontend/`, `infra/` exists with a per-service Dockerfile + `package.json`
