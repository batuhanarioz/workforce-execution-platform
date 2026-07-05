import { Inject, Injectable, Optional } from "@nestjs/common";
import { DataStateService } from "../state/data-state.service";
import { CacheService } from "../cache/cache.service";
import { WbsImportPayload } from "@wfp/shared";

const SNAPSHOT_CACHE_KEY = "master-data:snapshot";
const SNAPSHOT_CACHE_TTL_SECONDS = 300;

@Injectable()
export class MasterDataService {
  constructor(
    @Inject(DataStateService) private readonly state: DataStateService,
    @Optional() private readonly cache?: CacheService
  ) {}

  async getSnapshot() {
    const cached = await this.cache?.get(SNAPSHOT_CACHE_KEY);
    if (cached) {
      return { success: true, data: cached };
    }

    const data = await this.state.getMasterData();
    await this.cache?.set(SNAPSHOT_CACHE_KEY, data, SNAPSHOT_CACHE_TTL_SECONDS);

    return { success: true, data };
  }

  async importWbs(payload: WbsImportPayload) {
    const data = await this.state.importWbs(payload);
    await this.cache?.del(SNAPSHOT_CACHE_KEY);

    return { success: true, data };
  }
}
