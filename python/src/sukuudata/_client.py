from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterator, List, Optional, Sequence, Union

DEFAULT_BASE_URL = "https://api.sukuudata.com"

Params = Dict[str, Any]
JSONDict = Dict[str, Any]


class SukuuDataError(Exception):
    """An error response from the API. Branch on ``code``; the message is for people."""

    def __init__(self, message: str, code: str, status: int, request_id: Optional[str] = None):
        super().__init__(message)
        self.message = message
        #: e.g. INVALID_API_KEY, RATE_LIMIT_EXCEEDED, NOT_FOUND, VALIDATION_ERROR,
        #: or TIMEOUT / NETWORK_ERROR when no response arrived.
        self.code = code
        #: HTTP status; 0 when the request never got a response.
        self.status = status
        #: Quote this if you contact us about a failed request.
        self.request_id = request_id

    def __repr__(self) -> str:
        return f"SukuuDataError(code={self.code!r}, status={self.status}, message={self.message!r})"


@dataclass
class Page:
    """One page of a list, with ``pagination`` = {page, limit, total, totalPages}."""

    data: List[JSONDict]
    pagination: JSONDict


@dataclass
class RateLimit:
    limit: int
    remaining: int
    reset: datetime


class SukuuData:
    """Client for https://api.sukuudata.com. Responses are plain dicts shaped as in the API reference."""

    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL, timeout: float = 15.0,
                 opener: Optional[Callable[..., Any]] = None):
        if not api_key:
            raise ValueError("SukuuData: api_key is required")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._open = opener or urllib.request.urlopen
        #: Quota figures from the most recent response, when the API sent them.
        self.rate_limit: Optional[RateLimit] = None

        self.schools = _Schools(self)
        self.secondary_schools = _SecondarySchools(self)
        self.programmes = _Programmes(self)
        self.placement = _Placement(self)
        self.regions = _Regions(self)
        self.districts = _Districts(self)
        self.statistics = _Statistics(self)

    def data_quality(self) -> JSONDict:
        """Data sources, licences and coverage."""
        return self._get("/data-quality")

    def paginate(self, list_method: Callable[..., Page], **params: Any) -> Iterator[JSONDict]:
        """Yields every item of a paginated list.

            for school in sukuu.paginate(sukuu.secondary_schools.list, programme="502"):
                ...
        """
        page = params.pop("page", 1)
        params.setdefault("limit", 100)
        while True:
            result = list_method(page=page, **params)
            yield from result.data
            if page >= result.pagination["totalPages"]:
                return
            page += 1

    # -- transport -------------------------------------------------------------------------------

    def _get(self, path: str, params: Optional[Params] = None) -> Any:
        return self._request("GET", path, params)["data"]

    def _page(self, path: str, params: Params) -> Page:
        body = self._request("GET", path, params)
        return Page(data=body["data"], pagination=body["pagination"])

    def _request(self, method: str, path: str, params: Optional[Params] = None,
                 json_body: Optional[Any] = None) -> JSONDict:
        query = {k: _param(v) for k, v in (params or {}).items() if v is not None and v != ""}
        url = f"{self._base_url}/api/v1{path}"
        if query:
            url += "?" + urllib.parse.urlencode(query)
        headers = {"X-API-Key": self._api_key, "Accept": "application/json",
                   "User-Agent": "sukuudata-python/0.1.0"}
        data = None
        if json_body is not None:
            data = json.dumps(json_body).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        try:
            resp = self._open(req, timeout=self._timeout)
            status, resp_headers, raw = resp.status, resp.headers, resp.read()
        except urllib.error.HTTPError as err:
            status, resp_headers, raw = err.code, err.headers, err.read()
        except TimeoutError:
            raise SukuuDataError(f"Request timed out after {self._timeout} s", "TIMEOUT", 0) from None
        except urllib.error.URLError as err:
            if isinstance(err.reason, TimeoutError):
                raise SukuuDataError(f"Request timed out after {self._timeout} s", "TIMEOUT", 0) from None
            raise SukuuDataError(f"Network error: {err.reason}", "NETWORK_ERROR", 0) from None

        self._read_rate_limit(resp_headers)
        request_id = resp_headers.get("X-Request-Id") if resp_headers else None
        try:
            body = json.loads(raw)
        except ValueError:
            raise SukuuDataError(f"Unexpected response (HTTP {status})", "BAD_RESPONSE", status, request_id) from None
        if status >= 400 or body.get("success") is False:
            raise SukuuDataError(body.get("error") or f"HTTP {status}", body.get("code") or "HTTP_ERROR",
                                 status, request_id)
        return body

    def _read_rate_limit(self, headers: Any) -> None:
        if not headers:
            return
        limit, remaining, reset = (headers.get(h) for h in
                                   ("X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"))
        if limit and remaining and reset:
            self.rate_limit = RateLimit(int(limit), int(remaining),
                                        datetime.fromtimestamp(int(reset), tz=timezone.utc))


