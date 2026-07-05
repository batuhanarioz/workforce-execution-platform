import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { LoginDto } from "./dto/login.dto";
import { AuthenticatedUser, UserRole, type UserSummary } from "@wfp/shared";
import { UserRole as PrismaUserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { createAccessToken, createRefreshToken } from "./auth-token";
import { AuditLogsService, type AuditContext } from "../audit-logs/audit-logs.service";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService
  ) {}

  async login(dto: LoginDto, auditContext?: AuditContext) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    let record: (Parameters<AuthService["mapUser"]>[0] & { passwordHash: string; isActive: boolean }) | null = null;
    try {
      record = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          role: true,
          assignments: {
            include: {
              location: true,
            },
            orderBy: {
              isPrimary: "desc",
            },
          },
        },
      });
    } catch {
      record = null;
    }

    const passwordMatches = record ? await bcrypt.compare(dto.password, record.passwordHash) : false;

    if (!record || !record.isActive || !passwordMatches) {
      void this.recordLoginFailure(normalizedEmail, auditContext);
      throw new UnauthorizedException("Invalid email or password.");
    }

    const user = this.mapUser(record);

    const response = {
      success: true,
      data: {
        accessToken: createAccessToken({
          sub: user.id,
          role: user.role,
          email: user.email,
          tokenVersion: user.tokenVersion,
        }),
        refreshToken: createRefreshToken({
          sub: user.id,
          role: user.role,
          email: user.email,
          tokenVersion: user.tokenVersion,
        }),
        user,
      },
    };

    await this.auditLogsService
      .record({
        actor: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
        entityType: "auth",
        entityId: user.id,
        action: "LOGIN_SUCCESS",
        source: auditContext?.source ?? "api",
        requestId: auditContext?.requestId ?? null,
        locationId: auditContext?.locationId ?? null,
        newValue: { email: user.email, role: user.role },
      })
      .catch(() => undefined);

    return response;
  }

  async recordLoginFailure(
    email: string | undefined,
    auditContext?: AuditContext,
    reason = "invalid_credentials"
  ) {
    const normalizedEmail = email?.trim().toLowerCase() || "unknown";

    void this.auditLogsService.record({
      actor: null,
      entityType: "auth",
      entityId: normalizedEmail,
      action: "LOGIN_FAILED",
      source: auditContext?.source ?? "api",
      requestId: auditContext?.requestId ?? null,
      locationId: auditContext?.locationId ?? null,
      newValue: {
        email: normalizedEmail,
        reason,
      },
    }).catch(() => undefined);
  }

  async getDirectory(): Promise<{ success: boolean; data: UserSummary[] }> {
    const users = await this.prisma.user.findMany({
      include: {
        role: true,
        assignments: {
          include: {
            location: true,
          },
        },
      },
      orderBy: {
        fullName: "asc",
      },
    });

    return {
      success: true,
      data: users.map((record) => this.mapUser(record)),
    };
  }

  private mapUser(record: {
    id: string;
    fullName: string;
    email: string;
    tokenVersion: number;
    role: { name: PrismaUserRole };
    assignments: Array<{ location: { id: string; code: string; name: string } }>;
  }): AuthenticatedUser {
    return {
      id: record.id,
      fullName: record.fullName,
      email: record.email,
      role: record.role.name as UserRole,
      locations: record.assignments.map((assignment) => assignment.location),
      tokenVersion: record.tokenVersion,
    };
  }
}
