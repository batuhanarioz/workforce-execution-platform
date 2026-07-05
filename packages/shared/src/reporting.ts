import { ActualWorkStatus, DailyFactStatus, DailyPlanStatus } from "./domain";

export interface DailyReportRow {
  dailyPlanId: string;
  dailyFactId: string;
  planDate: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  typeOfWorkId: string;
  typeOfWorkCode: string;
  typeOfWorkName: string;
  subTypeOfWorkId: string;
  subTypeOfWorkCode: string;
  subTypeOfWorkName: string;
  subSubTypeOfWorkId: string;
  subSubTypeOfWorkCode: string;
  subSubTypeOfWorkName: string;
  unit: string;
  planStatus: DailyPlanStatus;
  factStatus: DailyFactStatus;
  actualStatus: ActualWorkStatus;
  plannedQuantity: number;
  factQuantity: number;
  plannedManDay: number;
  factManDay: number;
  overtime: number;
  quantityVariance: number;
  manDayVariance: number;
  productivityRatio: number;
  submittedAt?: string;
}

export interface DailyReportSummary {
  totalPlannedQuantity: number;
  totalFactQuantity: number;
  totalPlannedManDay: number;
  totalFactManDay: number;
  totalOvertime: number;
  quantityCompletionRate: number;
  productivityRatio: number;
  rowCount: number;
}

export interface DailyReportResponse {
  rows: DailyReportRow[];
  summary: DailyReportSummary;
}
