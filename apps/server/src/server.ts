import { env } from "@bcoz/config";
import { buildServer } from "./app.js";

const server = await buildServer();

try {
  await server.listen({ host: "0.0.0.0", port: env.port });
} catch (error: unknown) {
  server.log.error(error, "API server failed to start");
  process.exitCode = 1;
}
