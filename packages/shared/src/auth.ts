import { AccessScope, DeviceType, UserRole } from "./domain";

export interface RoleCapability {
  role: UserRole;
  primaryDevice: DeviceType;
  fallbackDevices: DeviceType[];
  scope: AccessScope;
}

export const ROLE_CAPABILITIES: Record<UserRole, RoleCapability> = {
  [UserRole.TECH_OFFICE]: {
    role: UserRole.TECH_OFFICE,
    primaryDevice: DeviceType.DESKTOP,
    fallbackDevices: [DeviceType.MOBILE],
    scope: AccessScope.LOCATION,
  },
  [UserRole.HEAD_OF_MASTER]: {
    role: UserRole.HEAD_OF_MASTER,
    primaryDevice: DeviceType.MOBILE,
    fallbackDevices: [DeviceType.DESKTOP],
    scope: AccessScope.ASSIGNED,
  },
  [UserRole.SITE_CHIEF]: {
    role: UserRole.SITE_CHIEF,
    primaryDevice: DeviceType.DESKTOP,
    fallbackDevices: [DeviceType.MOBILE],
    scope: AccessScope.LOCATION,
  },
  [UserRole.PROJECT_MANAGER]: {
    role: UserRole.PROJECT_MANAGER,
    primaryDevice: DeviceType.DESKTOP,
    fallbackDevices: [DeviceType.MOBILE],
    scope: AccessScope.PROJECT,
  },
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    primaryDevice: DeviceType.DESKTOP,
    fallbackDevices: [DeviceType.MOBILE],
    scope: AccessScope.ALL,
  },
};
