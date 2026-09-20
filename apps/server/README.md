# API Server

Fastify hosts the modular-monolith REST API. The request flow is:

```text
router -> authentication/policy -> service -> repository -> database/external adapter
```

The initial health route proves the application shell. Sprint 1 and Sprint 2
add the registration, upload, and review vertical slices.
