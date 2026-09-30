"""Official Python client for the SukuuData API.

Ghana's schools, the 2026 GES SHS placement register and CSSPS school-choice validation.

    from sukuudata import SukuuData

    sukuu = SukuuData(api_key="sukuu_live_...")
    page = sukuu.secondary_schools.list(programme="502", residential="BOARDING", region="ashanti")
"""

from ._client import Page, RateLimit, SukuuData, SukuuDataError

__all__ = ["SukuuData", "SukuuDataError", "Page", "RateLimit"]
__version__ = "0.1.0"
