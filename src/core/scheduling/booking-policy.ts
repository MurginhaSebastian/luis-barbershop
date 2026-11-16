export const SLOT_STEP_MINUTES = 30;
/** Pocos minutos: el "cazador de huecos" puede tomar la hora de una cita en riesgo (faltan 15 min o menos). */
export const MIN_ADVANCE_MINUTES = 5;
/** Con menos antelación que esto no hay tiempo de pedir confirmación: la cita nace confirmada. */
export const BORN_CONFIRMED_UNDER_MINUTES = 120;
/** El cliente cancela solo con esta antelación; si aún no había confirmado, puede hasta la hora de la cita. */
export const CUSTOMER_CANCEL_MIN_MINUTES = 35;
export const MAX_DAYS_AHEAD = 14;
export const MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER = 2;
/** A los 35 min de la cita, si sigue pendiente, se le pide confirmar por WhatsApp. */
export const REMINDER_MINUTES_BEFORE = 35;
/** A los 15 min, si aún no confirmó, pasa a en riesgo: otro cliente puede tomar la hora. */
export const AT_RISK_MINUTES_BEFORE = 15;
// shortcut: offset fijo de Lima (sin horario de verano); usar una lib de zonas si se abre fuera de Perú.
export const SHOP_UTC_OFFSET_MINUTES = -300;
