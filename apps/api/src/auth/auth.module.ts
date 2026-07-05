import { forwardRef, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { LocationGuard } from "./guards/location.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
  imports: [PrismaModule, forwardRef(() => AuditLogsModule)],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, LocationGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, LocationGuard],
})
export class AuthModule {}
