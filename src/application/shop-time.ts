const dateTime = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Fecha y hora de una cita como se lee en un aviso o un mensaje: "lun, 16 nov, 10:00", en hora de Lima. */
export const shopDateTime = (date: Date) => dateTime.format(date);
