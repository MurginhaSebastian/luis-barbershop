# Auditoría de noviembre de 2026

Revisión de la web completa tras el rediseño de la reserva.

## Resultados

| Control | Resultado |
|---|---|
| Lighthouse, portada | Rendimiento 94, accesibilidad 100, buenas prácticas 100, SEO 100 |
| Lighthouse, reservar | Rendimiento 97, accesibilidad 100, buenas prácticas 100, SEO 100 |
| axe (WCAG 2.1 AA) | Sin fallos graves ni críticos en la portada, los 4 pasos y la confirmación |
| `npm audit --omit=dev` | 0 vulnerabilidades en lo que se publica |
| Historial de git | Sin secretos, sin `.env` y sin datos personales |

## Corregido

- El menú no bajaba a su sección al llegar desde otra página.
- Los días anunciaban a lectores y control por voz un texto distinto del visible.
- Con la base caída se veía el error por defecto: ahora hay páginas de error y 404 de la marca.
- Faltaban cabeceras de seguridad.
- Postgres escuchaba en toda la red local.
- Algunos mensajes mostraban identificadores internos.
- El botón de WhatsApp tapaba horas en el móvil.
- La cita quedaba a nombre del primer cliente que usó ese celular.
- El formulario no decía para qué se usan los datos.

## Añadido después de la auditoría

Panel del barbero en `/panel`, con entrada por clave y pruebas de acceso sin sesión, cookie falsificada,
sesión caducada y freno de intentos. Las citas nuevas salen por confirmar y se avisa al cliente por
WhatsApp con un toque; el envío lo hace el barbero, no es automático.

## Pendiente antes de publicar

1. **Límite por IP.** El límite de 2 citas va por celular y se salta cambiando el número. Depende del
   hosting, porque hay que saber cómo llega la IP real.
2. **Política de privacidad.** Hay un aviso en el formulario, pero falta la página completa, que debe
   revisar el negocio o un abogado (Ley 29733).
3. **Datos reales.** Contacto, servicios, precios, fotos y Libro de Reclamaciones.
4. **Clave del panel de producción.** Generarla con `npm run panel:clave` en el hosting; la de desarrollo
   no debe usarse.

## Riesgos aceptados

- `npm audit` marca vulnerabilidades en herramientas de desarrollo (drizzle-kit, eslint-config-next,
  shadcn). No llegan a producción, y los arreglos que propone npm bajarían esas herramientas de versión.
- `script-src` usa `'unsafe-inline'`, porque las páginas prerenderizadas no admiten nonce.
- Dos reservas simultáneas del mismo celular podrían pasar el límite de 2 citas. La agenda sigue
  protegida: la base de datos impide los solapes.

## No revisado

- Comportamiento en un hosting real.
- Carga con muchos usuarios a la vez.
- Navegadores distintos de Edge y lectores de pantalla reales.
