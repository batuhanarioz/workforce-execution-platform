import { Body, Controller, Inject, Post, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { LocationGuard } from "../auth/guards/location.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole, type AuthenticatedUser } from "@wfp/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { DailyFactsService } from "../daily-facts/daily-facts.service";

@Controller("daily-facts")
@UseGuards(JwtAuthGuard, RolesGuard, LocationGuard)
export class ApprovalsController {
  constructor(@Inject(DailyFactsService) private readonly dailyFactsService: DailyFactsService) {}

  @Roles(UserRole.HEAD_OF_MASTER)
  @Post(":id/approve/head-master")
  headMasterApprove(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { comment?: string },
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyFactsService.approveHeadMaster(id, user, body.comment, {
      actor: user,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.SITE_CHIEF)
  @Post(":id/approve/site-chief")
  siteChiefApprove(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { comment?: string },
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyFactsService.approveSiteChief(id, user, body.comment, {
      actor: user,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.PROJECT_MANAGER)
  @Post(":id/approve/project-manager")
  projectManagerApprove(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { comment?: string },
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyFactsService.approveProjectManager(id, user, body.comment, {
      actor: user,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER)
  @Post(":id/return")
  returnForRevision(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { comment: string },
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyFactsService.returnForRevision(id, user, body.comment, {
      actor: user,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }

  @Roles(UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER, UserRole.ADMIN)
  @Post(":id/reject")
  reject(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { comment: string },
    @Req() request: { headers?: Record<string, string> }
  ) {
    return this.dailyFactsService.reject(id, user, body.comment, {
      actor: user,
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
      locationId: String(request.headers?.["x-user-location-id"] ?? "") || null,
    });
  }
}
