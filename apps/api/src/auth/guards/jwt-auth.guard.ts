import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthenticatedUser } from "@wfp/shared";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { verifyAccessToken } from "../auth-token";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

    // Identity and role are derived solely from the signed token. Client-supplied
    // x-user-* headers are never trusted for authorization decisions — they are
    // request metadata (used for audit logging) only.
    let locations: AuthenticatedUser["locations"] = [];
    let fullName = verified.email;
    let tokenVersion = verified.tokenVersion;

    try {
      const record = await this.prisma.user.findUnique({
        where: { id: verified.sub },
        include: { assignments: { include: { location: true } } },
      });

      if (record) {
        if (record.tokenVersion !== verified.tokenVersion) {
          throw new UnauthorizedException("Token has been revoked.");
        }

        fullName = record.fullName;
        locations = record.assignments.map((assignment) => ({
          id: assignment.location.id,
          code: assignment.location.code,
          name: assignment.location.name,
        }));
        tokenVersion = record.tokenVersion;
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // DB unavailable in local/dev fallback mode — proceed with token claims only.
    }

    const user: AuthenticatedUser = {
      id: verified.sub,
      fullName,
      email: verified.email,
      role: verified.role,
      locations,
      tokenVersion,
    };

    request.user = user;
    return true;
  }

  private readMetadata<T>(key: string, context: ExecutionContext): T | undefined {
    return Reflect.getMetadata(key, context.getHandler()) ?? Reflect.getMetadata(key, context.getClass());
  }
}
