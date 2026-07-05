import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { MasterDataService } from "./master-data.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole, type WbsImportPayload } from "@wfp/shared";

@Controller("master-data")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MasterDataController {
  constructor(@Inject(MasterDataService) private readonly masterDataService: MasterDataService) {}

  @Get()
  getSnapshot() {
    return this.masterDataService.getSnapshot();
  }

  @Roles(UserRole.ADMIN)
  @Post("import/wbs")
  importWbs(@Body() body: WbsImportPayload) {
    return this.masterDataService.importWbs(body);
  }
}
