import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { randomUUID } from "node:crypto";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((req: any, res: any, next: any) => {
    const requestId = String(req.headers["x-request-id"] ?? randomUUID());
    req.headers["x-request-id"] = requestId;
    res.setHeader("x-request-id", requestId);

    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      console.log(
        JSON.stringify({
          level: "info",
          type: "http",
          requestId,
          method: req.method,
          path: req.originalUrl ?? req.url,
          statusCode: res.statusCode,
          durationMs: Number(elapsedMs.toFixed(2)),
          source: String(req.headers["x-client-platform"] ?? "api"),
          userId: String(req.headers["x-user-id"] ?? ""),
          role: String(req.headers["x-user-role"] ?? ""),
        })
      );
    });

    next();
  });
  app.getHttpAdapter().get("/", (_req, res) => {
    res.json({
      success: true,
      data: {
        status: "ok",
        service: "workforce-execution-platform-api",
        docs: "/api/health",
      },
    });
  });
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix("api");
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
