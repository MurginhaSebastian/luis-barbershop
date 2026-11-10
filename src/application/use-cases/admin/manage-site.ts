import type { ISiteSettingsRepository } from "@/application/ports/repositories/site-settings-repository";
import { assertValidContact, type ShopContact, type SiteSettings } from "@/core/entities/site";

/** Lo que la portada muestra: contacto, secciones visibles y fotos. */
export class ManageSiteUseCase {
  constructor(private readonly deps: { siteSettings: ISiteSettingsRepository }) {}

  get(): Promise<SiteSettings> {
    return this.deps.siteSettings.get();
  }

  async saveContact(contact: ShopContact): Promise<void> {
    assertValidContact(contact);
    const settings = await this.get();
    await this.deps.siteSettings.save({ ...settings, contact });
  }

  async saveSections(sections: SiteSettings["sections"]): Promise<void> {
    const settings = await this.get();
    await this.deps.siteSettings.save({ ...settings, sections });
  }
}
