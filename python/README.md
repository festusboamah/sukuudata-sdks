# sukuudata

The official Python client for the [SukuuData API](https://sukuudata.com): Ghana's schools, the 2026 GES SHS
placement register, and CSSPS school-choice validation. No dependencies; Python 3.9+.

## Install

```bash
pip install sukuudata
```

Get a free API key (1,000 requests a month) at [sukuudata.com/register](https://sukuudata.com/register).

## Usage

```python
import os
from sukuudata import SukuuData

sukuu = SukuuData(api_key=os.environ["SUKUUDATA_KEY"])

# Boarding schools in Ashanti offering General Science (programme 502)
page = sukuu.secondary_schools.list(region="ashanti", programme="502", residential="BOARDING")
for school in page.data:
    print(school["secondary"]["csspsCode"], school["name"], school["secondary"]["category"])
print(page.pagination)  # {'page': 1, 'limit': 20, 'total': ..., 'totalPages': ...}
```

### Check a candidate's eight CSSPS choices

```python
result = sukuu.placement.validate(
    [
        {"csspsCode": "0010110", "programme": "502", "residential": "BOARDING"},
        # ...eight in total, in order of preference
    ],
    student_gender="FEMALE",
    home={"lat": 5.6, "lng": -0.19},
)
if not result["valid"]:
    for error in result["errors"]:
        print(error["code"], error["message"])  # e.g. CATEGORY_A_LIMIT
```

### More

```python
sukuu.secondary_schools.get("0010121")          # one school by CSSPS code
sukuu.schools.search("achimota")                  # typo-tolerant autocomplete
sukuu.schools.nearby(lat=6.69, lng=-1.62, radius=10)
sukuu.programmes.list()                           # programme codes and TVET trades
sukuu.placement.rules()                           # the 2026 selection rules
sukuu.regions.list()
sukuu.districts.list(region="ashanti")
sukuu.statistics.schools()

for school in sukuu.paginate(sukuu.secondary_schools.list, category="A"):  # every page
    print(school["name"])

print(sukuu.rate_limit)  # RateLimit(limit=..., remaining=..., reset=datetime)
```

Filters use the API's parameter names (`programme`, `studentGender`, `hasLocation`...). Pass a list to send
several values, e.g. `category=["A", "B"]`.

## Errors

Failed requests raise `SukuuDataError` with `code`, `status`, `message` and `request_id`:

```python
from sukuudata import SukuuDataError

try:
    sukuu.secondary_schools.get("0000000")
except SukuuDataError as err:
    if err.code == "NOT_FOUND":
        ...
```

Codes include `INVALID_API_KEY`, `RATE_LIMIT_EXCEEDED`, `NOT_FOUND`, `VALIDATION_ERROR`, `UNKNOWN_REGION`,
`UNKNOWN_PROGRAMME`, plus `TIMEOUT` and `NETWORK_ERROR` when no response arrived.

## Links

- [Quickstart](https://sukuudata.com/quickstart)
- [SHS placement API guide](https://sukuudata.com/placement-api)
- [API reference](https://api.sukuudata.com/docs)

Built by [Nerds IV Technologies](https://nerdsiv.com). MIT licensed.
