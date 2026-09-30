const $ = (id) => document.getElementById(id);
const MAX = { total: 8, BOARDING: 5, DAY: 3 };

let home = null;        // { lat, lng } when the user shares their location
let lastQuery = null;   // filters of the current result list
let page = 1;
const choices = [];     // [{ school, residential }]

async function api(path, options) {
  const res = await fetch(path, options);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
  }
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}

async function loadOptions() {
  const [programmes, regions] = await Promise.all([api("/api/programmes"), api("/api/regions")]);
  const select = $("programme");
  select.replaceChildren(el("option", { value: "" }, "Choose a programme"));
  const general = programmes.filter((p) => p.kind === "GENERAL");
  const tvet = programmes.filter((p) => p.kind === "TVET");
  select.append(
    el("optgroup", { label: "Senior high programmes" }, ...general.map((p) => el("option", { value: p.code }, p.name))),
    el("optgroup", { label: "TVET trades" }, ...tvet.map((p) => el("option", { value: p.code }, p.name))),
  );
  $("region").append(...regions.map((r) => el("option", { value: r.code }, r.name)));
}

function offered(school) {
  const s = school.secondary;
  return { BOARDING: s.offersBoarding, DAY: s.offersDay };
}

function countBy(residential) {
  return choices.filter((c) => c.residential === residential).length;
}

function canAdd(school, residential) {
  if (choices.length >= MAX.total) return false;
  if (choices.some((c) => c.school.id === school.id)) return false;
  if (!offered(school)[residential]) return false;
  return countBy(residential) < MAX[residential];
}

function schoolItem(school) {
  const s = school.secondary;
  const where = [school.town, school.district, school.region].filter(Boolean).join(", ");
  const status = [s.offersBoarding && "boarding", s.offersDay && "day"].filter(Boolean).join(" and ");
  const add = (residential, label) =>
    el("button", {
      type: "button",
      class: "small-btn",
      disabled: !canAdd(school, residential),
      onclick: () => { choices.push({ school, residential }); renderAll(); },
    }, label);
  return el("li", { class: "school" },
    el("div", {},
      el("h3", {}, school.name),
      el("p", { class: "muted small" },
        el("span", { class: `badge cat-${s.category}` }, s.category === "PILOT_PRIVATE" ? "Pilot private" : `Category ${s.category}`),
        ` ${where}${school.distanceKm != null ? ` · ${school.distanceKm} km` : ""}`),
      el("p", { class: "small" }, `CSSPS ${s.csspsCode} · offers ${status} · ${s.gender.toLowerCase()}`),
    ),
    el("div", { class: "actions" }, add("BOARDING", "+ Boarding"), add("DAY", "+ Day")),
  );
}

let results = [];

async function search(query, nextPage = 1) {
  lastQuery = query;
  page = nextPage;
  $("resultsNote").textContent = "Searching…";
  const params = new URLSearchParams({ ...query, page: String(page) });
  if (home) { params.set("lat", home.lat); params.set("lng", home.lng); params.set("radius", "300"); }
  try {
    const { data, pagination } = await api(`/api/schools?${params}`);
    results = page === 1 ? data : results.concat(data);
    $("resultsNote").textContent = pagination.total
      ? `${pagination.total} schools match${home ? ", nearest first" : ""}.`
      : "No schools match. Try another region or residential status.";
    $("more").hidden = page >= pagination.totalPages;
    renderResults();
  } catch (err) {
    $("resultsNote").textContent = err.message;
  }
}

function renderResults() {
  $("results").replaceChildren(...results.map(schoolItem));
}

function move(index, delta) {
  const to = index + delta;
  if (to < 0 || to >= choices.length) return;
  [choices[index], choices[to]] = [choices[to], choices[index]];
  renderAll();
}

function renderChoices() {
  $("choices").replaceChildren(...choices.map((c, i) =>
    el("li", {},
      el("div", {},
        el("strong", {}, c.school.name),
        el("span", { class: "muted small" }, ` · ${c.residential === "BOARDING" ? "Boarding" : "Day"} · Category ${c.school.secondary.category}`),
      ),
      el("div", { class: "actions" },
        el("button", { type: "button", class: "icon-btn", "aria-label": `Move ${c.school.name} up`, disabled: i === 0, onclick: () => move(i, -1) }, "↑"),
        el("button", { type: "button", class: "icon-btn", "aria-label": `Move ${c.school.name} down`, disabled: i === choices.length - 1, onclick: () => move(i, 1) }, "↓"),
        el("button", { type: "button", class: "icon-btn", "aria-label": `Remove ${c.school.name}`, onclick: () => { choices.splice(i, 1); renderAll(); } }, "✕"),
      ),
    ),
  ));
  $("emptyChoices").hidden = choices.length > 0;
  $("counts").textContent = `${choices.length} of 8 · ${countBy("BOARDING")} boarding (max 5) · ${countBy("DAY")} day (max 3)`;
  $("check").disabled = choices.length === 0;
  $("verdict").replaceChildren();
}

function renderAll() {
  renderChoices();
  renderResults();
}

function issueList(title, issues, kind) {
  if (!issues.length) return null;
  return el("div", { class: `issues ${kind}` },
    el("h3", {}, title),
    el("ul", {}, ...issues.map((i) => el("li", {}, i.message))),
  );
}

async function check() {
  const gender = new FormData($("filters")).get("studentGender");
  const body = {
    studentGender: gender,
    choices: choices.map((c) => ({ csspsCode: c.school.secondary.csspsCode, programme: lastQuery.programme, residential: c.residential })),
    ...(home ? { home } : {}),
  };
  $("verdict").replaceChildren(el("p", { class: "muted small" }, "Checking…"));
  try {
    const result = await api("/api/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    $("verdict").replaceChildren(...[
      el("p", { class: result.valid ? "ok" : "bad" }, result.valid ? "These choices follow the 2026 CSSPS rules." : "These choices break some rules:"),
      issueList("Must fix", result.errors, "errors"),
      issueList("Worth a look", result.warnings, "warnings"),
    ].filter(Boolean));
  } catch (err) {
    $("verdict").replaceChildren(el("p", { class: "bad" }, err.message));
  }
}

$("filters").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const query = {};
  for (const key of ["programme", "studentGender", "region", "residential"]) {
    const v = form.get(key);
    if (v) query[key] = v;
  }
  search(query);
});

$("more").addEventListener("click", () => search(lastQuery, page + 1));
$("check").addEventListener("click", check);

$("locate").addEventListener("click", () => {
  if (!navigator.geolocation) { $("locationNote").textContent = "Your browser can't share location."; return; }
  $("locationNote").textContent = "Finding you…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      home = { lat: Number(pos.coords.latitude.toFixed(4)), lng: Number(pos.coords.longitude.toFixed(4)) };
      $("locationNote").textContent = "Location set. Results are sorted by distance.";
      if (lastQuery) search(lastQuery);
    },
    () => { $("locationNote").textContent = "Couldn't get your location. You can still search by region."; },
  );
});

loadOptions().catch((err) => { $("resultsNote").textContent = err.message; });
renderChoices();
