import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { LocationGuard } from "../auth/guards/location.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { LocationScope } from "../auth/decorators/location-scope.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessScope, UserRole, type DailyFactCreateInput } from "@wfp/shared";
import { DailyFactsService } from "./daily-facts.service";

@Controller("daily-facts")
@UseGuards(JwtAuthGuard, RolesGuard, LocationGuard)
export class DailyFactsController {
  constructor(@Inject(DailyFactsService) private readonly dailyFactsService: DailyFactsService) {}

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER, UserRole.ADMIN)
  @LocationScope(AccessScope.ASSIGNED)
  @Get()
  list() {
    return this.dailyFactsService.list();
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.ADMIN)
  @LocationScope(AccessScope.ASSIGNED)
  @Get("plan/:planId")
  getByPlanId(@Param("planId") planId: string) {
    return this.dailyFactsService.getByPlanId(planId);
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.ADMIN)
  @LocationScope(AccessScope.ASSIGNED)
  @Post("draft/:planId")
  draft(
    @Param("planId") planId: string,
    @Body() body: Partial<DailyFactCreateInput>,
    @CurrentUser() user: { id: string } | null,
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyFactsService.draft(planId, body, user?.id ?? "dev-user-1", {
      actor: user ?? null,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.ADMIN)
  @LocationScope(AccessScope.ASSIGNED)
  @Post("submit/:planId")
  submit(
    @Param("planId") planId: string,
    @Body() body: DailyFactCreateInput,
    @CurrentUser() user: { id: string } | null,
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyFactsService.submit(planId, body, user?.id ?? "dev-user-1", {
      actor: user ?? null,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.ADMIN)
  @LocationScope(AccessScope.ASSIGNED)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: Partial<DailyFactCreateInput>,
    @CurrentUser() user: { id?: string; fullName?: string; email?: string; role?: string } | null,
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyFactsService.update(id, body, {
      actor: user ? { id: user.id ?? "dev-user-1", fullName: user.fullName, email: user.email, role: user.role } : null,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER, UserRole.ADMIN)
  @Get(":id")
  getById(@Param("id") id: string) {
    return this.dailyFactsService.getById(id);
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER, UserRole.ADMIN)
  @Get(":id/approval-history")
  history(@Param("id") id: string) {
    return this.dailyFactsService.history(id);
  }
}
