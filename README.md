This is a [MaxMind database](https://maxmind.github.io/MaxMind-DB/) reader for web browsers.

Example:

```javascript
const response = await fetch('/path/to/GeoLite2-City.mmdb', {
  cache: 'force-cache',
});
if (!response.ok) {
  throw new Error(`Error fetching database: ${response.status} ${response.statusText}`);
}
const maxmind = new MaxMindDB();
await maxmind.load(response);
console.log(maxmind.get('1.1.1.1'));
```

Status: this is a brand new package so there are probably bugs. Please open a GitHub issue if you find one.

You can get this package from npm, or load the code directly in a `<script>` tag (see demo page).

- Demo: https://stefansundin.github.io/maxmind-db.js/
- Database specification: https://maxmind.github.io/MaxMind-DB/
