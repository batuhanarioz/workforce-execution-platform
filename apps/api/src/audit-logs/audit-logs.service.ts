import { Inject, Injectable } from "@nestjs/common";
import { Prisma, UserRole as PrismaUserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  type AuditAction,
  type AuditEntityType,
  type AuditLogPageInfo,
  type AuditLogQuery,
  type AuditLogRecord,
  type AuditSource,
  type AuditActorSummary,
} from "@wfp/shared";

export type AuditContext = {
  actor?: AuditActorSummary | null;
  source?: AuditSource | string;
  requestId?: string | null;
  locationId?: string | null;
};

type AuditLogInput = {
  actor?: AuditActorSummary | null;
  entityType: AuditEntityType | string;
  entityId: string;
  action: AuditAction | string;
  source?: AuditSource | string;
  locationId?: string | null;
  requestId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizeRole(role: unknown) {
  return typeof role === "string" && role.length > 0 ? role : undefined;
}

@Injectable()
export class AuditLogsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: AuditLogInput): Promise<AuditLogRecord> {
    if (input.actor?.id) {
      const row = await this.prisma.auditLog.create({
        data: {
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          oldValue: input.oldValue === undefined ? undefined : (input.oldValue as never),
          newValue: input.newValue === undefined ? undefined : (input.newValue as never),
          source: input.source ?? "api",
          locationId: input.locationId ?? null,
          requestId: input.requestId ?? null,
          user: {
            connect: {
              id: input.actor.id,
            },
          },
        },
        include: {
          user: {
            include: {
              role: true,
            },
          },
        },
      });

      return this.mapRow(row);
    }

    const inserted = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "audit_logs" (
        "userId",
        "entityType",
        "entityId",
        "action",
        "source",
        "locationId",
        "requestId",
        "oldValue",
        "newValue"
      )
      VALUES (
        NULL,
        ${input.entityType},
        ${input.entityId},
        ${input.action},
        ${input.source ?? "api"},
        ${input.locationId ?? null},
        ${input.requestId ?? null},
        ${input.oldValue === undefined ? null : JSON.stringify(input.oldValue)},
        ${input.newValue === undefined ? null : JSON.stringify(input.newValue)}
      )
      RETURNING "id";
    `;

    const row = await this.prisma.auditLog.findUnique({
      where: {
        id: inserted[0]?.id ?? "",
      },
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!row) {
      throw new Error("Failed to load created audit log.");
    }

    return this.mapRow(row);
  }

  async list(
    query: AuditLogQuery = {}
  ): Promise<{ success: true; data: AuditLogRecord[]; pageInfo: AuditLogPageInfo }> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const page = Math.max(query.page ?? 1, 1);
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query);

    const [totalCount, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            include: {
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
    ]);

    const data = rows.map((row) => this.mapRow(row));
    return {
      success: true,
      data,
      pageInfo: {
        page,
        limit,
        totalCount,
        hasMore: skip + data.length < totalCount,
      },
    };
  }

  private buildWhere(query: AuditLogQuery): Prisma.AuditLogWhereInput {
    const search = query.search?.trim();
    const normalizedSearch = search && search.length > 0 ? search : undefined;
    return {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.role
        ? {
            user: {
              is: {
                role: {
                  name: query.role as PrismaUserRole,
                },
              },
            },
          }
        : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { entityType: { contains: normalizedSearch, mode: "insensitive" } },
              { entityId: { contains: normalizedSearch, mode: "insensitive" } },
              { action: { contains: normalizedSearch, mode: "insensitive" } },
              { source: { contains: normalizedSearch, mode: "insensitive" } },
              {
                user: {
                  is: {
                    OR: [
                      { fullName: { contains: normalizedSearch, mode: "insensitive" } },
                      { email: { contains: normalizedSearch, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private mapRow(row: {
    id: string;
    userId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    oldValue: unknown;
    newValue: unknown;
    source: string;
    locationId: string | null;
    requestId: string | null;
    createdAt: Date;
    user?: {
      id: string;
      fullName: string;
      email: string;
      role?: { name: string } | null;
    } | null;
  }): AuditLogRecord {
    return {
      id: row.id,
      userId: row.userId,
      user: row.user
        ? {
            id: row.user.id,
            fullName: row.user.fullName,
            email: row.user.email,
            role: normalizeRole(row.user.role?.name),
          }
        : null,
      actorRole: normalizeRole(row.user?.role?.name),
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      oldValue: row.oldValue ?? null,
      newValue: row.newValue ?? null,
      source: row.source,
      locationId: row.locationId,
      requestId: row.requestId,
      createdAt: toIso(row.createdAt),
    };
  }
}
