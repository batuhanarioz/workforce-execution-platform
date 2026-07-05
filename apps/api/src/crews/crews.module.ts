import { Module } from "@nestjs/common";
import { CrewsController } from "./crews.controller";
import { CrewsService } from "./crews.service";
import { StateModule } from "../state/state.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [StateModule, AuthModule],
  controllers: [CrewsController],
  providers: [CrewsService],
  exports: [CrewsService],
})
export class CrewsModule {}
