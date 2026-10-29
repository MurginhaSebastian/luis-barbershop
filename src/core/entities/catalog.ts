/** Precios en céntimos de sol (PEN) para no operar con decimales. */
export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
}

export interface Barber {
  id: string;
  name: string;
  active: boolean;
}
