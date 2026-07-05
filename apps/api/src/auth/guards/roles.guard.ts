import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { UserRole } from "@wfp/shared";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { AuditLogsService } from "../../audit-logs/audit-logs.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly moduleRef: ModuleRef) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.readMetadata<UserRole[]>(ROLES_KEY, context);

    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role as UserRole | undefined;

    if (!userRole || !allowedRoles.includes(userRole)) {
      const auditLogsService = this.moduleRef.get(AuditLogsService, { strict: false });
      if (auditLogsService) {
        void auditLogsService.record({
          actor: {
            id: String(request.user?.id ?? "unknown"),
            fullName: String(request.user?.fullName ?? "Unknown"),
            email: String(request.user?.email ?? "unknown@example.com"),
            role: String(userRole ?? "UNKNOWN"),
          },
          entityType: "system",
          entityId: String(request.originalUrl ?? request.url ?? "unknown"),
          action: "ACCESS_DENIED",
          source: String(request.headers?.["x-client-platform"] ?? "api"),
          requestId: String(request.headers?.["x-request-id"] ?? ""),
          locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
          newValue: {
            allowedRoles,
            userRole,
          },
        }).catch(() => undefined);
      }
      throw new ForbiddenException("Role is not allowed to access this resource.");
    }

    return true;
  }

  private readMetadata<T>(key: string, context: ExecutionContext): T | undefined {
    return Reflect.getMetadata(key, context.getHandler()) ?? Reflect.getMetadata(key, context.getClass());
  }
}
