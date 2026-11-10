import type { SiteSettings } from "@/core/entities/site";

export interface ISiteSettingsRepository {
  /** Siempre completo: lo que no se haya guardado vale lo de DEFAULT_SITE_SETTINGS. */
  get(): Promise<SiteSettings>;
  save(settings: SiteSettings): Promise<void>;
}
