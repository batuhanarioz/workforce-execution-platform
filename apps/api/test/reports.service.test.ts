import test from "node:test";
import assert from "node:assert/strict";
import { ReportsService } from "../src/reports/reports.service";
import { DailyFactStatus, DailyPlanStatus, ActualWorkStatus, type MasterDataSnapshot } from "@wfp/shared";
import { InMemoryStateService } from "../src/state/in-memory-state.service";

const masterData: MasterDataSnapshot = {
  importedAt: "2026-07-03T00:00:00.000Z",
  source: "seed",
  locations: [{ id: "loc-1", code: "30AAA", name: "Location 30AAA", region: "A", isActive: true }],
  projects: [{ id: "prj-1", code: "PRJ-001", name: "Project 001", locationId: "loc-1", isActive: true }],
  typeOfWorks: [{ id: "tow-1", code: "TOW-01", name: "General Works", sortOrder: 1, isActive: true }],
  subTypeOfWorks: [{ id: "stow-1", code: "STOW-01", name: "Formwork", typeOfWorkId: "tow-1", sortOrder: 1, isActive: true }],
  subSubTypeOfWorks: [{ id: "sstow-1", code: "SSTOW-01", name: "Formwork Area", subTypeOfWorkId: "stow-1", unit: "m2", typeCode: "T-001", isActive: true }],
  workerTypes: [],
  zzzDetails: [],
};

const fakeState = {
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
} as unknown as InMemoryStateService;

test("daily report only includes project-manager approved rows", async () => {
  const service = new ReportsService(fakeState);
  const response = await service.daily();

  assert.equal(response.data.summary.rowCount, 1);
  assert.equal(response.data.rows.length, 1);
  assert.equal(response.data.rows[0]?.dailyFactId, "fact-1");
  assert.equal(response.data.summary.totalFactQuantity, 100);
  assert.equal(response.data.summary.totalPlannedQuantity, 120);
});

test("daily report filters by location and date range", async () => {
  const service = new ReportsService(fakeState);
  const response = await service.daily({ locationId: "loc-1", dateFrom: "2026-07-03", dateTo: "2026-07-03" });

  assert.equal(response.data.rows.length, 1);
  assert.equal(response.data.rows[0]?.planDate, "2026-07-03");
});
