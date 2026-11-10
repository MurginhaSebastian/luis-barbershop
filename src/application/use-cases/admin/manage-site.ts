import type { IImageOptimizer, IImageStorage } from "@/application/ports/images";
import type { IServiceRepository } from "@/application/ports/repositories/service-repository";
import type { ISiteSettingsRepository } from "@/application/ports/repositories/site-settings-repository";
import { assertValidImage } from "@/core/entities/image";
import { assertValidContact, type ImageSlot, type ShopContact, type SiteSettings } from "@/core/entities/site";
import { InvalidImageError, NotFoundError } from "@/core/errors/domain-errors";

export interface ManageSiteDeps {
  siteSettings: ISiteSettingsRepository;
  services: IServiceRepository;
  /** null: este servidor no tiene dónde guardar fotos (producción sin Supabase). */
  images: IImageStorage | null;
  imageOptimizer: IImageOptimizer;
}

/** Lo que la portada muestra: contacto, secciones visibles y fotos. */
export class ManageSiteUseCase {
  constructor(private readonly deps: ManageSiteDeps) {}

  get canUploadImages(): boolean {
    return this.deps.images !== null;
  }

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

  async setImage(slot: ImageSlot, bytes: Uint8Array): Promise<void> {
    const url = await this.store(bytes);
    const settings = await this.get();
    await this.deps.siteSettings.save({ ...settings, images: { ...settings.images, [slot]: url } });
    await this.discard(settings.images[slot]);
  }

  /** Vuelve a la foto de ejemplo de la web. */
  async removeImage(slot: ImageSlot): Promise<void> {
    const settings = await this.get();
    const images = { ...settings.images };
    const old = images[slot];
    delete images[slot];
    await this.deps.siteSettings.save({ ...settings, images });
    await this.discard(old);
  }

  async setServiceImage(serviceId: string, bytes: Uint8Array): Promise<void> {
    const service = await this.findService(serviceId);
    const url = await this.store(bytes);
    await this.deps.services.save({ ...service, imageUrl: url });
    await this.discard(service.imageUrl);
  }

  async removeServiceImage(serviceId: string): Promise<void> {
    const service = await this.findService(serviceId);
    await this.deps.services.save({ ...service, imageUrl: null });
    await this.discard(service.imageUrl);
  }

  private async findService(id: string) {
    const [service] = await this.deps.services.findByIds([id]);
    if (!service) throw new NotFoundError("El servicio");
    return service;
  }

  /** Valida, reduce a WebP y guarda con un nombre nuevo: cambiar de foto cambia la URL y no hay caché vieja. */
  private async store(bytes: Uint8Array): Promise<string> {
    if (!this.deps.images) throw new InvalidImageError("Este servidor aún no tiene dónde guardar fotos.");
    assertValidImage(bytes);
    const webp = await this.deps.imageOptimizer.toWebp(bytes).catch(() => {
      throw new InvalidImageError("No se pudo leer la foto. Prueba con otra.");
    });
    return this.deps.images.save(`${crypto.randomUUID()}.webp`, webp);
  }

  private async discard(url: string | null | undefined): Promise<void> {
    if (!url || !this.deps.images) return;
    // shortcut: si el borrado falla, la foto vieja queda huérfana en el almacenamiento; limpiar si crece.
    await this.deps.images.remove(url).catch(() => {});
  }
}
