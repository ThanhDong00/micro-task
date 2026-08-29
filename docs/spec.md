# Spec: Micro-Task — a team task manager to learn microservices + RabbitMQ + podman

## Problem Statement

I want to learn how microservices, a message broker (RabbitMQ), and container
orchestration (podman) fit together by building a real, small application
rather than reading about them. The application should be a task manager where
people form Teams, invite each other, and create Tasks — and where creating a
Task in a Team notifies the Team's other Members. The learning goal is the
architecture (service boundaries, async messaging, containers), not feature
breadth, so the feature set is deliberately minimal but exercises every target
technology.

## Solution

A microservice web app composed of an API Gateway plus three domain services
(Identity, Task, Notification), with RabbitMQ carrying the notification
events and podman-compose orchestrating the whole stack. A thin React frontend
talks only to the Gateway. Users self-register, form Teams, invite other Users
via an Invitation (pending → accepted), and create Tasks scoped to a Team.
When a Task is created, the Task Service publishes a `task.created` event; the
Notification Service consumes it and notifies every other Team Member, storing
an in-app Notification and logging to console.

## User Stories

1. As a new user, I want to register with an email and password, so that I can get an account in the system.
2. As a registered user, I want to log in, so that I receive a JWT I can use to act authenticated.
3. As a logged-in user, I want the Gateway to validate my JWT on every request, so that only authenticated actions succeed.
4. As a user, I want to create a Team, so that I have a group to share tasks with.
5. As a Team member, I want to invite another user to my Team, so that they can collaborate.
6. As a user, I want to receive an Invitation (state `pending`) when invited, so that I know I've been asked to join.
7. As an invited user, I want to accept an Invitation, so that I become a Member of the Team (`member.joined`).
8. As an invited user, I want to decline an Invitation, so that I am not added to the Team.
9. As a Team Member, I want to create a Task in my Team, so that work is tracked.
10. As a Task creator, I want the Gateway to verify I am a Member of the Team before the Task is created, so that only Members add Tasks.
11. As a Team Member (other than the creator), I want to receive a Notification when a Task is created in my Team, so that I know new work appeared.
12. As a user, I want to view my Notifications, so that I can see what happened in my Teams.
13. As the system, I want `task.created` events to carry `teamId`, `actorId`, `taskId`, `title`, and `createdAt`, so that consumers can render and order them.
14. As the system, I want `member.joined` / `member.left` / `member.invited` events, so that the Notification Service can maintain its team→members read model.
15. As the Notification Service, I want to keep my own `team → memberIds` table fed by membership events, so that I never call Identity synchronously.
16. As a developer, I want every service, RabbitMQ, and Postgres to come up with one `podman-compose up`, so that the whole system runs identically.
17. As a developer, I want each service to own its own database schema, so that the per-service data-ownership rule is visible.
18. As a developer, I want commands (register, login, create task, invite, accept) to be synchronous REST, and only notifications to be async events, so that the sync/async boundary is clear.
19. As a user, I want the API to use a topic exchange named `micro-task` with routing keys `task.created` / `member.*`, so that event routing is explicit and learnable.
20. As a user, I want a thin React frontend that logs in, lists my Teams, lets me invite Members, create Tasks, and shows Notifications, so that the backend is exercisable end to end.

## Implementation Decisions

- **Service decomposition (ADR-0001):** API Gateway + Identity Service + Task Service + Notification Service. Identity owns User, Team, Invitation, Membership. Task owns Task. Notification owns Notification and its derived team→members read model. RabbitMQ sits between Task/Identity (publishers) and Notification (consumer).
- **Auth (ADR-0004):** Simple JWT. Identity issues the token on login; the Gateway validates it and extracts `userId`. Passwords hashed with bcrypt. No roles, no refresh tokens (deferred).
- **Sync vs async (ADR-0003):** All writes are synchronous REST through the Gateway. The Gateway validates Team membership via a synchronous call to Identity before forwarding task creation. The queue is used only for the notification fan-out.
- **Notification read model (ADR-0002):** Notification Service maintains its own `team → memberIds` table from `member.joined` / `member.left` / `member.invited` events. On `task.created {teamId, actorId}`, it notifies every Member of the Team except `actorId`.
- **Event contract (ADR-0006):** Single topic exchange `micro-task`. Payloads:
  - `task.created`: `{ teamId, actorId, taskId, title, createdAt }`
  - `member.joined`: `{ teamId, userId, createdAt }`
  - `member.left` / `member.invited`: analogous shapes.
- **Infrastructure (ADR-0005):** `podman-compose.yaml` in `infra/`. Containers: `rabbitmq:3-management` (5672/15672), `postgres:16` (5432, one database, schema-per-service), and one container per service built from its own Dockerfile. Only the Gateway publishes a port (8080).
- **Stack:** Node.js + TypeScript + Express for all services; React + Vite frontend; Postgres with one schema per service.
- **Repository layout:** monorepo — `services/gateway`, `services/identity`, `services/task`, `services/notification`, `frontend/`, `infra/`. Each service has its own `package.json` and DB schema.
- **API contract (Gateway-exposed):**
  - Identity: `POST /register`, `POST /login → {token}`, `POST /teams`, `POST /teams/:id/invite {userId}`, `POST /invitations/:id/accept`, `GET /teams/:id/members` (used by Gateway for membership checks).
  - Task: `POST /teams/:id/tasks {title, description?}` → creates Task, emits `task.created`.
  - Notification: `GET /notifications?userId=` → list for the user.
- **Domain vocabulary (CONTEXT.md):** User, Team, Invitation (`pending`→`accepted`/`declined`), Membership, Task (belongs to exactly one Team), Notification (addressed to a Team's other Members).

## Testing Decisions

- **What makes a good test:** assert external behavior only — HTTP responses at the API boundary and the events/notifications produced — never internal implementation (which ORM, how a service stores data).
- **Primary seam (highest, one):** the running system through the API Gateway's HTTP surface, plus observing events on RabbitMQ. A good end-to-end test registers two Users, forms a Team, has User A invite and User B accept, has A create a Task, and asserts B receives a Notification while A does not.
- **Secondary seam:** each service's REST API in isolation (e.g. Identity invite/accept state machine; Task creation rejected when actor is not a Member).
- **Event-contract test:** publish a `task.created` / `member.joined` and assert the Notification Service's stored output matches the contract in ADR-0006.
- **Modules tested:** Identity (registration, login, invite/accept lifecycle, membership query), Task (creation + membership enforcement), Notification (event consumption, team→members read model, notification generation excluding actor).
- **Prior art:** none — greenfield repo; tests are net-new following the seams above.

## Out of Scope

- Real authorization: roles/owners, permission checks beyond "is a Member".
- Refresh tokens, token revocation, password reset.
- Email / push delivery of Notifications (console + in-app store only).
- Event sourcing, durable event log, saga/outbox patterns.
- Multi-tenancy, rate limiting, TLS, production hardening, CI/CD.
- Rich frontend (no editing/deleting tasks, no task statuses beyond creation, for v1).
- `task.updated` / `task.deleted` notifications (v1 triggers only on Task creation).
- Personal (team-less) Tasks.

## Further Notes

- The project is explicitly a learning exercise; explanatory comments and a
  step-by-step `podman-compose` walkthrough are in scope during implementation.
- ADRs `0001`–`0006` are the source of truth for the architectural decisions
  above; if implementation diverges, update the ADR rather than the prose here.
- Issue tracker: GitHub Issues (see `docs/agents/issue-tracker.md`). Triage label `ready-for-agent` applied on publish.
