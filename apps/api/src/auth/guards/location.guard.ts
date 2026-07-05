import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { AccessScope } from "@wfp/shared";
import { LOCATION_SCOPE_KEY } from "../decorators/location-scope.decorator";
import { AuditLogsService } from "../../audit-logs/audit-logs.service";

@Injectable()
export class LocationGuard implements CanActivate {
  constructor(private readonly moduleRef: ModuleRef) {}

  canActivate(context: ExecutionContext): boolean {
    const scope = this.readMetadata<AccessScope | undefined>(LOCATION_SCOPE_KEY, context);

    if (!scope) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requestedLocationId = request.params?.locationId ?? request.query?.locationId;

    if (scope === AccessScope.ALL) {
      return true;
    }

    if (!requestedLocationId) {
      return true;
    }

    const userLocations = Array.isArray(user?.locations) ? user.locations : [];
    const hasAccess = userLocations.some(
      (location: { id?: string }) => location.id === requestedLocationId
    );

    if (!hasAccess) {
      const auditLogsService = this.moduleRef.get(AuditLogsService, { strict: false });
      if (auditLogsService) {
        void auditLogsService.record({
          actor: {
            id: String(user?.id ?? "unknown"),
            fullName: String(user?.fullName ?? "Unknown"),
            email: String(user?.email ?? "unknown@example.com"),
            role: String(user?.role ?? "UNKNOWN"),
          },
          entityType: "system",
          entityId: String(request.originalUrl ?? request.url ?? "unknown"),
          action: "ACCESS_DENIED",
          source: String(request.headers?.["x-client-platform"] ?? "api"),
          requestId: String(request.headers?.["x-request-id"] ?? ""),
          locationId: String(requestedLocationId ?? "") || null,
          newValue: {
            scope,
            requestedLocationId,
          },
        }).catch(() => undefined);
      }
      throw new ForbiddenException("User is not allowed to access this location.");
    }

    return true;
  }

  private readMetadata<T>(key: string, context: ExecutionContext): T | undefined {
    return Reflect.getMetadata(key, context.getHandler()) ?? Reflect.getMetadata(key, context.getClass());
  }
}
