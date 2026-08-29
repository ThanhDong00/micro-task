# All services run under podman-compose

The whole system — RabbitMQ, Postgres, and all four services — is brought up by a single `podman-compose.yaml` in `infra/`. Each service has its own Dockerfile; RabbitMQ uses `rabbitmq:3-management`, Postgres uses `postgres:16` (one database, schema-per-service). The API Gateway is the only published port (8080).

Chosen because the user wants to learn podman, and the microservice + queue lesson is clearest when every piece is containerized identically and orchestrated as one unit. Rejected alternative (run services natively, containerize only infra) would have skipped the orchestration lesson.
