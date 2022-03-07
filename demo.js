// Please note that while MaxMindDB.js is licensed under the MIT license, this demo is licensed under AGPL v3 or later!
// If you develop a derivative of this demo, then please do not obfuscate the source code!

BigInt.prototype.toJSON = function () {
  return this.toString();
};

document.addEventListener('DOMContentLoaded', async event => {
  let db;
  let abortController;
  const dbForm = document.getElementById('db');
  const ipForm = document.getElementById('ip');
  const urlField = document.getElementById('url');
  const loadButton = document.getElementById('load');
  const cacheCheckbox = document.getElementById('cache');
  const clearCacheButton = document.getElementById('clearCache');
  const cacheInfo = document.getElementById('cacheInfo');
  const cacheExtra = document.getElementById('cacheExtra');
  const cacheList = document.getElementById('cacheList');
  const downloadButton = document.getElementById('download');
  const abortButton = document.getElementById('abort');
  const progressBar = document.getElementById('progress');
  const addrField = document.getElementById('addr');
  const lookupButton = document.getElementById('lookup');
  const language = document.getElementById('language');
  const expandIPv6Button = document.getElementById('expandIPv6');
  const clearLogButton = document.getElementById('clearLog');
  const logField = document.getElementById('log');
  const metadataField = document.getElementById('metadata');
  const fileBtn = document.getElementById('selectFile');
  const fileInput = document.getElementById('file');
  const dropzone = document.getElementById('dropzone');

  const script = document.querySelector(
    'script[src^="https://cdn.jsdelivr.net/gh/stefansundin/maxmind-db.js"]',
  );
  const scriptTag = document.getElementById('script-tag');
  scriptTag.textContent = `<script src="${script.src}" integrity="${script.integrity}" crossorigin="${script.crossOrigin}"></script>`;

  function log(s) {
    if (logField.value !== '') {
      s += `\n\n${logField.value}`;
    }
    logField.value = s;
  }

  function formatFilesize(bytes, digits = 1) {
    const units = ['B', 'kiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let i = 0;
    while (bytes > 1024 && i < units.length) {
      bytes = bytes / 1024;
      i++;
    }
    if (i < 2) {
      digits = 0;
    }
    const size = i > 0 ? bytes.toFixed(digits) : bytes;
    return `${size} ${units[i]}`;
  }

  function extractFilename(s) {
    try {
      const url = new URL(s);
      s = url.pathname;
    } catch {}
    const i = s.lastIndexOf('/');
    return s.substring(i + 1);
  }

  function normalizeExtensions(arr) {
    return arr.flatMap(ext => {
      if (ext === 'tgz') {
        return ['tar', 'gz'];
      } else if (ext === 'gzip') {
        return 'gz';
      }
      return ext;
    });
  }

  function filterNames(o, lang) {
    if (o instanceof Array) {
      return o.map(v => filterNames(v, lang));
    } else if (o instanceof Object) {
      if (o['names']) {
        o['name'] = o['names'][lang] || o['names']['en'];
        delete o['names'];
      } else {
        for (const [k, v] of Object.entries(o)) {
          o[k] = filterNames(v, lang);
        }
      }
    }
    return o;
  }

  async function load_database(file, source) {
    if (source) {
      urlField.value = '';
      urlField.placeholder = source;
    }

    try {
      file = await normalizeExtensions(
        file.name.split('.').slice(1),
      ).reduceRight(async (file, ext) => {
        file = await file;
        if (ext === 'gz') {
          const data = await pako.inflate(await file.arrayBuffer());
          file = new File([data], file.name.split('.').slice(0, -1).join('.'));
        } else if (ext === 'tar') {
          const files = await untar(await file.arrayBuffer());
          const f = files.find(f => f.name.endsWith('.mmdb'));
          if (!f) {
            return null;
          }
          file = await f.blob;
        } else if (ext === 'zip') {
          const zip = await JSZip.loadAsync(file);
          const f = Object.values(zip.files).find(
            f => !f.name.startsWith('__MACOSX/') && f.name.endsWith('.mmdb'),
          );
          if (!f) {
            return null;
          }
          file = await f.async('blob');
        }
        return file;
      }, Promise.resolve(file));

      if (!file) {
        throw new Error('Database was not found.');
      }

      const new_db = new MaxMindDB();
      await new_db.load(file);

      metadataField.value = JSON.stringify(new_db.metadata, null, 2);

      // Swap the database
      // If the user starts loading a second database, then it is still possible to make queries to the first one while the new one is loading
      db = new_db;

      const d = new Date(1000 * db.metadata.build_epoch);
      log(
        `Loaded a ${
          db.metadata.database_type
        } database that was built on ${d.getFullYear()}-${`0${
          d.getMonth() + 1
        }`.slice(-2)}-${`0${d.getDate()}`.slice(-2)}.`,
      );

      loadButton.classList.remove('btn-danger', 'btn-primary');
      loadButton.classList.add('btn-success');
      loadButton.value = 'Loaded';
      lookupButton.disabled = false;

      if (db.metadata.languages) {
        while (language.childElementCount > 1) {
          language.removeChild(language.lastChild);
        }
        for (const lang of db.metadata.languages) {
          const option = document.createElement('option');
          option.value = lang;
          option.appendChild(document.createTextNode(lang));
          language.appendChild(option);
        }
        if (
          localStorage.language &&
          db.metadata.languages.includes(localStorage.language)
        ) {
          language.value = localStorage.language;
        }
      }
    } catch (err) {
      console.error(err);
      log(err);
      loadButton.classList.remove('btn-primary', 'btn-success');
      loadButton.classList.add('btn-danger');
      loadButton.value = 'Error';
    }
  }

  urlField.addEventListener('input', e => {
    downloadButton.href = urlField.value;
  });
  downloadButton.href = urlField.value;

  document.querySelectorAll('.dropdown-item.form-inline').forEach(el =>
    el.addEventListener('click', e => {
      e.stopPropagation();
    }),
  );

  document.querySelectorAll('#example_addrs .dropdown-item').forEach(el => {
    el.addEventListener('click', e => {
      addrField.value = e.target.textContent;
      if (!lookupButton.disabled) {
        lookupButton.click();
      }
    });
  });

  fileInput.addEventListener('change', async e => {
    for (const file of e.target.files) {
      load_database(file, file.name);
    }
  });
  fileBtn.addEventListener('click', () => fileInput.click());

  clearCacheButton.addEventListener('click', async e => {
    await caches.delete('maxmind-databases');
  });
  abortButton.addEventListener('click', e => {
    e.preventDefault();
    abortController.abort();
  });
  dbForm.addEventListener('submit', async e => {
    e.preventDefault();
    loadButton.blur();
    document.body.click(); // close any dropdowns that might be open

    let cache, response;
    if (cacheCheckbox.checked) {
      cache = await caches.open('maxmind-databases');
      response = await cache.match(urlField.value);
    }

    loadButton.disabled = true;
    loadButton.value = 'Loading...';

    try {
      if (response) {
        const file = new File(
          [await response.blob()],
          extractFilename(response.url),
        );
        await load_database(file);

        progressBar.value = 1;
        progressBar.max = 1;
        progressBar.title = 'Loaded from cache';
        return;
      }

      abortController = new AbortController();
      abortButton.classList.remove('d-none');
      response = await fetch(urlField.value, {
        signal: abortController.signal,
        cache: cacheCheckbox.checked ? 'force-cache' : 'default',
      });
      if (!response.ok) {
        throw new Error(
          `Error fetching database: ${response.status} ${response.statusText}`,
        );
      }
      if (cache) {
        cache.put(urlField.value, response.clone());
      }

      // Render the progress bar
      const reader = response.body.getReader();
      const parts = [];
      progressBar.value = 0;
      progressBar.max = parseInt(response.headers.get('Content-Length'), 10);
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        parts.push(value);
        progressBar.value += value.length;
        progressBar.title = `${formatFilesize(
          progressBar.value,
        )} / ${formatFilesize(progressBar.max)} (${(
          (progressBar.value / progressBar.max) *
          100
        ).toFixed(1)}%)`;
      }

      const file = new File(parts, extractFilename(response.url));
      await load_database(file);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        loadButton.value = 'Load';
      } else {
        console.error(err);
        log(err.message);
        loadButton.value = 'Error!';
        loadButton.classList.add('btn-danger');
      }
    } finally {
      loadButton.disabled = false;
      abortButton.classList.add('d-none');
    }
  });

  window.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.remove('d-none');
  });

  window.addEventListener('dragleave', e => {
    if (e.relatedTarget) {
      return;
    }
    e.preventDefault();
    dropzone.classList.add('d-none');
  });

  window.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.add('d-none');

    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      if (e.dataTransfer.items[i].kind !== 'file') {
        continue;
      }
      const file = e.dataTransfer.items[i].getAsFile();
      load_database(file, file.name);
      break;
    }
  });

  ipForm.addEventListener('submit', e => {
    e.preventDefault();
    lookupButton.blur();
    document.body.click(); // close any dropdowns that might be open

    try {
      addrField.classList.remove('is-invalid');
      const addr = addrField.value;
      const result = db.get(addr);
      console.log(result);
      if (!result) {
        log(
          `Could not find ${addr} in the database. Perhaps it is a private IP address?`,
        );
        return;
      }
      let data = result[2];
      if (localStorage.language) {
        data = filterNames(data, localStorage.language);
      }
      log(`# ${addr}\n` + JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(err);
      log(`Error: ${err.message}.`);
      addrField.classList.add('is-invalid');
      return;
    }
  });

  expandIPv6Button.addEventListener('click', e => {
    let packed;
    try {
      addrField.classList.remove('is-invalid');
      packed = db.packIP(addrField.value);
    } catch (err) {
      console.error(err);
      log(`Error: ${err.message}.`);
      addrField.classList.add('is-invalid');
      return;
    }
    addrField.classList.remove('is-invalid');
    const view = new DataView(packed);
    if (packed.byteLength === 4) {
      let segments = [];
      for (let i = 0; i < 4; i++) {
        const value = view.getUint8(i, false);
        segments.push(value.toString(10));
      }
      addrField.value = segments.join('.');
    } else {
      let segments = [];
      for (let i = 0; i < 8; i++) {
        const value = view.getUint16(i * 2, false);
        segments.push(value.toString(16).padStart(4, '0'));
      }
      addrField.value = segments.join(':');
    }
  });

  clearLogButton.addEventListener('click', e => {
    logField.value = '';
  });

  async function loadCacheKey(key) {
    const cache = await caches.open('maxmind-databases');
    const response = await cache.match(key);
    if (!response) {
      return;
    }
    const file = new File(
      [await response.blob()],
      extractFilename(response.url),
    );
    load_database(file, key.url);
  }

  // Check if caches is supported
  if (window.caches) {
    $('#db-actions').on('show.bs.dropdown', async () => {
      while (cacheList.hasChildNodes()) {
        cacheList.removeChild(cacheList.firstChild);
      }
      const cache = await caches.open('maxmind-databases');
      const keys = await cache.keys();
      cacheExtra.classList.toggle('d-none', keys.length === 0);
      if (keys.length > 0) {
        clearCacheButton.disabled = false;
        keys.forEach((key, i) => {
          const url = new URL(key.url);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'dropdown-item';
          btn.title = key.url;
          btn.appendChild(
            document.createTextNode(
              `${i + 1}. ${url.pathname.split('/').pop()}`,
            ),
          );
          btn.addEventListener('click', () => loadCacheKey(key), false);
          cacheList.appendChild(btn);
        });
        const size = await Promise.all(
          keys.map(key =>
            cache.match(key).then(resp =>
              resp
                .clone()
                .blob()
                .then(b => b.size),
            ),
          ),
        ).then(sizes => sizes.reduce((acc, size) => acc + size, 0));
        cacheInfo.textContent = `${keys.length} ${
          keys.length === 1 ? 'entry' : 'entries'
        }, ${formatFilesize(size)}`;
      } else {
        cacheInfo.textContent = '';
        clearCacheButton.disabled = true;
      }
    });
  } else {
    cacheCheckbox.disabled = true;
  }
  if (localStorage.useCache !== undefined) {
    cacheCheckbox.checked = localStorage.useCache === 'true';
  }
  cacheCheckbox.addEventListener('input', e => {
    localStorage.useCache = e.currentTarget.checked;
  });

  language.addEventListener('input', () => {
    if (language.value === '') {
      delete localStorage.language;
    } else {
      localStorage.language = language.value;
    }
  });

  if (navigator.serviceWorker && document.location.protocol === 'https:') {
    const install_service_worker = document.getElementById(
      'install-service-worker',
    );
    install_service_worker.disabled = false;

    async function refresh_service_worker_info() {
      const registrations = await navigator.serviceWorker.getRegistrations();
      install_service_worker.textContent = `${
        registrations.length > 0 ? 'Uninstall' : 'Install'
      } service worker`;
    }
    refresh_service_worker_info();

    install_service_worker.addEventListener('click', async e => {
      e.preventDefault();
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        for (const registration of registrations) {
          await registration.unregister();
        }
        await caches.delete('maxmind-db.js');
      } else {
        await navigator.serviceWorker.register('service-worker.js');
      }
      refresh_service_worker_info();
    });
  }

  let deferredPrompt;
  const btn_a2hs = document.getElementById('a2hs');
  btn_a2hs.addEventListener('click', () => {
    btn_a2hs.disabled = true;
    deferredPrompt.prompt();
  });
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    btn_a2hs.disabled = false;
  });
});
