import { Controller, Get, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  health() {
    return {
      success: true,
      data: {
        status: "ok",
        service: "workforce-execution-platform-api",
      },
    };
  }

  @Get("ready")
  async ready() {
    await this.prisma.user.count();

    return {
      success: true,
      data: {
        status: "ready",
        database: "ok",
        service: "workforce-execution-platform-api",
      },
    };
  }

  @Get("summary")
  async summary() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [recentAudits, failedLogins, accessDenied, lastAudit] = await Promise.all([
      this.prisma.auditLog.count({ where: { createdAt: { gte: lastHour } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: lastDay }, action: "LOGIN_FAILED" } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: lastDay }, action: "ACCESS_DENIED" } }),
      this.prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, action: true } }),
    ]);

    const unhealthySignals = failedLogins + accessDenied;
    const status = unhealthySignals > 10 ? "degraded" : "ok";

    return {
      success: true,
      data: {
        status,
        database: "ok",
        recentAudits,
        failedLogins,
        accessDenied,
        lastAuditAt: lastAudit?.createdAt?.toISOString() ?? null,
        lastAuditAction: lastAudit?.action ?? null,
        checkedAt: now.toISOString(),
      },
    };
  }
}
