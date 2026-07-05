import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import {
  Prisma,
  UserRole as PrismaUserRole,
  DailyPlanStatus as PrismaDailyPlanStatus,
  DailyFactStatus as PrismaDailyFactStatus,
  ActualWorkStatus as PrismaActualWorkStatus,
  ApprovalAction as PrismaApprovalAction,
} from "@prisma/client";
import {
  AccessScope,
  ActualWorkStatus,
  ApprovalAction,
  DailyFactStatus,
  DailyPlanStatus,
  UserRole,
  type ApprovalHistoryRecord,
  type AuthenticatedUser,
  type CrewCreateInput,
  type CrewRecord,
  type DailyFactCreateInput,
  type DailyFactRecord,
  type DailyPlanAssignInput,
  type DailyPlanCreateInput,
  type DailyPlanRecord,
  type MasterDataSnapshot,
  type SyncRecordInput,
  type SyncResultItem,
  type WbsImportPayload,
  type WorkerAssignmentCreateInput,
  type WorkerAssignmentRecord,
} from "@wfp/shared";
import { assertApprovalAllowed as assertApprovalAllowedRule } from "../workflow-rules";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

function nowIso(): string {
  return new Date().toISOString();
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) {
    return nowIso();
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function fallbackPayload(): WbsImportPayload {
  return {
    source: "fallback",
    locations: [
      { id: "loc-30AAA", code: "30AAA", name: "Location 30AAA", region: "A", isActive: true },
      { id: "loc-30BBB", code: "30BBB", name: "Location 30BBB", region: "A", isActive: true },
      { id: "loc-30CCC", code: "30CCC", name: "Location 30CCC", region: "B", isActive: true },
    ],
    projects: [
      { id: "prj-1", code: "PRJ-001", name: "Project 001", locationId: "loc-30AAA", isActive: true },
    ],
    typeOfWorks: [
      { id: "tow-1", code: "TOW-01", name: "General Works", sortOrder: 1, isActive: true },
      { id: "tow-2", code: "TOW-02", name: "Reinforcement Works", sortOrder: 2, isActive: true },
    ],
    subTypeOfWorks: [
      { id: "stow-1", code: "STOW-01", name: "Formwork", typeOfWorkId: "tow-1", sortOrder: 1, isActive: true },
      { id: "stow-2", code: "STOW-23", name: "Rebar Installation", typeOfWorkId: "tow-2", sortOrder: 2, isActive: true },
    ],
    subSubTypeOfWorks: [
      {
        id: "sstow-1",
        code: "SSTOW-27",
        name: "Formwork Area",
        subTypeOfWorkId: "stow-1",
        unit: "m2",
        typeCode: "AAA0104012026",
        zzzCode: "60114402",
        isActive: true,
      },
      {
        id: "sstow-2",
        code: "SSTOW-77",
        name: "Rebar Fixing",
        subTypeOfWorkId: "stow-2",
        unit: "t",
        typeCode: "AAA0201042026",
        zzzCode: "60101508",
        isActive: true,
      },
    ],
    workerTypes: [
      { id: "worker-formworker", name: "Formworker", isActive: true },
      { id: "worker-rebar", name: "Rebar Fixer", isActive: true },
      { id: "worker-labor", name: "General Labor", isActive: true },
    ],
    zzzDetails: [
      { id: "zzz-60114402", code: "60114402", name: "Formwork detail", isActive: true },
      { id: "zzz-60101508", code: "60101508", name: "Rebar detail", isActive: true },
    ],
  };
}

// Prisma/Postgres-backed data access layer for all domain entities.
// Only `idempotencyResults` below is an in-memory (non-persisted) cache.
@Injectable()
export class DataStateService implements OnModuleInit {
  private idempotencyResults = new Map<string, SyncResultItem>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const roleCount = await this.prisma.role.count();
    const locationCount = await this.prisma.location.count();
    const projectCount = await this.prisma.project.count();
    const typeOfWorkCount = await this.prisma.typeOfWork.count();
    const workerTypeCount = await this.prisma.workerType.count();
    const zzzDetailCount = await this.prisma.zzzDetail.count();
    const userCount = await this.prisma.user.count();
    if (
      roleCount === 0 ||
      locationCount === 0 ||
      projectCount === 0 ||
      typeOfWorkCount === 0 ||
      workerTypeCount === 0 ||
      zzzDetailCount === 0 ||
      userCount === 0
    ) {
      await this.bootstrapSeed();
    }
  }

  async bootstrapSeed() {
    const importPathCandidates = [
      join(process.cwd(), "prisma", "wbs-import.json"),
      join(process.cwd(), "apps", "api", "prisma", "wbs-import.json"),
    ];
    const payloadPath = importPathCandidates.find((candidate) => existsSync(candidate));
    const raw = payloadPath ? readFileSync(payloadPath, "utf8") : null;
    const payload = raw ? (JSON.parse(raw) as WbsImportPayload) : fallbackPayload();
    await this.importWbs(payload);

    const demoUsers = payload.demoUsers
      ? payload.demoUsers
      : [
          { fullName: "Technical Office", email: "techoffice@icn.com", role: PrismaUserRole.TECH_OFFICE, locationCodes: ["30AAA", "30BBB"] },
          { fullName: "Head Of Master", email: "hom@icn.com", role: PrismaUserRole.HEAD_OF_MASTER, locationCodes: ["30AAA"] },
          { fullName: "Site Chief", email: "sitechief@icn.com", role: PrismaUserRole.SITE_CHIEF, locationCodes: ["30AAA", "30BBB"] },
          { fullName: "Project Manager", email: "pm@icn.com", role: PrismaUserRole.PROJECT_MANAGER, locationCodes: ["30AAA"] },
          { fullName: "Admin", email: "admin@icn.com", role: PrismaUserRole.ADMIN, locationCodes: ["30AAA"] },
        ];

    for (const roleName of Object.values(PrismaUserRole)) {
      await this.prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });
    }

    for (const user of demoUsers) {
      const role = await this.prisma.role.findUnique({ where: { name: user.role as PrismaUserRole } });
      if (!role) {
        continue;
      }

      const created = await this.prisma.user.upsert({
        where: { email: user.email },
        update: { fullName: user.fullName, roleId: role.id },
        create: {
          fullName: user.fullName,
          email: user.email,
          passwordHash: "seeded-password",
          roleId: role.id,
        },
      });

      for (const locationCode of user.locationCodes) {
        const location = await this.prisma.location.findUnique({ where: { code: locationCode } });
        if (!location) {
          continue;
        }

        await this.prisma.userLocationAssignment.upsert({
          where: {
            userId_locationId: {
              userId: created.id,
              locationId: location.id,
            },
          },
          update: {
            assignmentType: AccessScope.LOCATION,
            isPrimary: true,
          },
          create: {
            userId: created.id,
            locationId: location.id,
            assignmentType: AccessScope.LOCATION,
            isPrimary: true,
          },
        });
      }
    }
  }

  async getMasterData(): Promise<MasterDataSnapshot> {
    return this.buildMasterDataSnapshot("prisma");
  }

  async importWbs(payload: WbsImportPayload): Promise<MasterDataSnapshot> {
    const importedAt = nowIso();
    const locations = payload.locations ?? [];
    const projects = payload.projects ?? [];
    const typeOfWorks = payload.typeOfWorks ?? [];
    const subTypeOfWorks = payload.subTypeOfWorks ?? [];
    const subSubTypeOfWorks = payload.subSubTypeOfWorks ?? [];
    const workerTypes = payload.workerTypes ?? [];
    const zzzDetails = payload.zzzDetails ?? [];

    await this.prisma.$transaction(async (tx) => {
      for (const location of locations) {
        await tx.location.upsert({
          where: { code: location.code },
          update: {
            name: location.name,
            region: location.region ?? null,
            isActive: location.isActive ?? true,
          },
          create: {
            code: location.code,
            name: location.name,
            region: location.region ?? null,
            isActive: location.isActive ?? true,
          },
        });
      }

      for (const tow of typeOfWorks) {
        await tx.typeOfWork.upsert({
          where: { code: tow.code },
          update: {
            name: tow.name,
            sortOrder: tow.sortOrder,
            isActive: tow.isActive ?? true,
          },
          create: {
            code: tow.code,
            name: tow.name,
            sortOrder: tow.sortOrder,
            isActive: tow.isActive ?? true,
          },
        });
      }

      for (const stow of subTypeOfWorks) {
        const parentCode = (stow as unknown as { typeOfWorkCode?: string }).typeOfWorkCode ?? stow.typeOfWorkId;
        const parent = await tx.typeOfWork.findUnique({ where: { code: parentCode } });
        if (!parent) {
          continue;
        }
        await tx.subTypeOfWork.upsert({
          where: { code: stow.code },
          update: {
            name: stow.name,
            typeOfWorkId: parent.id,
            sortOrder: stow.sortOrder,
            isActive: stow.isActive ?? true,
          },
          create: {
            code: stow.code,
            name: stow.name,
            typeOfWorkId: parent.id,
            sortOrder: stow.sortOrder,
            isActive: stow.isActive ?? true,
          },
        });
      }

      for (const sstow of subSubTypeOfWorks) {
        const parentCode = (sstow as unknown as { subTypeOfWorkCode?: string }).subTypeOfWorkCode ?? sstow.subTypeOfWorkId;
        const parent = await tx.subTypeOfWork.findUnique({ where: { code: parentCode } });
        if (!parent) {
          continue;
        }
        await tx.subSubTypeOfWork.upsert({
          where: { code: sstow.code },
          update: {
            name: sstow.name,
            subTypeOfWorkId: parent.id,
            unit: sstow.unit,
            typeCode: sstow.typeCode,
            zzzCode: sstow.zzzCode ?? null,
            isActive: sstow.isActive ?? true,
          },
          create: {
            code: sstow.code,
            name: sstow.name,
            subTypeOfWorkId: parent.id,
            unit: sstow.unit,
            typeCode: sstow.typeCode,
            zzzCode: sstow.zzzCode ?? null,
            isActive: sstow.isActive ?? true,
          },
        });
      }

      for (const workerType of workerTypes) {
        await tx.workerType.upsert({
          where: { name: workerType.name },
          update: { isActive: workerType.isActive ?? true },
          create: { name: workerType.name, isActive: workerType.isActive ?? true },
        });
      }

      for (const zzz of zzzDetails) {
        await tx.zzzDetail.upsert({
          where: { code: zzz.code },
          update: { name: zzz.name, isActive: zzz.isActive ?? true },
          create: { code: zzz.code, name: zzz.name, isActive: zzz.isActive ?? true },
        });
      }

      for (const project of projects) {
        const locationCode = (project as unknown as { locationCode?: string }).locationCode;
        const location = locationCode
          ? await tx.location.findUnique({ where: { code: locationCode } })
          : await tx.location.findUnique({ where: { id: project.locationId } });
        if (!location) {
          continue;
        }
        await tx.project.upsert({
          where: { code: project.code },
          update: {
            name: project.name,
            locationId: location.id,
            isActive: project.isActive ?? true,
          },
          create: {
            code: project.code,
            name: project.name,
            locationId: location.id,
            isActive: project.isActive ?? true,
          },
        });
      }
    });

    return this.buildMasterDataSnapshot(payload.source ?? "wbs-import", importedAt);
  }

  async listDailyPlans(): Promise<DailyPlanRecord[]> {
    const rows = await this.prisma.dailyPlan.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.mapDailyPlan(row));
  }

  async getDailyPlan(id: string): Promise<DailyPlanRecord | undefined> {
    const row = await this.prisma.dailyPlan.findUnique({ where: { id } });
    return row ? this.mapDailyPlan(row) : undefined;
  }

  async createDailyPlan(input: DailyPlanCreateInput, createdByUserId: string): Promise<DailyPlanRecord> {
    const row = await this.prisma.dailyPlan.create({
      data: {
        planDate: new Date(input.planDate),
        locationId: input.locationId,
        projectId: input.projectId,
        typeOfWorkId: input.typeOfWorkId,
        subTypeOfWorkId: input.subTypeOfWorkId,
        subSubTypeOfWorkId: input.subSubTypeOfWorkId,
        unit: input.unit,
        plannedQuantity: new Prisma.Decimal(input.plannedQuantity),
        plannedManDay: new Prisma.Decimal(input.plannedManDay),
        note: input.note ?? null,
        createdByUserId,
        status: PrismaDailyPlanStatus.DRAFT,
        version: 1,
      },
    });
    return this.mapDailyPlan(row);
  }

  async updateDailyPlan(id: string, patch: Partial<DailyPlanCreateInput> & { note?: string }): Promise<DailyPlanRecord> {
    const current = await this.prisma.dailyPlan.findUnique({ where: { id } });
    if (!current) {
      throw new Error("Daily plan not found");
    }

    const data: Prisma.DailyPlanUncheckedUpdateInput = {
      version: current.version + 1,
      updatedAt: new Date(),
    };

    if (patch.planDate !== undefined) {
      data.planDate = new Date(patch.planDate);
    }
    if (patch.locationId !== undefined) data.locationId = patch.locationId;
    if (patch.projectId !== undefined) data.projectId = patch.projectId;
    if (patch.typeOfWorkId !== undefined) data.typeOfWorkId = patch.typeOfWorkId;
    if (patch.subTypeOfWorkId !== undefined) data.subTypeOfWorkId = patch.subTypeOfWorkId;
    if (patch.subSubTypeOfWorkId !== undefined) data.subSubTypeOfWorkId = patch.subSubTypeOfWorkId;
    if (patch.unit !== undefined) data.unit = patch.unit;
    if (patch.plannedQuantity !== undefined) data.plannedQuantity = new Prisma.Decimal(patch.plannedQuantity);
    if (patch.plannedManDay !== undefined) data.plannedManDay = new Prisma.Decimal(patch.plannedManDay);
    if (patch.note !== undefined) data.note = patch.note;

    const row = await this.prisma.dailyPlan.update({
      where: { id },
      data,
    });
    return this.mapDailyPlan(row);
  }

  async assignDailyPlan(id: string, input: DailyPlanAssignInput): Promise<DailyPlanRecord> {
    const row = await this.prisma.dailyPlan.update({
      where: { id },
      data: {
        assignedHeadOfMasterId: input.assignedHeadOfMasterId,
        status: PrismaDailyPlanStatus.ASSIGNED,
        version: { increment: 1 },
      },
    });
    return this.mapDailyPlan(row);
  }

  cancelDailyPlan(id: string): Promise<DailyPlanRecord> {
    return this.mutatePlanStatus(id, PrismaDailyPlanStatus.CANCELLED);
  }

  markPlanInProgress(id: string): Promise<DailyPlanRecord> {
    return this.mutatePlanStatus(id, PrismaDailyPlanStatus.IN_PROGRESS);
  }

  async getFact(id: string): Promise<DailyFactRecord | undefined> {
    const row = await this.prisma.dailyFact.findUnique({ where: { id } });
    return row ? this.mapDailyFact(row) : undefined;
  }

  async getFactByPlanId(planId: string): Promise<DailyFactRecord | undefined> {
    const row = await this.prisma.dailyFact.findUnique({ where: { dailyPlanId: planId } });
    return row ? this.mapDailyFact(row) : undefined;
  }

  async submitFact(planId: string, input: DailyFactCreateInput, submittedByUserId: string): Promise<DailyFactRecord> {
    const plan = await this.prisma.dailyPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new Error("Daily plan not found");
    }

    const existing = await this.prisma.dailyFact.findUnique({ where: { dailyPlanId: planId } });
    const baseData = {
      id: input.id ?? existing?.id ?? randomUUID(),
      dailyPlanId: planId,
      factQuantity: new Prisma.Decimal(input.factQuantity),
      factManDay: new Prisma.Decimal(input.factManDay),
      overtime: new Prisma.Decimal(input.overtime),
      actualStatus: input.actualStatus as PrismaActualWorkStatus,
      comment: input.comment ?? null,
      zzzDetailId: input.zzzDetailId ?? null,
      submittedByUserId,
      status: PrismaDailyFactStatus.SUBMITTED,
      submittedAt: new Date(),
    } satisfies Prisma.DailyFactUncheckedCreateInput | Prisma.DailyFactUpdateInput;

    const row = existing
      ? await this.prisma.dailyFact.update({
          where: { id: existing.id },
          data: {
            ...baseData,
            version: { increment: 1 },
          },
        })
      : await this.prisma.dailyFact.create({
          data: {
            ...baseData,
            version: 1,
          },
        });

    await this.mutatePlanStatus(planId, PrismaDailyPlanStatus.FACT_SUBMITTED);
    return this.mapDailyFact(row);
  }

  async saveFactDraft(planId: string, input: Partial<DailyFactCreateInput>, submittedByUserId: string): Promise<DailyFactRecord> {
    const existing = await this.prisma.dailyFact.findUnique({ where: { dailyPlanId: planId } });
    const draftData: Prisma.DailyFactUncheckedCreateInput | Prisma.DailyFactUpdateInput = {
      id: input.id ?? existing?.id ?? randomUUID(),
      dailyPlanId: planId,
      submittedByUserId,
      status: PrismaDailyFactStatus.DRAFT,
      actualStatus: (input.actualStatus ?? ActualWorkStatus.NOT_STARTED) as PrismaActualWorkStatus,
      factQuantity: new Prisma.Decimal(input.factQuantity ?? 0),
      factManDay: new Prisma.Decimal(input.factManDay ?? 0),
      overtime: new Prisma.Decimal(input.overtime ?? 0),
      comment: input.comment ?? null,
      zzzDetailId: input.zzzDetailId ?? null,
    };

    const row = existing
      ? await this.prisma.dailyFact.update({
          where: { id: existing.id },
          data: {
            ...draftData,
            version: { increment: 1 },
          },
        })
      : await this.prisma.dailyFact.create({
          data: {
            ...draftData,
            version: 1,
          },
        });

    return this.mapDailyFact(row);
  }

  async updateFact(id: string, patch: Partial<DailyFactCreateInput>): Promise<DailyFactRecord> {
    const current = await this.prisma.dailyFact.findUnique({ where: { id } });
    if (!current) {
      throw new Error("Daily fact not found");
    }

    const data: Prisma.DailyFactUncheckedUpdateInput = {
      version: { increment: 1 },
    };

    if (patch.factQuantity !== undefined) data.factQuantity = new Prisma.Decimal(patch.factQuantity);
    if (patch.factManDay !== undefined) data.factManDay = new Prisma.Decimal(patch.factManDay);
    if (patch.overtime !== undefined) data.overtime = new Prisma.Decimal(patch.overtime);
    if (patch.actualStatus !== undefined) data.actualStatus = patch.actualStatus as PrismaActualWorkStatus;
    if (patch.comment !== undefined) data.comment = patch.comment;
    if (patch.zzzDetailId !== undefined) data.zzzDetailId = patch.zzzDetailId;

    const row = await this.prisma.dailyFact.update({
      where: { id },
      data,
    });
    return this.mapDailyFact(row);
  }

  async addApprovalHistory(entry: Omit<ApprovalHistoryRecord, "id" | "createdAt">): Promise<ApprovalHistoryRecord> {
    const row = await this.prisma.approvalHistory.create({
      data: {
        dailyFactId: entry.dailyFactId,
        approverUserId: entry.approverUserId,
        approverRole: entry.approverRole as PrismaUserRole,
        action: entry.action as PrismaApprovalAction,
        comment: entry.comment ?? null,
      },
    });
    return this.mapApprovalHistory(row);
  }

  async listApprovalHistoryByFactId(dailyFactId: string): Promise<ApprovalHistoryRecord[]> {
    const rows = await this.prisma.approvalHistory.findMany({
      where: { dailyFactId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.mapApprovalHistory(row));
  }

  async approveFact(
    dailyFactId: string,
    actor: AuthenticatedUser,
    action: ApprovalAction,
    comment?: string
  ): Promise<DailyFactRecord> {
    const current = await this.prisma.dailyFact.findUnique({ where: { id: dailyFactId } });
    if (!current) {
      throw new Error("Daily fact not found");
    }

    this.assertApprovalAllowed(current.status as DailyFactStatus, actor.role);

    const result = await this.prisma.$transaction(async (tx) => {
      let nextStatus: PrismaDailyFactStatus = PrismaDailyFactStatus.APPROVED_BY_PROJECT_MANAGER;
      let nextPlanStatus: PrismaDailyPlanStatus = PrismaDailyPlanStatus.REPORTED;

      if (actor.role === UserRole.HEAD_OF_MASTER) {
        nextStatus = PrismaDailyFactStatus.APPROVED_BY_HEAD_OF_MASTER;
        nextPlanStatus = PrismaDailyPlanStatus.APPROVED_BY_HEAD_OF_MASTER;
      } else if (actor.role === UserRole.SITE_CHIEF) {
        nextStatus = PrismaDailyFactStatus.APPROVED_BY_SITE_CHIEF;
        nextPlanStatus = PrismaDailyPlanStatus.APPROVED_BY_SITE_CHIEF;
      }

      const row = await tx.dailyFact.update({
        where: { id: dailyFactId },
        data: {
          status: nextStatus,
          version: { increment: 1 },
        },
      });

      await tx.dailyPlan.update({
        where: { id: current.dailyPlanId },
        data: {
          status: nextPlanStatus,
          version: { increment: 1 },
        },
      });

      await tx.approvalHistory.create({
        data: {
          dailyFactId,
          approverUserId: actor.id,
          approverRole: actor.role as PrismaUserRole,
          action: action as PrismaApprovalAction,
          comment: comment ?? null,
        },
      });

      return row;
    });

    return this.mapDailyFact(result);
  }

  async returnFact(dailyFactId: string, actor: AuthenticatedUser, comment: string): Promise<DailyFactRecord> {
    const current = await this.prisma.dailyFact.findUnique({ where: { id: dailyFactId } });
    if (!current) {
      throw new Error("Daily fact not found");
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.dailyFact.update({
        where: { id: dailyFactId },
        data: {
          status: PrismaDailyFactStatus.RETURNED_FOR_REVISION,
          version: { increment: 1 },
        },
      });

      await tx.dailyPlan.update({
        where: { id: current.dailyPlanId },
        data: {
          status: PrismaDailyPlanStatus.RETURNED_FOR_REVISION,
          version: { increment: 1 },
        },
      });

      await tx.approvalHistory.create({
        data: {
          dailyFactId,
          approverUserId: actor.id,
          approverRole: actor.role,
          action: PrismaApprovalAction.RETURNED,
          comment,
        },
      });

      return updated;
    });

    return this.mapDailyFact(row);
  }

  async rejectFact(dailyFactId: string, actor: AuthenticatedUser, comment: string): Promise<DailyFactRecord> {
    const current = await this.prisma.dailyFact.findUnique({ where: { id: dailyFactId } });
    if (!current) {
      throw new Error("Daily fact not found");
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.dailyFact.update({
        where: { id: dailyFactId },
        data: {
          status: PrismaDailyFactStatus.REJECTED,
          version: { increment: 1 },
        },
      });

      await tx.dailyPlan.update({
        where: { id: current.dailyPlanId },
        data: {
          status: PrismaDailyPlanStatus.REJECTED,
          version: { increment: 1 },
        },
      });

      await tx.approvalHistory.create({
        data: {
          dailyFactId,
          approverUserId: actor.id,
          approverRole: actor.role,
          action: PrismaApprovalAction.REJECTED,
          comment,
        },
      });

      return updated;
    });

    return this.mapDailyFact(row);
  }

  async createCrew(input: CrewCreateInput): Promise<CrewRecord> {
    const row = await this.prisma.crew.create({
      data: {
        id: input.id ?? randomUUID(),
        name: input.name,
        locationId: input.locationId,
        headOfMasterId: input.headOfMasterId,
        workerTypeId: input.workerTypeId,
        isActive: true,
      },
    });
    return this.mapCrew(row);
  }

  async createWorkerAssignment(input: WorkerAssignmentCreateInput, assignedByUserId: string): Promise<WorkerAssignmentRecord> {
    const row = await this.prisma.workerAssignment.create({
      data: {
        id: input.id ?? randomUUID(),
        dailyPlanId: input.dailyPlanId,
        crewId: input.crewId,
        workerTypeId: input.workerTypeId,
        workerCount: input.workerCount,
        assignedByUserId,
      },
    });
    return this.mapWorkerAssignment(row);
  }

  async listCrews(): Promise<CrewRecord[]> {
    const rows = await this.prisma.crew.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((row) => this.mapCrew(row));
  }

  async listWorkerAssignments(): Promise<WorkerAssignmentRecord[]> {
    const rows = await this.prisma.workerAssignment.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((row) => this.mapWorkerAssignment(row));
  }

  async listDailyFacts(): Promise<DailyFactRecord[]> {
    const rows = await this.prisma.dailyFact.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((row) => this.mapDailyFact(row));
  }

  async handleSyncPush(records: SyncRecordInput[]): Promise<SyncResultItem[]> {
    const results: SyncResultItem[] = [];

    for (const record of records) {
      if (this.idempotencyResults.has(record.idempotencyKey)) {
        const previous = this.idempotencyResults.get(record.idempotencyKey);
        results.push({
          localId: record.localId,
          status: "DUPLICATE_IGNORED",
          serverId: previous?.serverId,
          error: previous?.error,
          message: previous?.message,
          serverVersion: previous?.serverVersion,
        });
        continue;
      }

      try {
        const result = await this.applySyncRecord(record);
        this.idempotencyResults.set(record.idempotencyKey, result);
        results.push(result);
      } catch (error) {
        const result: SyncResultItem = {
          localId: record.localId,
          status: "FAILED",
          error: "SYNC_FAILED",
          message: error instanceof Error ? error.message : "Unknown sync error",
        };
        this.idempotencyResults.set(record.idempotencyKey, result);
        results.push(result);
      }
    }

    return results;
  }

  private async applySyncRecord(record: SyncRecordInput): Promise<SyncResultItem> {
    if (record.entityType === "CREW" && record.operation === "CREATE") {
      const payload = record.payload as Partial<CrewCreateInput>;
      if (!payload.name || !payload.locationId || !payload.headOfMasterId || !payload.workerTypeId) {
        throw new Error("Crew payload is incomplete.");
      }

      const saved = await this.createCrew({
        id: payload.id,
        name: payload.name,
        locationId: payload.locationId,
        headOfMasterId: payload.headOfMasterId,
        workerTypeId: payload.workerTypeId,
      });

      return {
        localId: record.localId,
        status: "SYNCED",
        serverId: saved.id,
      };
    }

    if (record.entityType === "WORKER_ASSIGNMENT" && record.operation === "CREATE") {
      const payload = record.payload as Partial<WorkerAssignmentCreateInput>;
      if (!payload.dailyPlanId || !payload.crewId || !payload.workerTypeId || typeof payload.workerCount !== "number") {
        throw new Error("Worker assignment payload is incomplete.");
      }

      const saved = await this.createWorkerAssignment(
        {
          id: payload.id,
          dailyPlanId: payload.dailyPlanId,
          crewId: payload.crewId,
          workerTypeId: payload.workerTypeId,
          workerCount: payload.workerCount,
        },
        "dev-user-1",
      );

      return {
        localId: record.localId,
        status: "SYNCED",
        serverId: saved.id,
      };
    }

    if (record.entityType === "DAILY_FACT" && record.operation === "CREATE") {
      const payload = record.payload as Partial<DailyFactCreateInput> & { dailyPlanId?: string };
      if (!payload.dailyPlanId) {
        throw new Error("dailyPlanId is required.");
      }

      const plan = await this.prisma.dailyPlan.findUnique({ where: { id: payload.dailyPlanId } });
      if (!plan) {
        return {
          localId: record.localId,
          status: "CONFLICT",
          error: "SYNC_CONFLICT",
          message: "Daily plan does not exist on server.",
        };
      }

      if (record.baseVersion && plan.version !== record.baseVersion) {
        return {
          localId: record.localId,
          status: "CONFLICT",
          error: "SYNC_CONFLICT",
          message: "Daily plan version changed while offline.",
          serverVersion: plan.version,
        };
      }

      const saved = await this.submitFact(
        payload.dailyPlanId,
        {
          id: payload.id,
          dailyPlanId: payload.dailyPlanId,
          factQuantity: payload.factQuantity ?? 0,
          factManDay: payload.factManDay ?? 0,
          overtime: payload.overtime ?? 0,
          actualStatus: payload.actualStatus ?? ActualWorkStatus.COMPLETED,
          comment: payload.comment,
          zzzDetailId: payload.zzzDetailId,
        },
        "dev-user-1"
      );
      return {
        localId: record.localId,
        status: "SYNCED",
        serverId: saved.id,
      };
    }

    return {
      localId: record.localId,
      status: "FAILED",
      error: "UNSUPPORTED_OPERATION",
      message: `Unsupported sync entity ${record.entityType} ${record.operation}.`,
    };
  }

  private async mutatePlanStatus(id: string, status: PrismaDailyPlanStatus): Promise<DailyPlanRecord> {
    const row = await this.prisma.dailyPlan.update({
      where: { id },
      data: {
        status,
        version: { increment: 1 },
      },
    });
    return this.mapDailyPlan(row);
  }

  private async buildMasterDataSnapshot(source: string, importedAt?: string): Promise<MasterDataSnapshot> {
    const [locations, projects, typeOfWorks, subTypeOfWorks, subSubTypeOfWorks, workerTypes, zzzDetails] = await Promise.all([
      this.prisma.location.findMany({ orderBy: { code: "asc" } }),
      this.prisma.project.findMany({ orderBy: { code: "asc" } }),
      this.prisma.typeOfWork.findMany({ orderBy: { sortOrder: "asc" } }),
      this.prisma.subTypeOfWork.findMany({ orderBy: { sortOrder: "asc" } }),
      this.prisma.subSubTypeOfWork.findMany({ orderBy: { code: "asc" } }),
      this.prisma.workerType.findMany({ orderBy: { name: "asc" } }),
      this.prisma.zzzDetail.findMany({ orderBy: { code: "asc" } }),
    ]);
    const timestamps: Date[] = [
      ...locations.map((item) => item.updatedAt),
      ...projects.map((item) => item.updatedAt),
      ...typeOfWorks.map((item) => item.updatedAt),
      ...subTypeOfWorks.map((item) => item.updatedAt),
      ...subSubTypeOfWorks.map((item) => item.updatedAt),
      ...workerTypes.map((item) => item.updatedAt),
      ...zzzDetails.map((item) => item.updatedAt),
    ];
    const latestUpdatedAt = timestamps.reduce<Date | undefined>((latest, current) => {
      if (!latest || current > latest) {
        return current;
      }
      return latest;
    }, undefined);

    return {
      source,
      importedAt: importedAt ?? latestUpdatedAt?.toISOString() ?? nowIso(),
      locations: locations.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        region: row.region ?? undefined,
        isActive: row.isActive,
      })),
      projects: projects.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        locationId: row.locationId,
        isActive: row.isActive,
      })),
      typeOfWorks: typeOfWorks.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      })),
      subTypeOfWorks: subTypeOfWorks.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        typeOfWorkId: row.typeOfWorkId,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      })),
      subSubTypeOfWorks: subSubTypeOfWorks.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        subTypeOfWorkId: row.subTypeOfWorkId,
        unit: row.unit,
        typeCode: row.typeCode,
        zzzCode: row.zzzCode ?? undefined,
        isActive: row.isActive,
      })),
      workerTypes: workerTypes.map((row) => ({
        id: row.id,
        name: row.name,
        isActive: row.isActive,
      })),
      zzzDetails: zzzDetails.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        isActive: row.isActive,
      })),
    };
  }

  private mapDailyPlan(row: {
    id: string;
    planDate: Date;
    locationId: string;
    projectId: string;
    typeOfWorkId: string;
    subTypeOfWorkId: string;
    subSubTypeOfWorkId: string;
    unit: string;
    plannedQuantity: Prisma.Decimal;
    plannedManDay: Prisma.Decimal;
    assignedHeadOfMasterId: string | null;
    createdByUserId: string;
    status: PrismaDailyPlanStatus;
    note: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): DailyPlanRecord {
    return {
      id: row.id,
      planDate: toIso(row.planDate),
      locationId: row.locationId,
      projectId: row.projectId,
      typeOfWorkId: row.typeOfWorkId,
      subTypeOfWorkId: row.subTypeOfWorkId,
      subSubTypeOfWorkId: row.subSubTypeOfWorkId,
      unit: row.unit,
      plannedQuantity: toNumber(row.plannedQuantity),
      plannedManDay: toNumber(row.plannedManDay),
      assignedHeadOfMasterId: row.assignedHeadOfMasterId ?? undefined,
      createdByUserId: row.createdByUserId,
      status: row.status as DailyPlanStatus,
      note: row.note ?? undefined,
      version: row.version,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private mapDailyFact(row: {
    id: string;
    dailyPlanId: string;
    factQuantity: Prisma.Decimal;
    factManDay: Prisma.Decimal;
    overtime: Prisma.Decimal;
    actualStatus: PrismaActualWorkStatus;
    comment: string | null;
    zzzDetailId: string | null;
    submittedByUserId: string;
    status: PrismaDailyFactStatus;
    submittedAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): DailyFactRecord {
    return {
      id: row.id,
      dailyPlanId: row.dailyPlanId,
      factQuantity: toNumber(row.factQuantity),
      factManDay: toNumber(row.factManDay),
      overtime: toNumber(row.overtime),
      actualStatus: row.actualStatus as ActualWorkStatus,
      comment: row.comment ?? undefined,
      zzzDetailId: row.zzzDetailId ?? undefined,
      submittedByUserId: row.submittedByUserId,
      status: row.status as DailyFactStatus,
      submittedAt: row.submittedAt ? toIso(row.submittedAt) : undefined,
      version: row.version,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private mapApprovalHistory(row: {
    id: string;
    dailyFactId: string;
    approverUserId: string;
    approverRole: PrismaUserRole;
    action: PrismaApprovalAction;
    comment: string | null;
    createdAt: Date;
  }): ApprovalHistoryRecord {
    return {
      id: row.id,
      dailyFactId: row.dailyFactId,
      approverUserId: row.approverUserId,
      approverRole: row.approverRole as UserRole,
      action: row.action as ApprovalAction,
      comment: row.comment ?? undefined,
      createdAt: toIso(row.createdAt),
    };
  }

  private mapCrew(row: {
    id: string;
    name: string;
    locationId: string;
    headOfMasterId: string;
    workerTypeId: string;
    isActive: boolean;
    createdAt: Date;
  }): CrewRecord {
    return {
      id: row.id,
      name: row.name,
      locationId: row.locationId,
      headOfMasterId: row.headOfMasterId,
      workerTypeId: row.workerTypeId,
      isActive: row.isActive,
      createdAt: toIso(row.createdAt),
    };
  }

  private mapWorkerAssignment(row: {
    id: string;
    dailyPlanId: string;
    crewId: string;
    workerTypeId: string;
    workerCount: number;
    assignedByUserId: string;
    createdAt: Date;
  }): WorkerAssignmentRecord {
    return {
      id: row.id,
      dailyPlanId: row.dailyPlanId,
      crewId: row.crewId,
      workerTypeId: row.workerTypeId,
      workerCount: row.workerCount,
      assignedByUserId: row.assignedByUserId,
      createdAt: toIso(row.createdAt),
    };
  }

  private assertApprovalAllowed(currentStatus: DailyFactStatus, role: UserRole) {
    assertApprovalAllowedRule(currentStatus, role);
  }
}
