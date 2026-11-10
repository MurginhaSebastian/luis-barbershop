// Service worker del panel: solo muestra avisos push. Sin caché ni modo sin conexión.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Un aviso que no es JSON se muestra con el título genérico.
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "Nueva reserva", {
        body: data.body,
        icon: "/icon-192.png",
        lang: "es",
        data: { url: data.url || "/panel" },
      });
      // El panel abierto se refresca al momento en vez de esperar a su minuto.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: "push" });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/panel", self.location.origin);
  // Solo se abre la propia web, aunque el aviso dijera otra cosa.
  const url = target.origin === self.location.origin ? target.href : new URL("/panel", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const panel = windows.find((client) => new URL(client.url).pathname.startsWith("/panel"));
      // Ya abierto: basta con traerlo al frente, porque el aviso ya lo refrescó.
      if (panel) return panel.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
