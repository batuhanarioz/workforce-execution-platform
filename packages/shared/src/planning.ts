import { DailyPlanStatus, UserSummary } from "./domain";

export interface DailyPlanRecord {
  id: string;
  planDate: string;
  locationId: string;
  projectId: string;
  typeOfWorkId: string;
  subTypeOfWorkId: string;
  subSubTypeOfWorkId: string;
  unit: string;
  plannedQuantity: number;
  plannedManDay: number;
  assignedHeadOfMasterId?: string;
  createdByUserId: string;
  status: DailyPlanStatus;
  note?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrewRecord {
  id: string;
  name: string;
  locationId: string;
  headOfMasterId: string;
  workerTypeId: string;
  isActive: boolean;
  createdAt: string;
}

export interface WorkerAssignmentRecord {
  id: string;
  dailyPlanId: string;
  crewId: string;
  workerTypeId: string;
  workerCount: number;
  assignedByUserId: string;
  createdAt: string;
}

export interface DailyPlanCreateInput {
  planDate: string;
  locationId: string;
  projectId: string;
  typeOfWorkId: string;
  subTypeOfWorkId: string;
  subSubTypeOfWorkId: string;
  unit: string;
  plannedQuantity: number;
  plannedManDay: number;
  note?: string;
}

export interface DailyPlanAssignInput {
  assignedHeadOfMasterId: string;
}

export interface DailyPlanListItem extends DailyPlanRecord {
  createdByUser?: UserSummary;
}

export interface CrewCreateInput {
  id?: string;
  name: string;
  locationId: string;
  headOfMasterId: string;
  workerTypeId: string;
}

export interface WorkerAssignmentCreateInput {
  id?: string;
  dailyPlanId: string;
  crewId: string;
  workerTypeId: string;
  workerCount: number;
}
