export const SLOT_STEP_MINUTES = 30;
/** Pocos minutos: el "cazador de huecos" puede tomar la hora de una cita en riesgo (faltan 15 min o menos). */
export const MIN_ADVANCE_MINUTES = 5;
/** Con menos antelación que esto no hay tiempo de pedir confirmación: la cita nace confirmada. */
export const BORN_CONFIRMED_UNDER_MINUTES = 120;
/** El cliente cancela solo con esta antelación; si aún no había confirmado, puede hasta la hora de la cita. */
export const CUSTOMER_CANCEL_MIN_MINUTES = 35;
export const MAX_DAYS_AHEAD = 14;
export const MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER = 2;
/** Plazo para confirmar por WhatsApp: 2 h tras reservar, y como tarde 1 h antes de la cita. */
export const CONFIRM_WITHIN_MINUTES = 120;
export const CONFIRM_BEFORE_START_MINUTES = 60;
// shortcut: offset fijo de Lima (sin horario de verano); usar una lib de zonas si se abre fuera de Perú.
export const SHOP_UTC_OFFSET_MINUTES = -300;
