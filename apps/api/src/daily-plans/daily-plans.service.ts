import { Inject, Injectable } from "@nestjs/common";
import { DataStateService } from "../state/data-state.service";
import {
  DailyPlanAssignInput,
  DailyPlanCreateInput,
} from "@wfp/shared";
import { AuditLogsService, type AuditContext } from "../audit-logs/audit-logs.service";

@Injectable()
export class DailyPlansService {
  constructor(
    @Inject(DataStateService) private readonly state: DataStateService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService
  ) {}

  async list() {
    return {
      success: true,
      data: await this.state.listDailyPlans(),
    };
  }

  async getById(id: string) {
    return {
      success: true,
      data: (await this.state.getDailyPlan(id)) ?? null,
    };
  }

  async create(input: DailyPlanCreateInput, createdByUserId: string, auditContext?: AuditContext) {
    const data = await this.state.createDailyPlan(input, createdByUserId);
    void this.auditLogsService.record({
      actor:
        auditContext?.actor ??
        {
          id: createdByUserId,
          role: "TECH_OFFICE",
        },
      entityType: "daily-plan",
      entityId: data.id,
      action: "PLAN_CREATED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? input.locationId ?? null,
      newValue: data,
    }).catch(() => undefined);

    return { success: true, data };
  }

  async update(id: string, patch: Partial<DailyPlanCreateInput> & { note?: string }, auditContext?: AuditContext) {
    const before = await this.state.getDailyPlan(id);
    const data = await this.state.updateDailyPlan(id, patch);
    void this.auditLogsService.record({
      actor: auditContext?.actor ?? { id: "dev-user-1", role: "TECH_OFFICE" },
      entityType: "daily-plan",
      entityId: id,
      action: "PLAN_UPDATED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? before?.locationId ?? null,
      oldValue: before,
      newValue: data,
    }).catch(() => undefined);

    return { success: true, data };
  }

  async assign(id: string, input: DailyPlanAssignInput, auditContext?: AuditContext) {
    const before = await this.state.getDailyPlan(id);
    const data = await this.state.assignDailyPlan(id, input);
    void this.auditLogsService.record({
      actor: auditContext?.actor ?? { id: "dev-user-1", role: "TECH_OFFICE" },
      entityType: "daily-plan",
      entityId: id,
      action: "PLAN_ASSIGNED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? before?.locationId ?? null,
      oldValue: before,
      newValue: data,
    }).catch(() => undefined);

    return { success: true, data };
  }

  async cancel(id: string, auditContext?: AuditContext) {
    const before = await this.state.getDailyPlan(id);
    const data = await this.state.cancelDailyPlan(id);
    void this.auditLogsService.record({
      actor: auditContext?.actor ?? { id: "dev-user-1", role: "TECH_OFFICE" },
      entityType: "daily-plan",
      entityId: id,
      action: "PLAN_CANCELLED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? before?.locationId ?? null,
      oldValue: before,
      newValue: data,
    }).catch(() => undefined);

    return { success: true, data };
  }

  async startWork(id: string, auditContext?: AuditContext) {
    const before = await this.state.getDailyPlan(id);
    const data = await this.state.markPlanInProgress(id);
    void this.auditLogsService.record({
      actor: auditContext?.actor ?? { id: "dev-user-1", role: "HEAD_OF_MASTER" },
      entityType: "daily-plan",
      entityId: id,
      action: "PLAN_STARTED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? before?.locationId ?? null,
      oldValue: before,
      newValue: data,
    }).catch(() => undefined);

    return { success: true, data };
  }
}
