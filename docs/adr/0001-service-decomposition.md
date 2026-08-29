# Four services behind an API Gateway

The backend is split into an API Gateway plus three domain services — Identity (users, teams, invitations, memberships), Task (team-scoped tasks), and Notification (team-scoped alerts) — with RabbitMQ carrying events from Task/Identity to Notification.

We chose this over a single monolith or a two-service split because the explicit goal is to learn microservice boundaries and async messaging: each service owns one aggregate and one database schema, and the Notification service is reachable only via events, never synchronous calls. Cost: more moving parts and cross-service consistency to manage.
