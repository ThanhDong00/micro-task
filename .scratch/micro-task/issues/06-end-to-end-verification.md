# 06: End-to-end verification + podman walkthrough

**What to build:** The end-to-end seam from the spec verified: register two Users → form a Team → invite/accept → create a Task → Member B is notified, creator A is not. Plus a written `podman-compose up` walkthrough with the explanatory notes requested during planning.

**Blocked by:** 02 Identity Service (User, Team, Invitation, Membership) + JWT, 03 Task Service (Team-scoped Task + publish `task.created`), 04 Notification Service (event consumer + read model + store), 05 React frontend (auth → teams → invite → task → notifications).

**Status:** ready-for-agent

- [ ] E2E verified: register two Users, form Team, invite/accept, create Task → B notified, A not
- [ ] A written `podman-compose up` walkthrough with explanatory notes exists
