import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@wfp/shared";
import { AuditLogsService } from "./audit-logs.service";

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogsController {
  constructor(@Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService) {}

  @Roles(UserRole.TECH_OFFICE, UserRole.HEAD_OF_MASTER, UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER, UserRole.ADMIN)
  @Get()
  list(
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("userId") userId?: string,
    @Query("role") role?: string,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("action") action?: string,
    @Query("source") source?: string,
    @Query("search") search?: string,
    @Query("limit") limit?: string,
    @Query("page") page?: string
  ) {
    return this.auditLogsService.list({
      dateFrom,
      dateTo,
      userId,
      role,
      entityType,
      entityId,
      action,
      source,
      search,
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
    });
  }
}
