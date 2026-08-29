# 02: Identity Service (User, Team, Invitation, Membership) + JWT

**What to build:** A User can register (password bcrypt-hashed) and log in to receive a JWT. An authenticated User creates a Team. A Team Member invites another User, producing an Invitation in state `pending`; the invited User accepts, creating a Membership and emitting a `member.joined` event. The Gateway can query `GET /teams/:id/members`. Exposed through the Gateway with JWT validation (ADR-0004).

**Blocked by:** 01 Scaffold monorepo + podman-compose infra.

**Status:** ready-for-agent

- [ ] User can register (password bcrypt-hashed) and login, receiving a JWT
- [ ] Gateway validates the JWT and rejects unauthenticated requests
- [ ] An authenticated User can create a Team
- [ ] A Team Member can invite another User → Invitation state `pending`
- [ ] The invited User can accept → Membership created and `member.joined` event published
- [ ] Gateway can query `GET /teams/:id/members`
