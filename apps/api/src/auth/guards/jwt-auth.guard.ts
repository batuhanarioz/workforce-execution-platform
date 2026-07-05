import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthenticatedUser, UserRole } from "@wfp/shared";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { verifyAccessToken } from "../auth-token";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.readMetadata<boolean>(IS_PUBLIC_KEY, context);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string | undefined;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const verified = verifyAccessToken(token);
    if (!verified) {
      throw new UnauthorizedException("Invalid or expired token.");
    }

    const roleHeader = String(request.headers?.["x-user-role"] ?? "");
    const headerRole = this.resolveRole(roleHeader);
    const headerUserId = String(request.headers?.["x-user-id"] ?? "");
    const headerName = String(request.headers?.["x-user-name"] ?? "");
    const headerEmail = String(request.headers?.["x-user-email"] ?? "");
    const headerLocationId = String(request.headers?.["x-user-location-id"] ?? "");
    const headerLocationCode = String(request.headers?.["x-user-location-code"] ?? "");
    const headerLocationName = String(request.headers?.["x-user-location-name"] ?? "");

    if (!verified.legacy && roleHeader && verified.role !== headerRole) {
      throw new UnauthorizedException("Token role does not match request headers.");
    }

    if (!verified.legacy && headerUserId && verified.sub !== headerUserId) {
      throw new UnauthorizedException("Token subject does not match request headers.");
    }

    const user: AuthenticatedUser = {
      id: verified.sub,
      fullName: headerName || verified.email || "Dev User",
      email: headerEmail || verified.email || "dev@example.com",
      role: verified.legacy ? headerRole : verified.role,
      locations:
        headerLocationId && headerLocationCode && headerLocationName
          ? [
              {
                id: headerLocationId,
                code: headerLocationCode,
                name: headerLocationName,
              },
            ]
          : [],
      tokenVersion: verified.tokenVersion,
    };

    request.user = user;
    return true;
  }

  private resolveRole(rawRole: string): UserRole {
    switch (rawRole) {
      case UserRole.HEAD_OF_MASTER:
        return UserRole.HEAD_OF_MASTER;
      case UserRole.SITE_CHIEF:
        return UserRole.SITE_CHIEF;
      case UserRole.PROJECT_MANAGER:
        return UserRole.PROJECT_MANAGER;
      case UserRole.ADMIN:
        return UserRole.ADMIN;
      default:
        return UserRole.TECH_OFFICE;
    }
  }

  private readMetadata<T>(key: string, context: ExecutionContext): T | undefined {
    return Reflect.getMetadata(key, context.getHandler()) ?? Reflect.getMetadata(key, context.getClass());
  }
}
