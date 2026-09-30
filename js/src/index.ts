import type {
  District,
  ListSchoolsParams,
  ListSecondarySchoolsParams,
  NearbySchoolsParams,
  Page,
  PlacementRules,
  Programme,
  ProgrammeKind,
  Region,
  School,
  SchoolStatistics,
  SearchSchoolsParams,
  ValidateChoicesInput,
  ValidationResult,
} from "./types.js";

export type * from "./types.js";

export interface SukuuDataOptions {
  /** Your key (sukuu_live_...). Get one free at https://sukuudata.com/register */
  apiKey: string;
  /** Defaults to https://api.sukuudata.com */
  baseUrl?: string;
  /** A fetch implementation; defaults to the global fetch (Node 18+, browsers, Deno, Bun). */
  fetch?: typeof fetch;
  /** Milliseconds before a request is aborted (default 15000). */
  timeoutMs?: number;
}

export interface RateLimit {
  /** Monthly quota. */
  limit: number;
  remaining: number;
  /** When the quota resets. */
  reset: Date;
}

/** An error response from the API. Branch on `code`; `message` is for people. */
export class SukuuDataError extends Error {
  readonly name = "SukuuDataError";
  constructor(
    message: string,
    /** e.g. INVALID_API_KEY, RATE_LIMIT_EXCEEDED, NOT_FOUND, VALIDATION_ERROR */
    readonly code: string,
    /** HTTP status; 0 when the request never got a response. */
    readonly status: number,
    /** Quote this if you contact us about a failed request. */
    readonly requestId?: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined>;

export class SukuuData {
  /** Quota figures from the most recent response, when the API sent them. */
  rateLimit?: RateLimit;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: SukuuDataOptions) {
    if (!options?.apiKey) throw new TypeError("SukuuData: apiKey is required");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.sukuudata.com").replace(/\/+$/, "");
    const f = options.fetch ?? globalThis.fetch;
    if (!f) throw new TypeError("SukuuData: no fetch available; pass options.fetch");
    this.fetchImpl = f.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  /** Every school we have a record for, KG to TVET. */
  readonly schools = {
    list: (params: ListSchoolsParams = {}) => this.page<School>("/schools", params),
    /** Typo-tolerant name search, for autocomplete. */
    search: (q: string, params: SearchSchoolsParams = {}) =>
      this.get<School[]>("/schools/search", { ...params, q }),
    /** Schools within a radius, nearest first, each with distanceKm. */
    nearby: (params: NearbySchoolsParams) => this.get<School[]>("/schools/nearby", params),
    get: (id: string) => this.get<School>(`/schools/${encodeURIComponent(id)}`),
  };

  /** SHS, SHTS, TVET and pilot private schools in the GES placement register. */
  readonly secondarySchools = {
    list: (params: ListSecondarySchoolsParams = {}) => this.page<School>("/secondary-schools", params),
    /** One school by its 7-digit CSSPS code. */
    get: (csspsCode: string) => this.get<School>(`/secondary-schools/${encodeURIComponent(csspsCode)}`),
  };

  readonly programmes = {
    list: (params: { kind?: ProgrammeKind } = {}) => this.get<Programme[]>("/programmes", params),
  };

  /** CSSPS school-selection rules and choice validation. */
  readonly placement = {
    rules: () => this.get<PlacementRules>("/placement/rules"),
    /** Errors mean the form breaks a rule; warnings are advice. */
    validate: (input: ValidateChoicesInput) =>
      this.request<ValidationResult>("POST", "/placement/validate", undefined, input).then((r) => r.data),
  };

  readonly regions = {
    list: () => this.get<Region[]>("/regions"),
    /** By id, code, pcode or name. */
    get: (id: string | number) => this.get<Region>(`/regions/${encodeURIComponent(String(id))}`),
  };

  readonly districts = {
    list: (params: { region?: string } = {}) => this.get<District[]>("/districts", params),
    get: (id: string | number) => this.get<District>(`/districts/${encodeURIComponent(String(id))}`),
  };

  readonly statistics = {
    schools: (params: { region?: string } = {}) => this.get<SchoolStatistics>("/statistics/schools", params),
  };

  /** Data sources, licences and coverage. */
  dataQuality() {
    return this.get<Record<string, unknown>>("/data-quality");
  }

  /**
   * Walks every page of a paginated list.
   *
   *   for await (const school of client.paginate(client.secondarySchools.list, { programme: "502" })) { ... }
   */
  async *paginate<T, P extends { page?: number; limit?: number }>(
    list: (params: P) => Promise<Page<T>>,
    params: P = {} as P,
  ): AsyncGenerator<T> {
    let page = params.page ?? 1;
    for (;;) {
      const result = await list({ ...params, page, limit: params.limit ?? 100 });
      yield* result.data;
      if (page >= result.pagination.totalPages) return;
      page++;
    }
  }

  private async get<T>(path: string, query?: object): Promise<T> {
    return (await this.request<T>("GET", path, query as Query)).data;
  }

  private async page<T>(path: string, query: object): Promise<Page<T>> {
    const body = await this.request<T[]>("GET", path, query as Query);
    return { data: body.data, pagination: body.pagination! };
  }

  private async request<T>(method: string, path: string, query?: Query, json?: unknown) {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: {
          "X-API-Key": this.apiKey,
          Accept: "application/json",
          ...(json === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: json === undefined ? undefined : JSON.stringify(json),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = (err as Error)?.name === "AbortError";
      throw new SukuuDataError(
        aborted ? `Request timed out after ${this.timeoutMs} ms` : `Network error: ${(err as Error)?.message ?? err}`,
        aborted ? "TIMEOUT" : "NETWORK_ERROR",
        0,
      );
    } finally {
      clearTimeout(timer);
    }

    this.readRateLimit(res.headers);
    const requestId = res.headers.get("x-request-id") ?? undefined;
    let body: { success?: boolean; data?: T; pagination?: Page<unknown>["pagination"]; error?: string; code?: string };
    try {
      body = await res.json();
    } catch {
      throw new SukuuDataError(`Unexpected response (HTTP ${res.status})`, "BAD_RESPONSE", res.status, requestId);
    }
    if (!res.ok || body.success === false) {
      throw new SukuuDataError(body.error ?? `HTTP ${res.status}`, body.code ?? "HTTP_ERROR", res.status, requestId);
    }
    return body as { data: T; pagination?: Page<unknown>["pagination"] };
  }

  private readRateLimit(headers: Headers) {
    const limit = headers.get("x-ratelimit-limit");
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");
    if (limit && remaining && reset) {
      this.rateLimit = { limit: Number(limit), remaining: Number(remaining), reset: new Date(Number(reset) * 1000) };
    }
  }
}

export default SukuuData;
