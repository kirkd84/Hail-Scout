"""Geocoding service abstraction with Nominatim and Mapbox implementations."""

from __future__ import annotations

from abc import ABC, abstractmethod

import httpx

from hailscout_api.core import GeocoderError, get_logger

logger = get_logger(__name__)


class Geocoder(ABC):
    """Abstract base for geocoding providers."""

    @abstractmethod
    async def geocode(
        self, address: str
    ) -> tuple[float, float, str]:
        """
        Geocode an address to coordinates.

        Args:
            address: Address string to geocode

        Returns:
            Tuple of (latitude, longitude, formatted_address)

        Raises:
            GeocoderError: If geocoding fails
        """
        pass


class NominatimGeocoder(Geocoder):
    """Nominatim (OpenStreetMap) geocoder - MVP implementation.

    Rate limit: 1 request per second.
    User-Agent must be set as per Nominatim policy.
    https://nominatim.org/release-docs/latest/api/Overview/
    """

    def __init__(self, user_agent: str = "HailScout/0.1.0 (+https://hailscout.com)") -> None:
        """Initialize Nominatim geocoder."""
        self.user_agent = user_agent
        self.base_url = "https://nominatim.openstreetmap.org"

    async def geocode(self, address: str) -> tuple[float, float, str]:
        """Geocode using Nominatim."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/search",
                    params={
                        "q": address,
                        "format": "json",
                        "limit": 1,
                    },
                    headers={"User-Agent": self.user_agent},
                    timeout=10,
                )
                response.raise_for_status()
                results = response.json()

                if not results:
                    raise GeocoderError(f"Address not found: {address}")

                result = results[0]
                lat = float(result["lat"])
                lng = float(result["lon"])
                formatted = result.get("display_name", address)

                logger.info(
                    "Geocoded address",
                    address=address,
                    lat=lat,
                    lng=lng,
                )
                return lat, lng, formatted

        except httpx.HTTPError as e:
            logger.error("Nominatim request failed", error=str(e), address=address)
            raise GeocoderError(f"Geocoding service unavailable") from e
        except (KeyError, ValueError) as e:
            logger.error(
                "Nominatim response parsing failed", error=str(e), address=address
            )
            raise GeocoderError(f"Invalid geocoding response") from e


class MapboxGeocoder(Geocoder):
    """Mapbox geocoder - future replacement for Nominatim."""

    def __init__(self, api_key: str) -> None:
        """Initialize Mapbox geocoder."""
        if not api_key:
            raise ValueError("Mapbox API key is required")
        self.api_key = api_key
        self.base_url = "https://api.mapbox.com/geocoding/v5"

    async def geocode(self, address: str) -> tuple[float, float, str]:
        """Geocode using Mapbox."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/mapbox.places/{address}.json",
                    params={"access_token": self.api_key, "limit": 1},
                    timeout=10,
                )
                response.raise_for_status()
                data = response.json()

                if not data.get("features"):
                    raise GeocoderError(f"Address not found: {address}")

                feature = data["features"][0]
                lng, lat = feature["geometry"]["coordinates"]
                formatted = feature.get("place_name", address)

                logger.info(
                    "Geocoded address via Mapbox",
                    address=address,
                    lat=lat,
                    lng=lng,
                )
                return float(lat), float(lng), formatted

        except httpx.HTTPError as e:
            logger.error("Mapbox request failed", error=str(e), address=address)
            raise GeocoderError(f"Geocoding service unavailable") from e
        except (KeyError, ValueError) as e:
            logger.error(
                "Mapbox response parsing failed", error=str(e), address=address
            )
            raise GeocoderError(f"Invalid geocoding response") from e


def get_geocoder(
    provider: str, nominatim_user_agent: str = "", mapbox_api_key: str = ""
) -> Geocoder:
    """Factory function to get the configured geocoder."""
    if provider == "mapbox":
        if not mapbox_api_key:
            raise ValueError(
                "Mapbox provider requires MAPBOX_API_KEY environment variable"
            )
        return MapboxGeocoder(mapbox_api_key)
    else:
        # Default to Nominatim
        return NominatimGeocoder(user_agent=nominatim_user_agent)
