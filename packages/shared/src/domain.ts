export enum UserRole {
  TECH_OFFICE = "TECH_OFFICE",
  HEAD_OF_MASTER = "HEAD_OF_MASTER",
  SITE_CHIEF = "SITE_CHIEF",
  PROJECT_MANAGER = "PROJECT_MANAGER",
  ADMIN = "ADMIN",
}

export enum UserAssignmentType {
  HEAD_OF_MASTER = "HEAD_OF_MASTER",
  TECH_OFFICE = "TECH_OFFICE",
  SITE_CHIEF = "SITE_CHIEF",
}

export enum DeviceType {
  DESKTOP = "DESKTOP",
  MOBILE = "MOBILE",
}

export enum AccessScope {
  OWN = "OWN",
  ASSIGNED = "ASSIGNED",
  LOCATION = "LOCATION",
  PROJECT = "PROJECT",
  ALL = "ALL",
}

export enum DailyPlanStatus {
  DRAFT = "DRAFT",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  FACT_SUBMITTED = "FACT_SUBMITTED",
  APPROVED_BY_HEAD_OF_MASTER = "APPROVED_BY_HEAD_OF_MASTER",
  APPROVED_BY_SITE_CHIEF = "APPROVED_BY_SITE_CHIEF",
  APPROVED_BY_PROJECT_MANAGER = "APPROVED_BY_PROJECT_MANAGER",
  REPORTED = "REPORTED",
  RETURNED_FOR_REVISION = "RETURNED_FOR_REVISION",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum DailyFactStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED_BY_HEAD_OF_MASTER = "APPROVED_BY_HEAD_OF_MASTER",
  APPROVED_BY_SITE_CHIEF = "APPROVED_BY_SITE_CHIEF",
  APPROVED_BY_PROJECT_MANAGER = "APPROVED_BY_PROJECT_MANAGER",
  RETURNED_FOR_REVISION = "RETURNED_FOR_REVISION",
  REJECTED = "REJECTED",
}

export enum ActualWorkStatus {
  COMPLETED = "COMPLETED",
  PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED",
  NOT_STARTED = "NOT_STARTED",
}

export enum ApprovalAction {
  APPROVED = "APPROVED",
  RETURNED = "RETURNED",
  REJECTED = "REJECTED",
}

export interface LocationSummary {
  id: string;
  code: string;
  name: string;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  locations: LocationSummary[];
}

export interface AuthenticatedUser extends UserSummary {
  tokenVersion?: number;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
  tokenVersion?: number;
}

export interface PermissionContext {
  role: UserRole;
  device?: DeviceType;
  locationId?: string;
  projectId?: string;
}
