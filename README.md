# SukuuData client libraries and examples

Official, open-source tools for the [SukuuData API](https://sukuudata.com): Ghana's schools, the 2026 GES SHS
placement register, and CSSPS school-choice validation.

| | Install | Source |
|---|---|---|
| **JavaScript / TypeScript** | `npm install sukuudata` | [`js/`](js) |
| **Python** | `pip install sukuudata` | [`python/`](python) |
| **Postman collection** | Import the file | [`postman/`](postman) |
| **Example app**: SHS School Picker | `cd examples/school-picker` | [`examples/school-picker/`](examples/school-picker) |

Get a free API key (1,000 requests a month) at [sukuudata.com/register](https://sukuudata.com/register).

## Quick look

```ts
import { SukuuData } from "sukuudata";

const sukuu = new SukuuData({ apiKey: process.env.SUKUUDATA_KEY! });
const { data } = await sukuu.secondarySchools.list({ programme: "502", residential: "BOARDING" });
const check = await sukuu.placement.validate({ choices: [/* a candidate's 8 choices */] });
```

```python
from sukuudata import SukuuData

sukuu = SukuuData(api_key="sukuu_live_...")
page = sukuu.secondary_schools.list(programme="502", residential="BOARDING")
```

## Docs

- [Quickstart](https://sukuudata.com/quickstart)
- [SHS placement API guide](https://sukuudata.com/placement-api)
- [API reference](https://api.sukuudata.com/docs) and [OpenAPI spec](https://api.sukuudata.com/docs/json)

## Contributing

Issues and pull requests are welcome. Run the tests with `npm test` in `js/` and
`PYTHONPATH=src python -m unittest discover -s tests` in `python/`. Maintainers: see
[docs/PUBLISHING.md](docs/PUBLISHING.md) for releases.

The code in this repository is MIT licensed. That licence covers the client code only, not the SukuuData API or its
data; school locations are © OpenStreetMap contributors (ODbL).

Built by [Nerds IV Technologies](https://nerdsiv.com).
