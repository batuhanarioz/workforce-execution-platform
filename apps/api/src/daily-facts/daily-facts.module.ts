import { Module } from "@nestjs/common";
import { DailyFactsController } from "./daily-facts.controller";
import { DailyFactsService } from "./daily-facts.service";
import { StateModule } from "../state/state.module";
import { AuthModule } from "../auth/auth.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
  imports: [StateModule, AuthModule, AuditLogsModule],
  controllers: [DailyFactsController],
  providers: [DailyFactsService],
  exports: [DailyFactsService],
})
export class DailyFactsModule {}
