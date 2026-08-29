# Notification Service keeps its own team→members read model

When a task is created, the Notification Service must notify the team's other members without calling Identity synchronously. Identity publishes `member.joined` / `member.left` / `member.invited` events; Notification maintains its own `team → memberIds` table from them. A `task.created {teamId, actorId}` event then lets it notify everyone in the team except the actor, fully asynchronously.

Considered alternatives: (1) embed the member list directly in `task.created` — simpler, but goes stale as membership changes; (2) Notification calls Identity over HTTP — breaks the async decoupling that is the whole point of the exercise. Both rejected.
