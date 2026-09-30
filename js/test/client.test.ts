import { beforeAll, describe, expect, it } from "vitest";
import { SukuuData, SukuuDataError } from "../src/index.js";

type Call = { url: URL; init: RequestInit };

function fakeFetch(responses: { status?: number; body: unknown; headers?: Record<string, string> }[]) {
  const calls: Call[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: new URL(String(input)), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("no more fake responses");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json", ...next.headers },
    });
  }) as typeof fetch;
  return { f, calls };
}

describe("SukuuData client", () => {
  it("sends the key, builds the query and returns data with pagination", async () => {
    const { f, calls } = fakeFetch([
      {
        body: { success: true, data: [{ id: "x" }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
        headers: { "x-ratelimit-limit": "1000", "x-ratelimit-remaining": "999", "x-ratelimit-reset": "1790812800" },
      },
    ]);
    const client = new SukuuData({ apiKey: "sukuu_live_test", fetch: f });
    const page = await client.secondarySchools.list({ programme: ["502", "503"], residential: "BOARDING", region: undefined });

    expect(page.data).toEqual([{ id: "x" }]);
    expect(page.pagination.total).toBe(1);
    expect(calls[0].url.origin + calls[0].url.pathname).toBe("https://api.sukuudata.com/api/v1/secondary-schools");
    expect(calls[0].url.searchParams.get("programme")).toBe("502,503");
    expect(calls[0].url.searchParams.has("region")).toBe(false);
    expect((calls[0].init.headers as Record<string, string>)["X-API-Key"]).toBe("sukuu_live_test");
    expect(client.rateLimit).toEqual({ limit: 1000, remaining: 999, reset: new Date(1790812800 * 1000) });
  });

  it("posts choices as JSON for validation", async () => {
    const { f, calls } = fakeFetch([{ body: { success: true, data: { valid: true, errors: [], warnings: [] } } }]);
    const client = new SukuuData({ apiKey: "k", fetch: f, baseUrl: "http://localhost:4000/" });
    const result = await client.placement.validate({ choices: [{ csspsCode: "0010121", programme: "502", residential: "BOARDING" }] });

    expect(result.valid).toBe(true);
    expect(calls[0].url.href).toBe("http://localhost:4000/api/v1/placement/validate");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body)).choices[0].csspsCode).toBe("0010121");
  });

  it("turns API errors into SukuuDataError with the code and request id", async () => {
    const { f } = fakeFetch([
      { status: 401, body: { success: false, error: "Invalid API key.", code: "INVALID_API_KEY" }, headers: { "x-request-id": "req-1" } },
    ]);
    const client = new SukuuData({ apiKey: "bad", fetch: f });
    const err = await client.programmes.list().catch((e) => e);

    expect(err).toBeInstanceOf(SukuuDataError);
    expect(err).toMatchObject({ code: "INVALID_API_KEY", status: 401, requestId: "req-1", message: "Invalid API key." });
  });

  it("reports network failures as NETWORK_ERROR", async () => {
    const f = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const err = await new SukuuData({ apiKey: "k", fetch: f }).regions.list().catch((e) => e);
    expect(err).toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it("paginates through every page", async () => {
    const { f, calls } = fakeFetch([
      { body: { success: true, data: [1, 2], pagination: { page: 1, limit: 2, total: 3, totalPages: 2 } } },
      { body: { success: true, data: [3], pagination: { page: 2, limit: 2, total: 3, totalPages: 2 } } },
    ]);
    const client = new SukuuData({ apiKey: "k", fetch: f });
    const all: unknown[] = [];
    for await (const item of client.paginate(client.schools.list, { limit: 2 })) all.push(item);

    expect(all).toEqual([1, 2, 3]);
    expect(calls.map((c) => c.url.searchParams.get("page"))).toEqual(["1", "2"]);
  });

  it("requires an API key", () => {
    expect(() => new SukuuData({ apiKey: "" })).toThrow(/apiKey is required/);
  });
});

// Runs against a real API when SUKUUDATA_KEY is set (and SUKUUDATA_BASE_URL for a local server).
const key = process.env.SUKUUDATA_KEY;
describe.skipIf(!key)("against a live API", () => {
  // Built lazily: vitest still runs this callback when the suite is skipped.
  let client: SukuuData;
  beforeAll(() => {
    client = new SukuuData({ apiKey: key!, baseUrl: process.env.SUKUUDATA_BASE_URL });
  });

  it("lists placement schools offering General Science", async () => {
    const page = await client.secondarySchools.list({ programme: "502", limit: 2 });
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data[0].secondary?.programmes.some((p) => p.code === "502")).toBe(true);
  });

  it("looks up a school by CSSPS code and validates choices", async () => {
    const school = await client.secondarySchools.get("0010121");
    expect(school.secondary?.csspsCode).toBe("0010121");
    const result = await client.placement.validate({
      choices: [{ csspsCode: "0010121", programme: "502", residential: "BOARDING" }],
    });
    expect(result.errors.map((e) => e.code)).toContain("CHOICE_COUNT");
  });

  it("reads the rules and rate limit", async () => {
    const rules = await client.placement.rules();
    expect(rules.totalChoices).toBe(8);
    expect(client.rateLimit?.limit).toBeGreaterThan(0);
  });
});
