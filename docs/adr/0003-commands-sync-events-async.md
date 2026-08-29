# Commands are synchronous REST; notifications are async events

All write operations — register, login, create task, invite member, accept invitation — are synchronous REST calls routed through the API Gateway. The only thing that travels on RabbitMQ is the notification fan-out (`task.created`, `member.*`).

The Gateway validates team membership with a synchronous call to Identity before forwarding task creation, so invalid writes are rejected at the boundary rather than discovered downstream. This keeps the queue purely for the event-driven lesson and avoids distributed transactions across services.
