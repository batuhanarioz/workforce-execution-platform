import { ActualWorkStatus, DailyFactStatus } from "./domain";

export interface DailyFactRecord {
  id: string;
  dailyPlanId: string;
  factQuantity: number;
  factManDay: number;
  overtime: number;
  actualStatus: ActualWorkStatus;
  comment?: string;
  zzzDetailId?: string;
  submittedByUserId: string;
  status: DailyFactStatus;
  submittedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyFactCreateInput {
  id?: string;
  dailyPlanId: string;
  factQuantity: number;
  factManDay: number;
  overtime: number;
  actualStatus: ActualWorkStatus;
  comment?: string;
  zzzDetailId?: string;
}

export interface ApprovalHistoryRecord {
  id: string;
  dailyFactId: string;
  approverUserId: string;
  approverRole: string;
  action: string;
  comment?: string;
  createdAt: string;
}

export interface SyncRecordInput {
  localId: string;
  idempotencyKey: string;
  entityType: string;
  operation: string;
  baseVersion?: number;
  payload: unknown;
  createdAt: string;
}

export interface SyncResultItem {
  localId: string;
  status: "SYNCED" | "FAILED" | "CONFLICT" | "DUPLICATE_IGNORED";
  serverId?: string;
  error?: string;
  message?: string;
  serverVersion?: number;
}
