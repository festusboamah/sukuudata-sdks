import io
import json
import os
import unittest
import urllib.error
import urllib.parse
from email.message import Message

from sukuudata import SukuuData, SukuuDataError


def _headers(values):
    msg = Message()
    for k, v in (values or {}).items():
        msg[k] = v
    return msg


class FakeResponse:
    def __init__(self, body, status=200, headers=None):
        self.status = status
        self.headers = _headers(headers)
        self._raw = json.dumps(body).encode()

    def read(self):
        return self._raw


class FakeOpener:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests = []

    def __call__(self, req, timeout=None):
        self.requests.append(req)
        nxt = self.responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        if nxt.status >= 400:
            raise urllib.error.HTTPError(req.full_url, nxt.status, "error", nxt.headers, io.BytesIO(nxt.read()))
        return nxt


class ClientTest(unittest.TestCase):
    def test_list_sends_key_and_query(self):
        opener = FakeOpener(FakeResponse(
            {"success": True, "data": [{"id": "x"}], "pagination": {"page": 1, "limit": 20, "total": 1, "totalPages": 1}},
            headers={"X-RateLimit-Limit": "1000", "X-RateLimit-Remaining": "999", "X-RateLimit-Reset": "1790812800"},
        ))
        client = SukuuData("sukuu_live_test", opener=opener)
        page = client.secondary_schools.list(programme=["502", "503"], residential="BOARDING", hasLocation=True, region=None)

        self.assertEqual(page.data, [{"id": "x"}])
        self.assertEqual(page.pagination["total"], 1)
        req = opener.requests[0]
        url = urllib.parse.urlparse(req.full_url)
        query = urllib.parse.parse_qs(url.query)
        self.assertEqual(url.path, "/api/v1/secondary-schools")
        self.assertEqual(query["programme"], ["502,503"])
        self.assertEqual(query["hasLocation"], ["true"])
        self.assertNotIn("region", query)
        self.assertEqual(req.get_header("X-api-key"), "sukuu_live_test")
        self.assertEqual(client.rate_limit.remaining, 999)

    def test_validate_posts_json(self):
        opener = FakeOpener(FakeResponse({"success": True, "data": {"valid": True, "errors": []}}))
        client = SukuuData("k", base_url="http://localhost:4000/", opener=opener)
        result = client.placement.validate([{"csspsCode": "0010121", "programme": "502", "residential": "BOARDING"}],
                                           student_gender="MALE")
        self.assertTrue(result["valid"])
        req = opener.requests[0]
        self.assertEqual(req.full_url, "http://localhost:4000/api/v1/placement/validate")
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(json.loads(req.data)["studentGender"], "MALE")

    def test_api_error(self):
        opener = FakeOpener(FakeResponse({"success": False, "error": "Invalid API key.", "code": "INVALID_API_KEY"},
                                         status=401, headers={"X-Request-Id": "req-1"}))
        with self.assertRaises(SukuuDataError) as ctx:
            SukuuData("bad", opener=opener).programmes.list()
        self.assertEqual((ctx.exception.code, ctx.exception.status, ctx.exception.request_id),
                         ("INVALID_API_KEY", 401, "req-1"))

    def test_network_error(self):
        opener = FakeOpener(urllib.error.URLError("connection refused"))
        with self.assertRaises(SukuuDataError) as ctx:
            SukuuData("k", opener=opener).regions.list()
        self.assertEqual((ctx.exception.code, ctx.exception.status), ("NETWORK_ERROR", 0))

    def test_paginate(self):
        opener = FakeOpener(
            FakeResponse({"success": True, "data": [1, 2], "pagination": {"page": 1, "limit": 2, "total": 3, "totalPages": 2}}),
            FakeResponse({"success": True, "data": [3], "pagination": {"page": 2, "limit": 2, "total": 3, "totalPages": 2}}),
        )
        client = SukuuData("k", opener=opener)
        self.assertEqual(list(client.paginate(client.schools.list, limit=2)), [1, 2, 3])

    def test_requires_key(self):
        with self.assertRaises(ValueError):
            SukuuData("")


@unittest.skipUnless(os.environ.get("SUKUUDATA_KEY"), "set SUKUUDATA_KEY to run against a live API")
class LiveTest(unittest.TestCase):
    def setUp(self):
        self.client = SukuuData(os.environ["SUKUUDATA_KEY"],
                                base_url=os.environ.get("SUKUUDATA_BASE_URL", "https://api.sukuudata.com"))

    def test_secondary_schools_and_validation(self):
        page = self.client.secondary_schools.list(programme="502", limit=2)
        self.assertTrue(page.data)
        school = self.client.secondary_schools.get("0010121")
        self.assertEqual(school["secondary"]["csspsCode"], "0010121")
        result = self.client.placement.validate([{"csspsCode": "0010121", "programme": "502", "residential": "BOARDING"}])
        self.assertIn("CHOICE_COUNT", [e["code"] for e in result["errors"]])
        self.assertEqual(self.client.placement.rules()["totalChoices"], 8)


if __name__ == "__main__":
    unittest.main()
