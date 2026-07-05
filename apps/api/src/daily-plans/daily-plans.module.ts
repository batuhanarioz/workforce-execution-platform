import { Module } from "@nestjs/common";
import { DailyPlansController } from "./daily-plans.controller";
import { DailyPlansService } from "./daily-plans.service";
import { StateModule } from "../state/state.module";
import { AuthModule } from "../auth/auth.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
  imports: [StateModule, AuthModule, AuditLogsModule],
  controllers: [DailyPlansController],
  providers: [DailyPlansService],
  exports: [DailyPlansService],
})
export class DailyPlansModule {}
