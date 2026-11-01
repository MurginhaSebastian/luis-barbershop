/** Enlace a un chat de WhatsApp con un primer mensaje ya escrito. */
export const whatsappLink = (number: string, text = "Hola, quiero reservar una cita en Luis Barbershop.") =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
