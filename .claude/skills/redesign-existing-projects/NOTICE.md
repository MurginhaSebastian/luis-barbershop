# Adaptación local: redesign-existing-projects

`SKILL.md` está copiado tal cual, sin cambiar un byte. Lo aportó el dueño del proyecto el
30 de septiembre de 2026 y con ella se hizo el rediseño «Capas» de la web pública.

La skill es genérica: sirve para cualquier web. En AGP Desing mandan antes las reglas del
proyecto (`CLAUDE.md`), y algunas de sus propuestas **no se aplican aquí**, cada una por un
motivo comprobado:

| La skill propone | Aquí no, porque |
|---|---|
| Scroll suave con inercia («Smooth scroll with inertia») | Se investigó a fondo: cambia la respuesta de la rueda en toda la web, empeora el uso con teclado y lector de pantalla, y a quien pide menos movimiento. El scroll es el del navegador. |
| Fondos con `picsum.photos` u otras imágenes de relleno | Serían peticiones a un tercero en cada visita, y la política de privacidad promete que no hay ninguno. Se usan las fotos de los trabajos del taller. |
| Glassmorphism, bordes con foco de luz, texto que se rellena, parallax en pila | Son justo los efectos llamativos genéricos que la dirección «Capas» quiere evitar. La profundidad sale del papel superpuesto, no de efectos. |
| Aviso de cookies | La web no usa cookies de ningún tipo; se verificó. |
| Física de muelles en todos los elementos | Las reglas de movimiento del proyecto prohíben el rebote en la interfaz (ver `animate`). |
| Iconos Phosphor / Heroicons | La web pública usa un juego propio mínimo en SVG, del mismo trazo que los de redes sociales que ya existían. |

Lo que sí se aplicó de la skill: cambio de tipografía, fin de las etiquetas en mayúsculas,
composición distinta por sección, estados de carga y vacío, estados de hover y pulsado, y la
comprobación de los patrones genéricos de su auditoría.
