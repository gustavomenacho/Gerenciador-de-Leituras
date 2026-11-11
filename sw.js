// service worker do PageLog
// guarda os arquivos do site no aparelho pra ele abrir mesmo sem internet

const CACHE_NAME = "pagelog-v1";
const COVERS_CACHE = "pagelog-capas-online";

const FILES = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "js/main.js",
  "js/acoes.js",
  "js/capas.js",
  "js/constantes.js",
  "js/dados.js",
  "js/elementos.js",
  "js/estado.js",
  "js/formulario.js",
  "js/meta.js",
  "js/openlibrary.js",
  "js/pwa.js",
  "js/tela.js",
  "js/tema.js",
  "js/transferir.js",
  "js/utils.js",
  "fonts/fraunces.woff2",
  "fonts/fraunces-italic.woff2",
  "fonts/inter.woff2",
  "assets/pagelog.svg",
  "assets/favicon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png"
];

// instalacao: baixa e guarda todos os arquivos
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(FILES);
    })
  );
  self.skipWaiting(); // a versao nova ja comeca a valer
});

// ativacao: apaga caches de versoes antigas
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) {
            return name !== CACHE_NAME && name !== COVERS_CACHE;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// arquivos do site: tenta a internet primeiro (pra pegar a versao nova)
// e, se estiver sem internet, usa a copia guardada
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const saved = await cache.match(request, { ignoreSearch: true });
    if (saved) {
      return saved;
    }
    // abriu uma pagina (ex.: link com #importar) sem internet: mostra o index
    if (request.mode === "navigate") {
      return cache.match("index.html");
    }
    throw error;
  }
}

// capas da Open Library: usa a guardada se tiver, senao baixa e guarda
async function cacheFirst(request) {
  const cache = await caches.open(COVERS_CACHE);
  const saved = await cache.match(request);
  if (saved) {
    return saved;
  }
  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (url.hostname === "covers.openlibrary.org" || url.hostname.endsWith("archive.org")) {
    event.respondWith(cacheFirst(request));
  }
  // o resto (busca da Open Library) vai direto pra internet
});
