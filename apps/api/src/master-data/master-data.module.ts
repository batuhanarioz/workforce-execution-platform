import { Module } from "@nestjs/common";
import { MasterDataController } from "./master-data.controller";
import { MasterDataService } from "./master-data.service";
import { StateModule } from "../state/state.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [StateModule, AuthModule],
  controllers: [MasterDataController],
  providers: [MasterDataService],
  exports: [MasterDataService],
})
export class MasterDataModule {}
