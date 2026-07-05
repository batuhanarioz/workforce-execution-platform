import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { AuthService } from "../src/auth/auth.service";
import { verifyAccessToken } from "../src/auth/auth-token";
import { DailyFactsService } from "../src/daily-facts/daily-facts.service";
import { ReportsService } from "../src/reports/reports.service";
import { assertApprovalAllowed, validateDailyFactInput } from "../src/workflow-rules";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  ActualWorkStatus,
  DailyFactStatus,
  DailyPlanStatus,
  UserRole,
  type DailyFactCreateInput,
  type MasterDataSnapshot,
} from "@wfp/shared";
import { AuditLogsService } from "../src/audit-logs/audit-logs.service";

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const tests: TestCase[] = [];
const auditLogsService = {
  record: async () => ({
    id: "audit-1",
    userId: "user-1",
    user: null,
    entityType: "system",
    entityId: "entity-1",
    action: "TEST",
    oldValue: null,
    newValue: null,
    source: "api",
    locationId: null,
    requestId: null,
    createdAt: new Date().toISOString(),
  }),
} as unknown as AuditLogsService;

function test(name: string, run: () => Promise<void> | void) {
  tests.push({ name, run });
}

function createMasterData(): MasterDataSnapshot {
  return {
    importedAt: "2026-07-03T00:00:00.000Z",
    source: "seed",
    locations: [{ id: "loc-1", code: "30AAA", name: "Location 30AAA", region: "A", isActive: true }],
    projects: [{ id: "prj-1", code: "PRJ-001", name: "Project 001", locationId: "loc-1", isActive: true }],
    typeOfWorks: [{ id: "tow-1", code: "TOW-01", name: "General Works", sortOrder: 1, isActive: true }],
    subTypeOfWorks: [{ id: "stow-1", code: "STOW-01", name: "Formwork", typeOfWorkId: "tow-1", sortOrder: 1, isActive: true }],
    subSubTypeOfWorks: [
      { id: "sstow-1", code: "SSTOW-01", name: "Formwork Area", subTypeOfWorkId: "stow-1", unit: "m2", typeCode: "T-001", isActive: true },
    ],
    workerTypes: [],
    zzzDetails: [],
  };
}

function createReportsState() {
  const masterData = createMasterData();

  return {
    getMasterData: async () => masterData,
    listDailyPlans: async () => [
      {
        id: "plan-1",
        planDate: "2026-07-03",
        locationId: "loc-1",
        projectId: "prj-1",
        typeOfWorkId: "tow-1",
        subTypeOfWorkId: "stow-1",
        subSubTypeOfWorkId: "sstow-1",
        unit: "m2",
        plannedQuantity: 120,
        plannedManDay: 18,
        assignedHeadOfMasterId: undefined,
        createdByUserId: "user-1",
        status: DailyPlanStatus.REPORTED,
        note: undefined,
        version: 1,
        createdAt: "2026-07-03T00:00:00.000Z",
        updatedAt: "2026-07-03T00:00:00.000Z",
      },
      {
        id: "plan-2",
        planDate: "2026-07-04",
        locationId: "loc-1",
        projectId: "prj-1",
        typeOfWorkId: "tow-1",
        subTypeOfWorkId: "stow-1",
        subSubTypeOfWorkId: "sstow-1",
        unit: "m2",
        plannedQuantity: 80,
        plannedManDay: 12,
        assignedHeadOfMasterId: undefined,
        createdByUserId: "user-1",
        status: DailyPlanStatus.APPROVED_BY_HEAD_OF_MASTER,
        note: undefined,
        version: 1,
        createdAt: "2026-07-04T00:00:00.000Z",
        updatedAt: "2026-07-04T00:00:00.000Z",
      },
    ],
    listDailyFacts: async () => [
      {
        id: "fact-1",
        dailyPlanId: "plan-1",
        factQuantity: 100,
        factManDay: 16,
        overtime: 2,
        actualStatus: ActualWorkStatus.COMPLETED,
        comment: "ok",
        zzzDetailId: undefined,
        submittedByUserId: "user-1",
        status: DailyFactStatus.APPROVED_BY_PROJECT_MANAGER,
        submittedAt: "2026-07-03T12:00:00.000Z",
        version: 2,
        createdAt: "2026-07-03T00:00:00.000Z",
        updatedAt: "2026-07-03T12:00:00.000Z",
      },
      {
        id: "fact-2",
        dailyPlanId: "plan-2",
        factQuantity: 70,
        factManDay: 11,
        overtime: 0,
        actualStatus: ActualWorkStatus.COMPLETED,
        comment: "not yet approved",
        zzzDetailId: undefined,
        submittedByUserId: "user-1",
        status: DailyFactStatus.APPROVED_BY_SITE_CHIEF,
        submittedAt: "2026-07-04T12:00:00.000Z",
        version: 2,
        createdAt: "2026-07-04T00:00:00.000Z",
        updatedAt: "2026-07-04T12:00:00.000Z",
      },
    ],
  };
}

