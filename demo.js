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

  async function load_database(data, filename) {
    if (filename) {
      urlField.value = '';
      urlField.placeholder = filename;
    }
    const new_db = new MaxMindDB();
    await new_db.loadBlob(data);

    try {
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

    let cache, response;
    if (cacheCheckbox.checked) {
      cache = await caches.open('maxmind-databases');
      response = await cache.match(urlField.value);
    }

    if (
      !response &&
      !confirm(
        'This will download ~70 MB of data. Are you sure you want to continue?',
      )
    ) {
      return;
    }

    loadButton.disabled = true;
    loadButton.value = 'Loading...';

    try {
      if (response) {
        await load_database(response);

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

      await load_database(new Blob(parts));
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

  window.addEventListener('drop', async e => {
    e.preventDefault();
    dropzone.classList.add('d-none');
    console.log(e.dataTransfer);

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
    console.log(key);
    const cache = await caches.open('maxmind-databases');
    const response = await cache.match(key);
    if (!response) {
      return;
    }
    load_database(response, key.url);
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
});
