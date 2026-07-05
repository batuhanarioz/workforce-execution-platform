import { SetMetadata } from "@nestjs/common";
import { AccessScope } from "@wfp/shared";

export const LOCATION_SCOPE_KEY = "locationScope";
export const LocationScope = (scope: AccessScope) =>
  SetMetadata(LOCATION_SCOPE_KEY, scope);