test("workflow rules reject invalid submissions and preserve approval order", () => {
  assert.throws(
    () =>
      validateDailyFactInput({
        dailyPlanId: "plan-1",
        factQuantity: -1,
        factManDay: 1,
        overtime: 0,
        actualStatus: ActualWorkStatus.COMPLETED,
      }),
    /Fact values cannot be negative/
  );

  assert.throws(
    () =>
      validateDailyFactInput({
        dailyPlanId: "plan-1",
        factQuantity: 1,
        factManDay: 1,
        overtime: 0,
        actualStatus: ActualWorkStatus.PARTIALLY_COMPLETED,
      }),
    /Comment is required/
  );

  assert.throws(() => assertApprovalAllowed(DailyFactStatus.DRAFT, UserRole.HEAD_OF_MASTER), /Head of Master approval requires submitted fact/);
  assert.throws(() => assertApprovalAllowed(DailyFactStatus.SUBMITTED, UserRole.SITE_CHIEF), /Site Chief approval requires Head of Master approval/);
  assert.throws(() => assertApprovalAllowed(DailyFactStatus.APPROVED_BY_HEAD_OF_MASTER, UserRole.PROJECT_MANAGER), /Project Manager approval requires Site Chief approval/);
});

test("auth service rejects unknown emails without deriving a role from the address", async () => {
  const prisma = {
    user: {
      findUnique: async () => null,
      findMany: async () => [],
    },
  } as unknown as PrismaService;

  const service = new AuthService(prisma, auditLogsService);

  await assert.rejects(
    () => service.login({ email: "  Admin-looking-email@icn.com ", password: "anything" }),
    /Invalid email or password/
  );
});

test("auth service maps real directory records into summaries", async () => {
  const prisma = {
    user: {
      findUnique: async () => null,
      findMany: async () => [
        {
          id: "user-2",
          fullName: "Ada Lovelace",
          email: "ada@example.com",
          tokenVersion: 7,
          role: { name: "ADMIN" },
          assignments: [
            { location: { id: "loc-1", code: "30AAA", name: "Location 30AAA" } },
          ],
        },
      ],
    },
  } as unknown as PrismaService;

  const service = new AuthService(prisma, auditLogsService);
  const response = await service.getDirectory();

  assert.equal(response.success, true);
  assert.equal(response.data.length, 1);
  assert.equal(response.data[0]?.fullName, "Ada Lovelace");
  assert.equal(response.data[0]?.locations[0]?.code, "30AAA");
});

test("auth service verifies the password hash before issuing a token", async () => {
  const correctPasswordHash = bcrypt.hashSync("correct-horse", 10);
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "user-10",
        fullName: "Real Homer",
        email: "hom@example.com",
        tokenVersion: 4,
        isActive: true,
        passwordHash: correctPasswordHash,
        role: { name: "HEAD_OF_MASTER" },
        assignments: [
          { location: { id: "loc-1", code: "30AAA", name: "Location 30AAA" } },
        ],
      }),
      findMany: async () => [],
    },
  } as unknown as PrismaService;

  const service = new AuthService(prisma, auditLogsService);

  await assert.rejects(
    () => service.login({ email: "HOM@example.com", password: "wrong-password" }),
    /Invalid email or password/
  );

  const response = await service.login({ email: "HOM@example.com", password: "correct-horse" });

  assert.equal(response.data.user.id, "user-10");
  assert.equal(response.data.user.email, "hom@example.com");
  assert.equal(response.data.user.role, UserRole.HEAD_OF_MASTER);
  assert.equal(response.data.user.locations[0]?.code, "30AAA");
  assert.match(response.data.accessToken, /^wfp-access\./);

  const verified = verifyAccessToken(response.data.accessToken);
  assert.ok(verified);
  assert.equal(verified?.sub, "user-10");
});

