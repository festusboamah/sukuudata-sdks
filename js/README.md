# sukuudata

The official JavaScript and TypeScript client for the [SukuuData API](https://sukuudata.com): Ghana's schools, the
2026 GES SHS placement register, and CSSPS school-choice validation.

- Fully typed, no dependencies
- Works in Node 18+, Deno, Bun and browsers (anything with `fetch`)

## Install

```bash
npm install sukuudata
```

Get a free API key (1,000 requests a month) at [sukuudata.com/register](https://sukuudata.com/register).

## Usage

```ts
import { SukuuData } from "sukuudata";

const sukuu = new SukuuData({ apiKey: process.env.SUKUUDATA_KEY! });

// Boarding schools in Ashanti offering General Science (programme 502)
const { data: schools, pagination } = await sukuu.secondarySchools.list({
  region: "ashanti",
  programme: "502",
  residential: "BOARDING",
});

for (const school of schools) {
  console.log(school.secondary?.csspsCode, school.name, school.secondary?.category);
}
```

### Check a candidate's eight CSSPS choices

```ts
const result = await sukuu.placement.validate({
  studentGender: "FEMALE",
  home: { lat: 5.6, lng: -0.19 },
  choices: [
    { csspsCode: "0010110", programme: "502", residential: "BOARDING" },
    // ...eight in total, in order of preference
  ],
});

if (!result.valid) {
  for (const e of result.errors) console.log(e.code, e.message); // e.g. CATEGORY_A_LIMIT
}
```

### More

```ts
await sukuu.secondarySchools.get("0010121");            // one school by CSSPS code
await sukuu.schools.search("achimota");                   // typo-tolerant autocomplete
await sukuu.schools.nearby({ lat: 6.69, lng: -1.62, radius: 10 });
await sukuu.programmes.list();                            // programme codes and TVET trades
await sukuu.placement.rules();                            // the 2026 selection rules
await sukuu.regions.list();
await sukuu.districts.list({ region: "ashanti" });
await sukuu.statistics.schools();

// Every page of a list
for await (const school of sukuu.paginate(sukuu.secondarySchools.list, { category: "A" })) {
  console.log(school.name);
}

// Quota from the latest response
console.log(sukuu.rateLimit); // { limit, remaining, reset }
```

## Errors

Failed requests throw `SukuuDataError`. Branch on `code`:

```ts
import { SukuuDataError } from "sukuudata";

try {
  await sukuu.secondarySchools.get("0000000");
} catch (err) {
  if (err instanceof SukuuDataError && err.code === "NOT_FOUND") {
    // ...
  }
}
```

Codes include `INVALID_API_KEY`, `RATE_LIMIT_EXCEEDED`, `NOT_FOUND`, `VALIDATION_ERROR`, `UNKNOWN_REGION`,
`UNKNOWN_PROGRAMME`, plus `TIMEOUT` and `NETWORK_ERROR` when no response arrived. `err.requestId` identifies the
request if you contact us.

## Keep your key secret

Anyone with your key can use your quota. In public websites and mobile apps, call SukuuData from your own server
rather than shipping the key to the browser.

## Links

- [Quickstart](https://sukuudata.com/quickstart)
- [SHS placement API guide](https://sukuudata.com/placement-api)
- [API reference](https://api.sukuudata.com/docs)

Built by [Nerds IV Technologies](https://nerdsiv.com). MIT licensed.
