/**
 * Service Worker - EconoSP PWA
 * Versão do Cache: econosp-shell-v1.0.0
 * 
 * Estratégia de Isolamento:
 * - Supabase Auth, DB e Storage: NETWORK ONLY (NUNCA armazena tokens ou dados no cache)
 * - App Shell e Assets: Stale-While-Revalidate
 * - CDNs Fixos (Leaflet, Supabase Client JS): Cache-First
 * - Navegação Offline: Fallback para offline.html
 */

const CACHE_NAME = 'econosp-shell-v1.0.0';
const TILE_CACHE_NAME = 'econosp-tiles-v1';
const MAX_TILE_CACHE = 80;

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './offline.html',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/apple-touch-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Instalação do Service Worker e pré-cache do App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[EconoSP SW] Falha ao pré-cachear alguns assets não críticos:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza automática de versões legadas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== TILE_CACHE_NAME) {
            console.log('[EconoSP SW] Removendo cache legado:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação inteligente de requisições de rede
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. ISOLAMENTO TOTAL DO SUPABASE: Network Only absoluto (autenticação e banco de dados)
  if (url.hostname.includes('supabase.co') || req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }

  // 2. APIs DINÂMICAS DE ROTEAMENTO (OSRM e Nominatim Geocoding): Rede primeiro
  if (url.hostname.includes('project-osrm.org') || url.hostname.includes('openstreetmap.org') && url.pathname.includes('/search')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(JSON.stringify({ error: 'offline', message: 'Sem conexão com a internet para calcular nova rota.' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503
        });
      })
    );
    return;
  }

  // 3. TILES DO MAPA (OpenStreetMap e Esri): Cache LRU limitado para economizar armazenamento
  if (url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('arcgisonline.com') || url.hostname.includes('opentopomap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) => {
        return cache.match(req).then((cachedResponse) => {
          const fetchPromise = fetch(req).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(req, networkResponse.clone());
              limitCacheSize(TILE_CACHE_NAME, MAX_TILE_CACHE);
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 4. REQUISIÇÕES DE NAVEGAÇÃO (Páginas HTML): Stale-While-Revalidate com Fallback Offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(req).then((cachedPage) => {
            return cachedPage || caches.match('./offline.html');
          });
        })
    );
    return;
  }

  // 5. ASSETS DO APP SHELL E CDNs: Stale-While-Revalidate padrão
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      }).catch((err) => {
        // Falha de rede silenciosa para assets estáticos já servidos do cache
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Função auxiliar para restringir o tamanho do cache de tiles no dispositivo móvel
function limitCacheSize(cacheName, maxItems) {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => limitCacheSize(cacheName, maxItems));
      }
    });
  });
}