test("auth service records failed login attempts with anonymous audit entries", async () => {
  const auditCalls: Array<unknown> = [];
  const spyAuditService = {
    record: async (entry: unknown) => {
      auditCalls.push(entry);
      return {
        id: "audit-1",
        userId: null,
        user: null,
        actorRole: null,
        entityType: "auth",
        entityId: "unknown",
        action: "LOGIN_FAILED",
        oldValue: null,
        newValue: null,
        source: "web",
        locationId: null,
        requestId: null,
        createdAt: new Date().toISOString(),
      };
    },
  } as unknown as AuditLogsService;

  const prisma = {
    user: {
      findUnique: async () => null,
      findMany: async () => [],
    },
  } as unknown as PrismaService;

  const service = new AuthService(prisma, spyAuditService);
  await service.recordLoginFailure("missing@example.com", { source: "web", requestId: "req-1" });

  assert.equal(auditCalls.length, 1);
  const entry = auditCalls[0] as { actor?: null; entityType?: string; action?: string; newValue?: { email?: string; reason?: string } };
  assert.equal(entry.actor, null);
  assert.equal(entry.action, "LOGIN_FAILED");
  assert.equal(entry.entityType, "auth");
  assert.equal(entry.newValue?.email, "missing@example.com");
});

test("reports service returns approved rows only and computes summary totals", async () => {
  const service = new ReportsService(createReportsState() as never);
  const response = await service.daily();

  assert.equal(response.data.rows.length, 1);
  assert.equal(response.data.summary.rowCount, 1);
  assert.equal(response.data.summary.totalPlannedQuantity, 120);
  assert.equal(response.data.summary.totalFactQuantity, 100);
  assert.equal(response.data.summary.quantityCompletionRate, (100 / 120) * 100);
  assert.equal(response.data.summary.productivityRatio, 100 / 16);
});

test("reports kpis mirrors the daily summary and stays stable with empty result sets", async () => {
  const service = new ReportsService(createReportsState() as never);

  const summary = await service.kpis();
  assert.equal(summary.data.rowCount, 1);
  assert.equal(summary.data.totalFactQuantity, 100);

  const emptyState = {
    ...createReportsState(),
    listDailyFacts: async () => [],
  };
  const emptyService = new ReportsService(emptyState as never);
  const emptySummary = await emptyService.kpis({ dateFrom: "2026-08-01", dateTo: "2026-08-01" });

  assert.equal(emptySummary.data.rowCount, 0);
  assert.equal(emptySummary.data.totalFactQuantity, 0);
  assert.equal(emptySummary.data.quantityCompletionRate, 0);
  assert.equal(emptySummary.data.productivityRatio, 0);
});

test("reports service respects filters and drops incompatible rows", async () => {
  const service = new ReportsService(createReportsState() as never);

  const filtered = await service.daily({ locationId: "loc-1", dateFrom: "2026-07-03", dateTo: "2026-07-03" });
  assert.equal(filtered.data.rows.length, 1);
  assert.equal(filtered.data.rows[0]?.planDate, "2026-07-03");

  const empty = await service.daily({ dateFrom: "2026-07-04", dateTo: "2026-07-04" });
  assert.equal(empty.data.rows.length, 0);
  assert.equal(empty.data.summary.rowCount, 0);
});

test("daily facts service getters surface existing records and nulls cleanly", async () => {
  const state = {
    listDailyFacts: async () => [{ id: "fact-1" }],
    getFact: async (id: string) => (id === "fact-1" ? { id } : null),
    getFactByPlanId: async (planId: string) => (planId === "plan-1" ? { dailyPlanId: planId } : null),
    saveFactDraft: async () => ({ mode: "draft" }),
    submitFact: async () => ({ mode: "submit" }),
    updateFact: async () => ({ mode: "update" }),
    listApprovalHistoryByFactId: async (id: string) => [{ id: "history-1", dailyFactId: id }],
    approveFact: async () => ({ mode: "approve" }),
    returnFact: async () => ({ mode: "return" }),
    rejectFact: async () => ({ mode: "reject" }),
  };

  const service = new DailyFactsService(state as never, auditLogsService);
  const all = await service.list();
  const byId = await service.getById("fact-1");
  const missingById = await service.getById("fact-x");
  const byPlanId = await service.getByPlanId("plan-1");
  const missingByPlanId = await service.getByPlanId("plan-x");

  assert.equal(all.data.length, 1);
  assert.equal(byId.data?.id, "fact-1");
  assert.equal(missingById.data, null);
  assert.equal(byPlanId.data?.dailyPlanId, "plan-1");
  assert.equal(missingByPlanId.data, null);
});

