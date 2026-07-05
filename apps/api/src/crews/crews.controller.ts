import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { LocationGuard } from "../auth/guards/location.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UserRole, type CrewCreateInput, type WorkerAssignmentCreateInput } from "@wfp/shared";
import { CrewsService } from "./crews.service";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, LocationGuard)
export class CrewsController {
  constructor(@Inject(CrewsService) private readonly crewsService: CrewsService) {}

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.ADMIN)
  @Get("crews")
  listCrews() {
    return this.crewsService.list();
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.ADMIN)
  @Post("crews")
  createCrew(@Body() body: CrewCreateInput) {
    return this.crewsService.create(body);
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.ADMIN)
  @Get("worker-assignments")
  listAssignments() {
    return this.crewsService.listAssignments();
  }

  @Roles(UserRole.HEAD_OF_MASTER, UserRole.ADMIN)
  @Post("worker-assignments")
  createAssignment(
    @Body() body: WorkerAssignmentCreateInput,
    @CurrentUser() user: { id?: string } | null
  ) {
    return this.crewsService.createAssignment(body, user?.id ?? "dev-user-1");
  }
}
