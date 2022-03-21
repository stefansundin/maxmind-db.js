// Increment this number to trigger offline clients to update their caches:
// v2

self.addEventListener('install', e => {
  e.waitUntil(
    caches
      .open('maxmind-db.js')
      .then(c =>
        c.addAll([
          'https://cdn.jsdelivr.net/gh/stefansundin/maxmind-db.js@v0.0.4/dist/MaxMindDB.min.js',
          'https://cdn.jsdelivr.net/npm/bootstrap@4.6.1/dist/css/bootstrap.min.css',
          'https://cdn.jsdelivr.net/npm/bootstrap@4.6.1/dist/js/bootstrap.bundle.min.js',
          'https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.slim.min.js',
          'https://cdn.jsdelivr.net/gh/nodeca/pako@v2.0.4/dist/pako.min.js',
          'https://cdn.jsdelivr.net/gh/InvokIT/js-untar@v2.0.0/build/dist/untar.js',
          'https://cdn.jsdelivr.net/gh/Stuk/jszip@v3.7.1/dist/jszip.min.js',
          'demo.css',
          'demo.js',
          'icon.png',
        ]),
      ),
  );
});

self.addEventListener('fetch', e => {
  // console.log(e.request.url);
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
