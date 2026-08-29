# Micro-Task

A task-manager web app built to learn microservices, RabbitMQ, and podman. Users form teams, invite each other, and a task created in a team notifies the team's other members.

## Language

**User**:
A person with an account; can belong to teams and create tasks.
_Avoid_: account, member (when referring to the person)

**Team**:
A named group of users that shares tasks; the unit of notification scoping.
_Avoid_: group, project

**Invitation**:
A request by one user to add another user to a team; states `pending` → `accepted` / `declined`.
_Avoid_: invite (as a noun)

**Membership**:
A user's confirmed association with a team, established after an invitation is accepted.
_Avoid_: team-user

**Task**:
A unit of work belonging to exactly one team; created by a member.
_Avoid_: todo, item

**Notification**:
A message generated when a task is created in a team, addressed to the team's other members.
_Avoid_: alert, message
