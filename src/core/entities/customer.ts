export interface Customer {
  id: string;
  name: string;
  /** Normalizado con normalizePhone: es la clave para reconocer al cliente sin cuenta. */
  phone: string;
}

/** Deja solo dígitos y antepone el 51 a los móviles peruanos de 9 dígitos. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return /^9\d{8}$/.test(digits) ? `51${digits}` : digits;
}
