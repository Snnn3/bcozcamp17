# Participant API boundary

Participant features call the shared API client from this boundary. They must
not import database, Prisma, authentication secrets, or private storage code.
