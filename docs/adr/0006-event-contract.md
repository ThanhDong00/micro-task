# Event contract: topic exchange with typed payloads

RabbitMQ uses a single topic exchange named `micro-task`. Routing keys: `task.created`, `member.joined`, `member.left`, `member.invited`. Payloads:

```jsonc
// task.created
{ "teamId": "t1", "actorId": "u1", "taskId": "k1", "title": "Buy milk", "createdAt": "2025-08-29T10:00:00Z" }
// member.joined
{ "teamId": "t1", "userId": "u2", "createdAt": "2025-08-29T10:05:00Z" }
// member.left / member.invited analogous
```

`createdAt` is included so consumers can order and display events. This contract is the integration boundary between services; changing a routing key or field breaks consumers, so it is fixed here rather than left implicit in code.
