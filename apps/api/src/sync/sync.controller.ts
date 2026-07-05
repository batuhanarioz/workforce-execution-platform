import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DataStateService } from "../state/data-state.service";
import { DailyFactStatus, type SyncRecordInput } from "@wfp/shared";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

@Controller("sync")
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(
    @Inject(DataStateService) private readonly state: DataStateService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService
  ) {}

  @Get("pull")
  async pull() {
    const masterData = await this.state.getMasterData();
    const dailyPlans = await this.state.listDailyPlans();
    const dailyFacts = await this.state.listDailyFacts();

    return {
      success: true,
      data: {
        assignedDailyPlans: dailyPlans,
        masterData,
        workerTypes: masterData.workerTypes,
        zzzDetails: masterData.zzzDetails,
        existingDailyFactDrafts: dailyFacts.filter((fact) => fact.status === DailyFactStatus.DRAFT),
        lastSyncTimestamp: new Date().toISOString(),
        serverVersions: dailyPlans.map((plan) => ({
          id: plan.id,
          version: plan.version,
        })),
      },
    };
  }

  @Post("push")
  async push(
    @Body()
    body: {
      deviceId: string;
      records: SyncRecordInput[];
    },
    @Req() request: { headers?: Record<string, string> }
  ) {
    const results = await this.state.handleSyncPush(body.records ?? []);

    void this.auditLogsService.record({
      actor: {
        id: String(request.headers?.["x-user-id"] ?? "dev-user-1"),
        fullName: String(request.headers?.["x-user-name"] ?? "Dev User"),
        email: String(request.headers?.["x-user-email"] ?? "dev@example.com"),
        role: String(request.headers?.["x-user-role"] ?? "HEAD_OF_MASTER"),
      },
      entityType: "sync",
      entityId: body.deviceId,
      action: "SYNC_PUSHED",
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
      newValue: {
        recordCount: body.records?.length ?? 0,
        results,
      },
    }).catch(() => undefined);

    return {
      success: true,
      data: {
        results,
      },
    };
  }
}
