# SHS School Picker

An example app built on the [SukuuData API](https://sukuudata.com). It helps a BECE candidate in Ghana:

1. find senior high schools they can attend, filtered by programme, gender, region and day or boarding (and sorted
   by distance if they share their location);
2. build their eight choices in order of preference;
3. check the choices against the 2026 CSSPS rules before submitting: category limits, 5 boarding and 3 day,
   programmes each school offers, gender, and whether day schools are within reach.

It's deliberately small (one Node file, one HTML page, no framework) so it's easy to read and copy.

## Run it

From this folder (`examples/school-picker`). You need Node 18+ and a free SukuuData key from [sukuudata.com/register](https://sukuudata.com/register).

```bash
npm install
SUKUUDATA_KEY=sukuu_live_... npm start        # PowerShell: $env:SUKUUDATA_KEY="sukuu_live_..."; npm start
```

Open http://localhost:3000.

## How it works

- `server.js` serves the page and forwards four calls to SukuuData using the
  [`sukuudata`](https://www.npmjs.com/package/sukuudata) package: programmes, regions, school search and choice
  validation. The key stays on the server, and only known filters are passed through.
- `public/app.js` is the page: filters, results, the choice list and the validation result.

The SukuuData calls it makes:

```js
sukuu.programmes.list();
sukuu.regions.list();
sukuu.secondarySchools.list({ programme: "502", studentGender: "FEMALE", region: "ashanti", residential: "BOARDING" });
sukuu.placement.validate({ studentGender: "FEMALE", home: { lat, lng }, choices: [/* 8 × { csspsCode, programme, residential } */] });
```

## Deploying

Any Node host works (Render, Railway, Fly.io, a VPS). Set `SUKUUDATA_KEY` as an environment variable and run
`npm start`; `PORT` is respected.

School data comes from the 2026 GES register and CSSPS guidelines via SukuuData. Always confirm choices on the
official CSSPS portal before submitting.

Built by [Nerds IV Technologies](https://nerdsiv.com). MIT licensed.
