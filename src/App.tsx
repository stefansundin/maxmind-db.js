import './App.css';

import { useEffect, useState } from 'react';

import MaxMindDB from 'maxmind-db';

function App() {
  const [db, setDb] = useState<MaxMindDB>();
  const [file, setFile] = useState<File>();
  const [query, setQuery] = useState<string>('');
  const [output, setOutput] = useState<Array<string | object>>([]);

  useEffect(() => {
    (async () => {
      if (!file) {
        return;
      }
      const db = new MaxMindDB();
      await db.load(file);
      setDb(db);
    })();
  }, [file]);

  const selectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) {
      return;
    }
    setFile(e.target.files[0]);
  };

  const performQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) {
      setOutput(old => ['Database not loaded.', ...old]);
      return;
    }
    const result = db.get(query);
    if (!result) {
      setOutput(old => [`Could not find ${query} in database.`, ...old]);
      return;
    }
    console.log(result);
    setOutput(old => [result, ...old]);
  };

  return (
    <div className="App">
      <h1>
        React Demo for{' '}
        <a
          href="https://www.npmjs.com/package/maxmind-db"
          target="_blank"
          rel="noopener noreferrer"
        >
          MaxMindDB.js
        </a>
      </h1>
      <p>
        Non-React demo:{' '}
        <a
          href="https://stefansundin.github.io/maxmind-db.js/"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://stefansundin.github.io/maxmind-db.js/
        </a>
      </p>

      <p>
        This product includes GeoLite2 data created by MaxMind, available from{' '}
        <a
          href="https://www.maxmind.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://www.maxmind.com/
        </a>
        .<br />
        <small>
          If you make use of GeoLite2 in your product then according to{' '}
          <a
            href="https://dev.maxmind.com/geoip/geolite2-free-geolocation-data#license"
            target="_blank"
            rel="noopener noreferrer"
          >
            the license
          </a>{' '}
          you should include the statement above.
        </small>
      </p>

      <p>Select a MaxMind database file.</p>
      <div>
        <input type="file" accept=".mmdb" onChange={selectFile} />
      </div>
      <p>Then query it with IPv4 or IPv6 addresses.</p>
      <div>
        <form onSubmit={performQuery}>
          <input type="text" onChange={e => setQuery(e.target.value)} />{' '}
          <input type="submit" value="Look up" />
        </form>
      </div>
      <h3>Output</h3>
      <div>
        {output.length === 0 && 'Results will appear here.'}
        {output.map((v, i) => (
          <code key={i}>{typeof v === 'string' ? v : JSON.stringify(v)}</code>
        ))}
      </div>
    </div>
  );
}

export default App;
