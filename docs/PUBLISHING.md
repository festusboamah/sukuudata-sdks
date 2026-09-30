# Publishing the developer tools

Everything here is built and tested in this repo. Publishing needs accounts that belong to SukuuData / Nerds IV
Technologies, so these steps are run by the owner.

## Easiest: publish from GitHub (works from a phone)

One-time setup:

1. **npm**: at npmjs.com → your avatar → Access Tokens → Generate New Token → Granular Access Token, with
   read and write permission on packages (for the first release, "all packages"). Copy it, then in this GitHub repo:
   Settings → Secrets and variables → Actions → New repository secret, named `NPM_TOKEN`.
2. **PyPI**: at pypi.org → Your account → Publishing → Add a new pending publisher (GitHub): project name
   `sukuudata`, owner `festusboamah`, repository `sukuudata-sdks`, workflow `release.yml`, environment `pypi`.

Then each release: Actions → **Release** → Run workflow → choose `both`, `npm` or `pypi`. Bump the versions first
(see below); npm and PyPI refuse to publish the same version twice.

## npm: `sukuudata` (js/)

One-time: create an account at npmjs.com (enable 2FA), then `npm login`.

```bash
cd js
npm ci
npm publish            # prepublishOnly runs typecheck, tests and build first
```

For a new version: bump `version` in `js/package.json` (semver), then `npm publish` again.

## PyPI: `sukuudata` (python/)

One-time: create an account at pypi.org (enable 2FA) and an API token (Account settings → API tokens).

```bash
cd python
python -m pip install build twine
python -m build
python -m twine upload dist/*     # username: __token__, password: the pypi-... token
```

For a new version: bump `version` in `pyproject.toml` and in `src/sukuudata/__init__.py`, delete `dist/`, rebuild,
upload.

## Postman public workspace

`postman/SukuuData.postman_collection.json` is generated from the live OpenAPI spec, with an `apiKey` collection
variable and a valid example body for choice validation.

1. In Postman, create a workspace named **SukuuData** and set its visibility to **Public** (this needs a Postman
   profile handle, e.g. `sukuudata`).
2. **Import** → select the collection file.
3. On the collection, **Share → Run in Postman** gives a button/link; put it in the README and the public-apis entry.

To regenerate after API changes:

```bash
curl -s https://api.sukuudata.com/docs/json > /tmp/openapi.json
npx openapi-to-postmanv2 -s /tmp/openapi.json -o postman/SukuuData.postman_collection.json -p \
  -O folderStrategy=Tags,requestParametersResolution=Example
```

Then re-add the `apiKey` variable, collection description and the validate example body (or re-import and edit in
Postman).

## public-apis listing

Repo: https://github.com/public-apis/public-apis. Fork it, add this line to the **Government** section of
`README.md` in alphabetical order (between entries starting "Su…"), and open a pull request:

```
| [SukuuData](https://sukuudata.com/quickstart) | Ghana's schools, 2026 SHS placement register and CSSPS choice validation | `apiKey` | Yes | Yes |
```

The live README uses these 5 columns (its CONTRIBUTING.md mentions a 6th "Call this API" column that existing
entries don't use). The list rejects marketing-style entries, so keep the description factual. PR title suggestion: `Add SukuuData API`.
