export interface LocationRecord {
  id: string;
  code: string;
  name: string;
  region?: string;
  isActive: boolean;
}

export interface ProjectRecord {
  id: string;
  code: string;
  name: string;
  locationId: string;
  isActive: boolean;
}

export interface WorkTypeRecord {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface SubWorkTypeRecord {
  id: string;
  code: string;
  name: string;
  typeOfWorkId: string;
  sortOrder: number;
  isActive: boolean;
}

export interface SubSubWorkTypeRecord {
  id: string;
  code: string;
  name: string;
  subTypeOfWorkId: string;
  unit: string;
  typeCode: string;
  zzzCode?: string;
  isActive: boolean;
}

export interface WorkerTypeRecord {
  id: string;
  name: string;
  isActive: boolean;
}

export interface ZzzDetailRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface MasterDataSnapshot {
  locations: LocationRecord[];
  projects: ProjectRecord[];
  typeOfWorks: WorkTypeRecord[];
  subTypeOfWorks: SubWorkTypeRecord[];
  subSubTypeOfWorks: SubSubWorkTypeRecord[];
  workerTypes: WorkerTypeRecord[];
  zzzDetails: ZzzDetailRecord[];
  importedAt: string;
  source: string;
}

export interface WbsImportPayload {
  source: string;
  locations: Array<
    Partial<Pick<LocationRecord, "id">> &
      Pick<LocationRecord, "code" | "name"> &
      Partial<Pick<LocationRecord, "region" | "isActive">>
  >;
  projects: Array<
    Partial<Pick<ProjectRecord, "id">> &
      Pick<ProjectRecord, "code" | "name"> &
      Partial<Pick<ProjectRecord, "locationId" | "isActive">> & {
        locationCode?: string;
      }
  >;
  typeOfWorks: Array<
    Partial<Pick<WorkTypeRecord, "id">> &
      Pick<WorkTypeRecord, "code" | "name" | "sortOrder"> &
      Partial<Pick<WorkTypeRecord, "isActive">>
  >;
  subTypeOfWorks: Array<
    Partial<Pick<SubWorkTypeRecord, "id">> &
      Pick<SubWorkTypeRecord, "code" | "name" | "sortOrder"> &
      Partial<Pick<SubWorkTypeRecord, "isActive">> & {
        typeOfWorkId?: string;
        typeOfWorkCode?: string;
      }
  >;
  subSubTypeOfWorks: Array<
    Partial<Pick<SubSubWorkTypeRecord, "id">> &
      Pick<SubSubWorkTypeRecord, "code" | "name" | "unit" | "typeCode"> &
      Partial<Pick<SubSubWorkTypeRecord, "zzzCode" | "isActive">> & {
        subTypeOfWorkId?: string;
        subTypeOfWorkCode?: string;
      }
  >;
  workerTypes: Array<
    Partial<Pick<WorkerTypeRecord, "id">> & Pick<WorkerTypeRecord, "name"> & Partial<Pick<WorkerTypeRecord, "isActive">>
  >;
  zzzDetails: Array<
    Partial<Pick<ZzzDetailRecord, "id">> & Pick<ZzzDetailRecord, "code" | "name"> & Partial<Pick<ZzzDetailRecord, "isActive">>
  >;
  demoUsers?: Array<{
    fullName: string;
    email: string;
    role: UserRole;
    locationCodes: string[];
  }>;
}
import { UserRole } from "./domain";
