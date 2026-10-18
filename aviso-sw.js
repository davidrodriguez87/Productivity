// Aviso diario de Productivity: lo manda el GitHub del usuario cada mañana.
// Pone el número del día en el icono y muestra la notificación (iOS no deja hacerlo en silencio).
self.addEventListener('push', (evento) => {
  let datos = {}
  try {
    datos = evento.data ? evento.data.json() : {}
  } catch (e) {
    datos = {}
  }
  const n = datos.notification || {}
  const numero = Number(n.app_badge ?? datos.app_badge)
  const tareas = []
  if (Number.isFinite(numero) && self.navigator && self.navigator.setAppBadge) {
    tareas.push((numero > 0 ? self.navigator.setAppBadge(numero) : self.navigator.clearAppBadge()).catch(() => {}))
  }
  tareas.push(
    self.registration.showNotification(n.title || 'Productivity', {
      body: n.body || '',
      icon: 'icon-192.png',
      tag: 'aviso-diario',
      data: { url: n.navigate || self.registration.scope },
    }),
  )
  evento.waitUntil(Promise.all(tareas))
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = (evento.notification.data && evento.notification.data.url) || self.registration.scope
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) if ('focus' in v) return v.focus()
      return self.clients.openWindow(url)
    }),
  )
})
