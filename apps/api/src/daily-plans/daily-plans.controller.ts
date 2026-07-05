import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { LocationGuard } from "../auth/guards/location.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { LocationScope } from "../auth/decorators/location-scope.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessScope, UserRole, type DailyPlanAssignInput, type DailyPlanCreateInput } from "@wfp/shared";
import { DailyPlansService } from "./daily-plans.service";

@Controller("daily-plans")
@UseGuards(JwtAuthGuard, RolesGuard, LocationGuard)
export class DailyPlansController {
  constructor(@Inject(DailyPlansService) private readonly dailyPlansService: DailyPlansService) {}

  @Roles(UserRole.TECH_OFFICE, UserRole.HEAD_OF_MASTER, UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER, UserRole.ADMIN)
  @LocationScope(AccessScope.ASSIGNED)
  @Get()
  list() {
    return this.dailyPlansService.list();
  }

  @Roles(UserRole.TECH_OFFICE, UserRole.ADMIN)
  @LocationScope(AccessScope.LOCATION)
  @Post()
  create(
    @Body() body: DailyPlanCreateInput,
    @CurrentUser() user: { id?: string; fullName?: string; email?: string; role?: string } | null,
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyPlansService.create(body, user?.id ?? "dev-user-1", {
      actor: user ? { id: user.id ?? "dev-user-1", fullName: user.fullName, email: user.email, role: user.role } : null,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.TECH_OFFICE, UserRole.HEAD_OF_MASTER, UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER, UserRole.ADMIN)
  @Get(":id")
  getById(@Param("id") id: string) {
    return this.dailyPlansService.getById(id);
  }

  @Roles(UserRole.TECH_OFFICE, UserRole.ADMIN)
  @LocationScope(AccessScope.LOCATION)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: Partial<DailyPlanCreateInput> & { note?: string },
    @CurrentUser() user: { id?: string; fullName?: string; email?: string; role?: string } | null,
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyPlansService.update(id, body, {
      actor: user ? { id: user.id ?? "dev-user-1", fullName: user.fullName, email: user.email, role: user.role } : null,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.TECH_OFFICE, UserRole.ADMIN)
  @Post(":id/assign")
  assign(
    @Param("id") id: string,
    @Body() body: DailyPlanAssignInput,
    @CurrentUser() user: { id?: string; fullName?: string; email?: string; role?: string } | null,
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyPlansService.assign(id, body, {
      actor: user ? { id: user.id ?? "dev-user-1", fullName: user.fullName, email: user.email, role: user.role } : null,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.TECH_OFFICE, UserRole.ADMIN)
  @Post(":id/cancel")
  cancel(
    @Param("id") id: string,
    @CurrentUser() user: { id?: string; fullName?: string; email?: string; role?: string } | null,
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyPlansService.cancel(id, {
      actor: user ? { id: user.id ?? "dev-user-1", fullName: user.fullName, email: user.email, role: user.role } : null,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.ADMIN)
  @Post(":id/start")
  startWork(
    @Param("id") id: string,
    @CurrentUser() user: { id?: string; fullName?: string; email?: string; role?: string } | null,
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyPlansService.startWork(id, {
      actor: user ? { id: user.id ?? "dev-user-1", fullName: user.fullName, email: user.email, role: user.role } : null,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }
}
