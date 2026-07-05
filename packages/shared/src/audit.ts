import { UserRole } from "./domain";

export type AuditSource = "web" | "mobile" | "api" | "system";

export type AuditEntityType =
  | "auth"
  | "daily-plan"
  | "daily-fact"
  | "approval"
  | "sync"
  | "report"
  | "admin-user"
  | "system";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PLAN_CREATED"
  | "PLAN_UPDATED"
  | "PLAN_ASSIGNED"
  | "PLAN_CANCELLED"
  | "PLAN_STARTED"
  | "FACT_DRAFT_SAVED"
  | "FACT_SUBMITTED"
  | "FACT_UPDATED"
  | "FACT_APPROVED"
  | "FACT_RETURNED"
  | "FACT_REJECTED"
  | "ACCESS_DENIED"
  | "SYNC_PUSHED"
  | "SYNC_FAILED"
  | "REPORT_VIEWED"
  | "AUDIT_LOG_VIEWED"
  | "ADMIN_USER_UPDATED"
  | "SYSTEM_HEALTH_CHECKED";

export interface AuditActorSummary {
  id: string;
  fullName?: string;
  email?: string;
  role?: UserRole | string;
}

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  user?: AuditActorSummary | null;
  actorRole?: UserRole | string;
  entityType: AuditEntityType | string;
  entityId: string;
  action: AuditAction | string;
  oldValue?: unknown | null;
  newValue?: unknown | null;
  source: AuditSource | string;
  locationId?: string | null;
  requestId?: string | null;
  createdAt: string;
}

export interface AuditLogQuery {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  role?: UserRole | string;
  entityType?: AuditEntityType | string;
  entityId?: string;
  action?: AuditAction | string;
  source?: AuditSource | string;
  search?: string;
  limit?: number;
  page?: number;
}

export interface AuditLogPageInfo {
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
}
