import { SHOP_NAME } from "@/core/entities/site";
import { formatLongDate, formatTime } from "./format";

/** Enlace a un chat de WhatsApp con un primer mensaje ya escrito. */
export const whatsappLink = (number: string, text = `Hola, quiero reservar una cita en ${SHOP_NAME}.`) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

interface AppointmentMessage {
  customerName: string;
  barberName: string;
  start: string;
}

export const confirmationMessage = ({ customerName, barberName, start }: AppointmentMessage) =>
  `Hola ${customerName}, tu cita en ${SHOP_NAME} está confirmada: ${formatLongDate(start)} a las ${formatTime(start)} con ${barberName}. ¡Te esperamos!`;

export const cancellationMessage = ({ customerName, start }: AppointmentMessage) =>
  `Hola ${customerName}, tuvimos que cancelar tu cita en ${SHOP_NAME} del ${formatLongDate(start)} a las ${formatTime(start)}. Escríbenos para buscar otra hora.`;

/** Primer mensaje neutro para una cita que aún no está confirmada: no afirma nada que no sea cierto. */
export const contactMessage = ({ customerName, start }: AppointmentMessage) =>
  `Hola ${customerName}, te escribo de ${SHOP_NAME} por tu cita del ${formatLongDate(start)} a las ${formatTime(start)}.`;
