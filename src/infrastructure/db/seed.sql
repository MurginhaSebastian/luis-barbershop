-- Datos de ejemplo para desarrollo (ficticios; precios en céntimos de sol). Se puede repetir sin duplicar.
INSERT INTO barbers (id, name) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Luis'),
  ('10000000-0000-4000-8000-000000000002', 'Barbero invitado')
ON CONFLICT DO NOTHING;

INSERT INTO services (id, name, duration_minutes, price_cents) VALUES
  ('20000000-0000-4000-8000-000000000001', 'Corte clásico', 30, 3000),
  ('20000000-0000-4000-8000-000000000002', 'Fade', 45, 3500),
  ('20000000-0000-4000-8000-000000000003', 'Perfilado de barba', 30, 2000),
  ('20000000-0000-4000-8000-000000000004', 'Cejas', 15, 1000)
ON CONFLICT DO NOTHING;

INSERT INTO products (id, name, price_cents) VALUES
  ('30000000-0000-4000-8000-000000000001', 'Cera mate', 3500),
  ('30000000-0000-4000-8000-000000000002', 'Aceite para barba', 4000),
  ('30000000-0000-4000-8000-000000000003', 'Shampoo para barba', 3000)
ON CONFLICT DO NOTHING;

-- Lunes (1) a sábado (6): 10:00–14:00 y 15:00–20:00.
INSERT INTO business_hours (weekday, open_minute, close_minute)
SELECT d, t.open_minute, t.close_minute
FROM generate_series(1, 6) AS d, (VALUES (600, 840), (900, 1200)) AS t(open_minute, close_minute)
ON CONFLICT DO NOTHING;
