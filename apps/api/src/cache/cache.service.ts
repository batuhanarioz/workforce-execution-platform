import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;
  private available = false;

  async onModuleInit() {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.client.on("error", (error) => {
      if (this.available) {
        this.logger.warn(`Redis connection lost: ${error.message}`);
      }
      this.available = false;
    });
    try {
      await this.client.connect();
      this.available = true;
      this.logger.log(`Connected to Redis at ${url}`);
    } catch (error) {
      this.available = false;
      this.logger.warn(`Redis unavailable, continuing without cache: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.available || !this.client) {
      return null;
    }
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.available || !this.client) {
      return;
    }
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // Cache is a best-effort optimization; failures should never break a request.
    }
  }

  async del(pattern: string): Promise<void> {
    if (!this.available || !this.client) {
      return;
    }
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // Cache is a best-effort optimization; failures should never break a request.
    }
  }
}
