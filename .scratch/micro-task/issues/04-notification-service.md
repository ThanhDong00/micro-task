# 04: Notification Service (event consumer + read model + store)

**What to build:** The Notification Service consumes `member.joined` / `member.left` / `member.invited` to maintain its own `team → memberIds` read model (ADR-0002), and consumes `task.created` to store a Notification for every Team Member except the actor, exposed via `GET /notifications?userId=`. It never calls Identity synchronously.

**Blocked by:** 01 Scaffold monorepo + podman-compose infra, 02 Identity Service (User, Team, Invitation, Membership) + JWT (member events), 03 Task Service (Team-scoped Task + publish `task.created`).

**Status:** ready-for-agent

- [ ] Notification Service consumes `member.joined` / `member.left` / `member.invited` and maintains `team → memberIds`
- [ ] On `task.created`, it stores a Notification for every Team Member except `actorId`
- [ ] `GET /notifications?userId=` returns that User's Notifications
- [ ] No synchronous call from Notification to Identity
