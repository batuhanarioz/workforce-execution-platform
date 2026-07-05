import { Inject, Injectable } from "@nestjs/common";
import { DataStateService } from "../state/data-state.service";
import { ApprovalAction, type AuthenticatedUser, type DailyFactCreateInput } from "@wfp/shared";
import { validateDailyFactInput } from "../workflow-rules";
import { AuditLogsService, type AuditContext } from "../audit-logs/audit-logs.service";

@Injectable()
export class DailyFactsService {
  constructor(
    @Inject(DataStateService) private readonly state: DataStateService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService
  ) {}

  async list() {
    return { success: true, data: await this.state.listDailyFacts() };
  }

  async getById(id: string) {
    return { success: true, data: (await this.state.getFact(id)) ?? null };
  }

  async getByPlanId(planId: string) {
    return { success: true, data: (await this.state.getFactByPlanId(planId)) ?? null };
  }

  async draft(
    planId: string,
    input: Partial<DailyFactCreateInput>,
    submittedByUserId: string,
    auditContext?: AuditContext
  ) {
    const data = await this.state.saveFactDraft(planId, input, submittedByUserId);
    void this.auditLogsService.record({
      actor: auditContext?.actor ?? { id: submittedByUserId, role: "HEAD_OF_MASTER" },
      entityType: "daily-fact",
      entityId: data.id,
      action: "FACT_DRAFT_SAVED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? null,
      newValue: data,
    }).catch(() => undefined);
    return { success: true, data };
  }

  async submit(
    planId: string,
    input: DailyFactCreateInput,
    submittedByUserId: string,
    auditContext?: AuditContext
  ) {
    this.validateFact(input);
    const data = await this.state.submitFact(planId, input, submittedByUserId);
    void this.auditLogsService.record({
      actor: auditContext?.actor ?? { id: submittedByUserId, role: "HEAD_OF_MASTER" },
      entityType: "daily-fact",
      entityId: data.id,
      action: "FACT_SUBMITTED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? null,
      newValue: data,
    }).catch(() => undefined);
    return { success: true, data };
  }

  async update(id: string, patch: Partial<DailyFactCreateInput>, auditContext?: AuditContext) {
    const before = await this.state.getFact(id);
    const data = await this.state.updateFact(id, patch);
    void this.auditLogsService.record({
      actor: auditContext?.actor ?? { id: "dev-user-1", role: "HEAD_OF_MASTER" },
      entityType: "daily-fact",
      entityId: id,
      action: "FACT_UPDATED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? null,
      oldValue: before,
      newValue: data,
    }).catch(() => undefined);
    return { success: true, data };
  }

  async history(id: string) {
    return { success: true, data: await this.state.listApprovalHistoryByFactId(id) };
  }

  async approveHeadMaster(id: string, user: AuthenticatedUser, comment?: string, auditContext?: AuditContext) {
    const before = await this.state.getFact(id);
    const data = await this.state.approveFact(id, user, ApprovalAction.APPROVED, comment);
    void this.auditLogsService.record({
      actor: user,
      entityType: "approval",
      entityId: id,
      action: "FACT_APPROVED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? null,
      oldValue: before,
      newValue: data,
    }).catch(() => undefined);
    return { success: true, data };
  }

  async approveSiteChief(id: string, user: AuthenticatedUser, comment?: string, auditContext?: AuditContext) {
    const before = await this.state.getFact(id);
    const data = await this.state.approveFact(id, user, ApprovalAction.APPROVED, comment);
    void this.auditLogsService.record({
      actor: user,
      entityType: "approval",
      entityId: id,
      action: "FACT_APPROVED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? null,
      oldValue: before,
      newValue: data,
    }).catch(() => undefined);
    return { success: true, data };
  }

  async approveProjectManager(id: string, user: AuthenticatedUser, comment?: string, auditContext?: AuditContext) {
    const before = await this.state.getFact(id);
    const data = await this.state.approveFact(id, user, ApprovalAction.APPROVED, comment);
    void this.auditLogsService.record({
      actor: user,
      entityType: "approval",
      entityId: id,
      action: "FACT_APPROVED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? null,
      oldValue: before,
      newValue: data,
    }).catch(() => undefined);
    return { success: true, data };
  }

  async returnForRevision(id: string, user: AuthenticatedUser, comment: string, auditContext?: AuditContext) {
    const before = await this.state.getFact(id);
    const data = await this.state.returnFact(id, user, comment);
    void this.auditLogsService.record({
      actor: user,
      entityType: "approval",
      entityId: id,
      action: "FACT_RETURNED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? null,
      oldValue: before,
      newValue: data,
    }).catch(() => undefined);
    return { success: true, data };
  }

  async reject(id: string, user: AuthenticatedUser, comment: string, auditContext?: AuditContext) {
    const before = await this.state.getFact(id);
    const data = await this.state.rejectFact(id, user, comment);
    void this.auditLogsService.record({
      actor: user,
      entityType: "approval",
      entityId: id,
      action: "FACT_REJECTED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? null,
      oldValue: before,
      newValue: data,
    }).catch(() => undefined);
    return { success: true, data };
  }

  private validateFact(input: DailyFactCreateInput) {
    validateDailyFactInput(input);
  }
}
