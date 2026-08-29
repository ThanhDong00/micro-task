# 05: React frontend (auth → teams → invite → task → notifications)

**What to build:** A User logs in, sees their Teams, invites another User, accepts invites, creates a Task in a Team, and views Notifications — exercising the full system through the Gateway (ADR-0001). A thin SPA; no task editing/deletion in v1.

**Blocked by:** 02 Identity Service (User, Team, Invitation, Membership) + JWT, 03 Task Service (Team-scoped Task + publish `task.created`), 04 Notification Service (event consumer + read model + store).

**Status:** ready-for-agent

- [ ] User can log in via the UI and see their Teams
- [ ] The UI can invite a User and accept invites
- [ ] The UI can create a Task in a Team
- [ ] The UI displays the User's Notifications