test("daily facts service validates submit and delegates lifecycle actions to state", async () => {
  const calls: Array<{ name: string; args: unknown[] }> = [];

  const state = {
    listDailyFacts: async () => [],
    getFact: async (id: string) => ({ id }),
    getFactByPlanId: async (planId: string) => ({ dailyPlanId: planId }),
    saveFactDraft: async (...args: unknown[]) => {
      calls.push({ name: "saveFactDraft", args });
      return { mode: "draft" };
    },
    submitFact: async (...args: unknown[]) => {
      calls.push({ name: "submitFact", args });
      return { mode: "submit" };
    },
    updateFact: async (...args: unknown[]) => {
      calls.push({ name: "updateFact", args });
      return { mode: "update" };
    },
    listApprovalHistoryByFactId: async (id: string) => [{ id: "history-1", dailyFactId: id }],
    approveFact: async (...args: unknown[]) => {
      calls.push({ name: "approveFact", args });
      return { mode: "approve" };
    },
    returnFact: async (...args: unknown[]) => {
      calls.push({ name: "returnFact", args });
      return { mode: "return" };
    },
    rejectFact: async (...args: unknown[]) => {
      calls.push({ name: "rejectFact", args });
      return { mode: "reject" };
    },
  };

  const service = new DailyFactsService(state as never, auditLogsService);
  const input: DailyFactCreateInput = {
    dailyPlanId: "plan-1",
    factQuantity: 15,
    factManDay: 3,
    overtime: 1,
    actualStatus: ActualWorkStatus.COMPLETED,
    comment: "done",
  };

  await assert.doesNotReject(() => service.submit("plan-1", input, "user-1"));
  await assert.rejects(
    () =>
      service.submit(
        "plan-1",
        {
          ...input,
          factQuantity: -1,
        },
        "user-1"
      ),
    /Fact values cannot be negative/
  );

  await service.draft("plan-1", { comment: "draft note" }, "user-1");
  await service.update("fact-1", { comment: "patched" });
  await service.approveHeadMaster("fact-1", { id: "user-2", fullName: "HOM", email: "hom@icn.com", role: UserRole.HEAD_OF_MASTER, locations: [] });
  await service.approveSiteChief("fact-1", { id: "user-3", fullName: "Site", email: "site@icn.com", role: UserRole.SITE_CHIEF, locations: [] });
  await service.approveProjectManager("fact-1", { id: "user-4", fullName: "PM", email: "pm@icn.com", role: UserRole.PROJECT_MANAGER, locations: [] });
  await service.returnForRevision("fact-1", { id: "user-5", fullName: "HOM", email: "hom@icn.com", role: UserRole.HEAD_OF_MASTER, locations: [] }, "fix it");
  await service.reject("fact-1", { id: "user-6", fullName: "Site", email: "site@icn.com", role: UserRole.SITE_CHIEF, locations: [] }, "reject it");

  const history = await service.history("fact-1");
  assert.equal(history.data[0]?.dailyFactId, "fact-1");
  assert.equal(calls.some((call) => call.name === "saveFactDraft"), true);
  assert.equal(calls.some((call) => call.name === "submitFact"), true);
  assert.equal(calls.some((call) => call.name === "updateFact"), true);
  assert.equal(calls.filter((call) => call.name === "approveFact").length, 3);
  assert.equal(calls.some((call) => call.name === "returnFact"), true);
  assert.equal(calls.some((call) => call.name === "rejectFact"), true);
});

async function main() {
  let passed = 0;

  for (const entry of tests) {
    try {
      await entry.run();
      passed += 1;
      console.log(`ok - ${entry.name}`);
    } catch (error) {
      console.error(`not ok - ${entry.name}`);
      console.error(error);
      process.exitCode = 1;
      break;
    }
  }

  console.log(`1..${passed}`);
  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

void main();
