import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@wfp/shared";
import { Roles } from "../auth/decorators/roles.decorator";
import { ReportsService } from "./reports.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService
  ) {}

  @Roles(UserRole.TECH_OFFICE, UserRole.HEAD_OF_MASTER, UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER, UserRole.ADMIN)
  @Get("daily")
  daily(
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("locationId") locationId?: string,
    @Query("projectId") projectId?: string,
    @Query("typeOfWorkId") typeOfWorkId?: string,
    @Query("subTypeOfWorkId") subTypeOfWorkId?: string,
    @Query("subSubTypeOfWorkId") subSubTypeOfWorkId?: string,
    @CurrentUser() user?: { id?: string; fullName?: string; email?: string; role?: string } | null,
    @Req() request?: { headers?: Record<string, string> }
  ) {
    const response = this.reportsService.daily({ dateFrom, dateTo, locationId, projectId, typeOfWorkId, subTypeOfWorkId, subSubTypeOfWorkId });
    void response
      .then((result) => {
        if (!user) {
          return;
        }

        void this.auditLogsService
          .record({
            actor: user ? { id: user.id ?? "dev-user-1", fullName: user.fullName, email: user.email, role: user.role } : { id: "dev-user-1" },
            entityType: "report",
            entityId: "daily",
            action: "REPORT_VIEWED",
            source: String(request?.headers?.["x-client-platform"] ?? "api"),
            requestId: String(request?.headers?.["x-request-id"] ?? ""),
            locationId: locationId ?? null,
            newValue: {
              filters: { dateFrom, dateTo, locationId, projectId, typeOfWorkId, subTypeOfWorkId, subSubTypeOfWorkId },
              rowCount: result.data.summary.rowCount,
            },
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);
    return response;
  }

  @Roles(UserRole.TECH_OFFICE, UserRole.HEAD_OF_MASTER, UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER, UserRole.ADMIN)
  @Get("kpis")
  kpis(
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("locationId") locationId?: string,
    @Query("projectId") projectId?: string,
    @Query("typeOfWorkId") typeOfWorkId?: string,
    @Query("subTypeOfWorkId") subTypeOfWorkId?: string,
    @Query("subSubTypeOfWorkId") subSubTypeOfWorkId?: string,
    @CurrentUser() user?: { id?: string; fullName?: string; email?: string; role?: string } | null,
    @Req() request?: { headers?: Record<string, string> }
  ) {
    const response = this.reportsService.kpis({ dateFrom, dateTo, locationId, projectId, typeOfWorkId, subTypeOfWorkId, subSubTypeOfWorkId });
    void response
      .then((result) => {
        if (!user) {
          return;
        }

        void this.auditLogsService
          .record({
            actor: user ? { id: user.id ?? "dev-user-1", fullName: user.fullName, email: user.email, role: user.role } : { id: "dev-user-1" },
            entityType: "report",
            entityId: "kpis",
            action: "REPORT_VIEWED",
            source: String(request?.headers?.["x-client-platform"] ?? "api"),
            requestId: String(request?.headers?.["x-request-id"] ?? ""),
            locationId: locationId ?? null,
            newValue: {
              filters: { dateFrom, dateTo, locationId, projectId, typeOfWorkId, subTypeOfWorkId, subSubTypeOfWorkId },
              summary: result.data,
            },
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);
    return response;
  }
}