def _param(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, tuple)):
        return ",".join(str(v) for v in value)
    return str(value)


def _q(value: Union[str, int]) -> str:
    return urllib.parse.quote(str(value), safe="")


class _Resource:
    def __init__(self, client: SukuuData):
        self._c = client


class _Schools(_Resource):
    """Every school we have a record for, KG to TVET."""

    def list(self, **params: Any) -> Page:
        """Filters: region, district, level, type, gender, residential, status, town, search,
        hasLocation, sort, page, limit (up to 100)."""
        return self._c._page("/schools", params)

    def search(self, q: str, **params: Any) -> List[JSONDict]:
        """Typo-tolerant name search for autocomplete. Filters: region, level, limit (up to 25)."""
        return self._c._get("/schools/search", {**params, "q": q})

    def nearby(self, lat: float, lng: float, radius: Optional[float] = None, **params: Any) -> List[JSONDict]:
        """Schools within ``radius`` km (default 25), nearest first, each with distanceKm."""
        return self._c._get("/schools/nearby", {**params, "lat": lat, "lng": lng, "radius": radius})

    def get(self, school_id: str) -> JSONDict:
        return self._c._get(f"/schools/{_q(school_id)}")


class _SecondarySchools(_Resource):
    """SHS, SHTS, TVET and pilot private schools in the GES placement register."""

    def list(self, **params: Any) -> Page:
        """Filters: region, district, search, category (A, B, C, PILOT_PRIVATE), institutionType,
        programme (e.g. "502"), studentGender, gender, residential (DAY, BOARDING), specialNeeds,
        hasLocation, lat, lng, radius, sort, page, limit. Lists are sent comma-separated."""
        return self._c._page("/secondary-schools", params)

    def get(self, cssps_code: str) -> JSONDict:
        """One school by its 7-digit CSSPS code."""
        return self._c._get(f"/secondary-schools/{_q(cssps_code)}")


class _Programmes(_Resource):
    def list(self, kind: Optional[str] = None) -> List[JSONDict]:
        """Programme codes; ``kind`` is GENERAL or TVET."""
        return self._c._get("/programmes", {"kind": kind})


class _Placement(_Resource):
    """CSSPS school-selection rules and choice validation."""

    def rules(self) -> JSONDict:
        return self._c._get("/placement/rules")

    def validate(self, choices: Sequence[JSONDict], student_gender: Optional[str] = None,
                 home: Optional[JSONDict] = None) -> JSONDict:
        """Checks choices (in order of preference), each {csspsCode or schoolId, programme, residential}.

        Returns {valid, errors, warnings, summary, choices, ...}. Errors break a rule; warnings are advice.
        ``home`` is {"lat": ..., "lng": ...}, to check day schools are within reach.
        """
        body: JSONDict = {"choices": list(choices)}
        if student_gender:
            body["studentGender"] = student_gender
        if home:
            body["home"] = home
        return self._c._request("POST", "/placement/validate", json_body=body)["data"]


class _Regions(_Resource):
    def list(self) -> List[JSONDict]:
        return self._c._get("/regions")

    def get(self, region: Union[str, int]) -> JSONDict:
        """By id, code, pcode or name."""
        return self._c._get(f"/regions/{_q(region)}")


class _Districts(_Resource):
    def list(self, region: Optional[str] = None) -> List[JSONDict]:
        return self._c._get("/districts", {"region": region})

    def get(self, district: Union[str, int]) -> JSONDict:
        return self._c._get(f"/districts/{_q(district)}")


class _Statistics(_Resource):
    def schools(self, region: Optional[str] = None) -> JSONDict:
        return self._c._get("/statistics/schools", {"region": region})
