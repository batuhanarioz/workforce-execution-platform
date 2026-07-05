import test from "node:test";
import assert from "node:assert/strict";
import { ActualWorkStatus, DailyFactStatus, UserRole } from "@wfp/shared";
import { assertApprovalAllowed, validateDailyFactInput } from "../src/workflow-rules";

test("validateDailyFactInput rejects negative numbers", () => {
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
});

test("validateDailyFactInput requires comment for partial or not started work", () => {
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

  assert.throws(
    () =>
      validateDailyFactInput({
        dailyPlanId: "plan-1",
        factQuantity: 0,
        factManDay: 0,
        overtime: 0,
        actualStatus: ActualWorkStatus.NOT_STARTED,
      }),
    /Comment is required/
  );
});

test("approval rules block out-of-order transitions", () => {
  assert.throws(
    () => assertApprovalAllowed(DailyFactStatus.DRAFT, UserRole.HEAD_OF_MASTER),
    /Head of Master approval requires submitted fact/
  );

  assert.throws(
    () => assertApprovalAllowed(DailyFactStatus.SUBMITTED, UserRole.SITE_CHIEF),
    /Site Chief approval requires Head of Master approval/
  );

  assert.throws(
    () => assertApprovalAllowed(DailyFactStatus.APPROVED_BY_HEAD_OF_MASTER, UserRole.PROJECT_MANAGER),
    /Project Manager approval requires Site Chief approval/
  );
});

test("approval rules allow valid workflow steps", () => {
  assert.doesNotThrow(() => assertApprovalAllowed(DailyFactStatus.SUBMITTED, UserRole.HEAD_OF_MASTER));
  assert.doesNotThrow(() => assertApprovalAllowed(DailyFactStatus.APPROVED_BY_HEAD_OF_MASTER, UserRole.SITE_CHIEF));
  assert.doesNotThrow(() => assertApprovalAllowed(DailyFactStatus.APPROVED_BY_SITE_CHIEF, UserRole.PROJECT_MANAGER));
});
