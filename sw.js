/* InspectApp · Transformándonos — service worker
   Guarda la aplicación en el dispositivo para que abra sin señal.
   Los datos (Supabase) nunca se guardan acá: los maneja la app. */
const VERSION = 'ia-4.6.1';
const TILES = 'ia-tiles';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './banner.jpg',
  './proyectos.js', './fibra.js', './datacenter.js', './horas.js', './permisos.js', './vehiculos.js', './qrcode.js', './jsQR.js', './supabase.js', './leaflet.js', './leaflet.css', './jszip.min.js', './xlsx.full.min.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
  })());
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== TILES) await caches.delete(k);
    await self.clients.claim();
  })());
});

const timeout = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;                       // datos: siempre a la red

  if (req.mode === 'navigate'){                                            // la página: red primero (4 s), si no, la guardada
    e.respondWith((async () => {
      try {
        const r = await timeout(4000, fetch(req));
        if (r.ok){ const c = await caches.open(VERSION); c.put('./index.html', r.clone()); }
        return r;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  if (url.hostname.endsWith('tile.openstreetmap.org')){                  // mapa: lo ya visto queda disponible sin señal
    e.respondWith((async () => {
      const c = await caches.open(TILES);
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok || r.type === 'opaque'){
          c.put(req, r.clone());
          c.keys().then(ks => { if (ks.length > 1500) ks.slice(0, ks.length - 1500).forEach(k => c.delete(k)); });
        }
        return r;
      } catch { return Response.error(); }
    })());
    return;
  }

  if (url.origin === self.location.origin){   // archivos de la app y librerías
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: url.origin === self.location.origin });
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok){ const c = await caches.open(VERSION); c.put(req, r.clone()); }
      return r;
    })());
  }
});
