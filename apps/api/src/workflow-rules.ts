import { ActualWorkStatus, DailyFactStatus, UserRole, type DailyFactCreateInput } from "@wfp/shared";

export function validateDailyFactInput(input: DailyFactCreateInput) {
  if (input.factQuantity < 0 || input.factManDay < 0 || input.overtime < 0) {
    throw new Error("Fact values cannot be negative.");
  }

  if (
    input.actualStatus === ActualWorkStatus.NOT_STARTED ||
    input.actualStatus === ActualWorkStatus.PARTIALLY_COMPLETED
  ) {
    if (!input.comment?.trim()) {
      throw new Error("Comment is required for non-completed work.");
    }
  }
}

export function assertApprovalAllowed(currentStatus: DailyFactStatus, role: UserRole) {
  if (role === UserRole.HEAD_OF_MASTER && currentStatus !== DailyFactStatus.SUBMITTED) {
    throw new Error("Head of Master approval requires submitted fact.");
  }

  if (role === UserRole.SITE_CHIEF && currentStatus !== DailyFactStatus.APPROVED_BY_HEAD_OF_MASTER) {
    throw new Error("Site Chief approval requires Head of Master approval.");
  }

  if (role === UserRole.PROJECT_MANAGER && currentStatus !== DailyFactStatus.APPROVED_BY_SITE_CHIEF) {
    throw new Error("Project Manager approval requires Site Chief approval.");
  }
}

export function isReportableFact(status: DailyFactStatus) {
  return status === DailyFactStatus.APPROVED_BY_PROJECT_MANAGER;
}
