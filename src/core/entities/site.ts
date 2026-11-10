import { InvalidSettingsError } from "../errors/domain-errors";

/** Datos de contacto del negocio; lo que falte no se muestra en la web. */
export interface ShopContact {
  /** 51 + 9 dígitos, listo para wa.me. */
  whatsapp?: string;
  address?: string;
  mapsUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  complaintsUrl?: string;
}

export const CONTACT_URL_FIELDS = ["mapsUrl", "instagramUrl", "facebookUrl", "tiktokUrl", "complaintsUrl"] as const;

/** Secciones de la portada que el barbero puede ocultar. Servicios y reserva siempre se ven. */
export const SITE_SECTIONS = ["about", "whyUs", "howToBook", "products", "visit"] as const;
export type SiteSection = (typeof SITE_SECTIONS)[number];

/** Huecos de foto de la portada. */
export const IMAGE_SLOTS = ["hero", "about", "products", "closing"] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number];

export interface SiteSettings {
  contact: ShopContact;
  sections: Record<SiteSection, boolean>;
  images: Partial<Record<ImageSlot, string>>;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  contact: {},
  sections: { about: true, whyUs: true, howToBook: true, products: true, visit: true },
  images: {},
};

const MAX_ADDRESS = 200;
const MAX_URL = 500;

export function assertValidContact(contact: ShopContact) {
  if (contact.whatsapp !== undefined && !/^51\d{9}$/.test(contact.whatsapp)) {
    throw new InvalidSettingsError("El WhatsApp debe ser un celular peruano de 9 dígitos.");
  }
  if (contact.address !== undefined && (contact.address.trim() === "" || contact.address.length > MAX_ADDRESS)) {
    throw new InvalidSettingsError("La dirección no es válida.");
  }
  for (const field of CONTACT_URL_FIELDS) {
    const value = contact[field];
    // Solo https: un enlace "javascript:" en la web sería código ejecutado en el navegador del cliente.
    if (value !== undefined && !isHttpsUrl(value)) {
      throw new InvalidSettingsError("Los enlaces deben empezar por https://.");
    }
  }
}

function isHttpsUrl(value: string): boolean {
  if (value.length > MAX_URL) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Lee lo guardado sin fiarse: lo que falte o no encaje vuelve al valor por defecto. */
export function readSiteSettings(raw: unknown): SiteSettings {
  const stored = isRecord(raw) ? raw : {};
  const contact: ShopContact = {};
  if (isRecord(stored.contact)) {
    for (const [key, value] of Object.entries(stored.contact)) {
      if (typeof value === "string" && value) contact[key as keyof ShopContact] = value;
    }
    try {
      assertValidContact(contact);
    } catch {
      return { ...DEFAULT_SITE_SETTINGS, sections: readSections(stored.sections), images: readImages(stored.images) };
    }
  }
  return { contact, sections: readSections(stored.sections), images: readImages(stored.images) };
}

function readSections(raw: unknown): SiteSettings["sections"] {
  const stored = isRecord(raw) ? raw : {};
  return Object.fromEntries(
    SITE_SECTIONS.map((s) => [s, typeof stored[s] === "boolean" ? stored[s] : DEFAULT_SITE_SETTINGS.sections[s]]),
  ) as SiteSettings["sections"];
}

function readImages(raw: unknown): SiteSettings["images"] {
  const stored = isRecord(raw) ? raw : {};
  return Object.fromEntries(IMAGE_SLOTS.flatMap((s) => (typeof stored[s] === "string" ? [[s, stored[s]]] : [])));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
