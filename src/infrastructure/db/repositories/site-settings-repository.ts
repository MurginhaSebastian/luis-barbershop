import { eq } from "drizzle-orm";
import type { ISiteSettingsRepository } from "@/application/ports/repositories/site-settings-repository";
import { readSiteSettings, type SiteSettings } from "@/core/entities/site";
import type { Db } from "../client";
import { siteSettings } from "../schema";

const ROW = 1;

export class DrizzleSiteSettingsRepository implements ISiteSettingsRepository {
  constructor(private readonly db: Db) {}

  async get(): Promise<SiteSettings> {
    const [row] = await this.db.select().from(siteSettings).where(eq(siteSettings.id, ROW));
    return readSiteSettings(row?.data);
  }

  async save(settings: SiteSettings): Promise<void> {
    await this.db
      .insert(siteSettings)
      .values({ id: ROW, data: settings })
      .onConflictDoUpdate({ target: siteSettings.id, set: { data: settings, updatedAt: new Date() } });
  }
}
