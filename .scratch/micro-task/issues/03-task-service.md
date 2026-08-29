# 03: Task Service (Team-scoped Task + publish `task.created`)

**What to build:** An authenticated Team Member creates a Task in a Team. The Gateway validates Membership via a synchronous call to Identity before forwarding (ADR-0003); non-members are rejected. On success the Task Service publishes `task.created {teamId, actorId, taskId, title, createdAt}` to the `micro-task` exchange (ADR-0006).

**Blocked by:** 01 Scaffold monorepo + podman-compose infra, 02 Identity Service (User, Team, Invitation, Membership) + JWT.

**Status:** ready-for-agent

- [ ] An authenticated Team Member can create a Task in a Team
- [ ] The Gateway validates Membership via a sync call to Identity before forwarding; non-members are rejected
- [ ] On create, `task.created {teamId, actorId, taskId, title, createdAt}` is published to `micro-task`
