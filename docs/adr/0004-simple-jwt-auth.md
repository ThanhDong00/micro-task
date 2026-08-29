# Simple JWT auth, issued by Identity and validated by the Gateway

Identity Service owns user credentials and issues a simple JWT on login; the API Gateway validates the JWT on every request and extracts the acting `userId`.

We chose JWT over server-side sessions because it lets the stateless Gateway authorize without a shared session store, which fits the per-service-owns-its-data model. Passwords are hashed with bcrypt. Roles, refresh tokens, and richer authz are deferred — this is a learning project, not production auth.
