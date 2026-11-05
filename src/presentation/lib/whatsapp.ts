import { formatLongDate, formatTime } from "./format";

/** Enlace a un chat de WhatsApp con un primer mensaje ya escrito. */
export const whatsappLink = (number: string, text = "Hola, quiero reservar una cita en Luis Barbershop.") =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

interface AppointmentMessage {
  customerName: string;
  barberName: string;
  start: string;
}

export const confirmationMessage = ({ customerName, barberName, start }: AppointmentMessage) =>
  `Hola ${customerName}, tu cita en Luis Barbershop está confirmada: ${formatLongDate(start)} a las ${formatTime(start)} con ${barberName}. ¡Te esperamos!`;

export const cancellationMessage = ({ customerName, start }: AppointmentMessage) =>
  `Hola ${customerName}, tuvimos que cancelar tu cita en Luis Barbershop del ${formatLongDate(start)} a las ${formatTime(start)}. Escríbenos para buscar otra hora.`;
