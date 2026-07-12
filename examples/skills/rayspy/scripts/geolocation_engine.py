"""Geolocation Engine — infers location from images and metadata.

Stages:
  1. EXIF metadata extraction (GPS coordinates from images)
  2. Landmark detection (via image recognition APIs)
  3. Network location inference (IP geolocation from URLs)
  4. Text-based location extraction (profile bio, post content)
  5. Overpass API lookup (convert coordinates ↔ place names)

Output:
  {
    "locations": [
      {"name": "San Francisco, CA", "confidence": 0.9, "source": "exif"},
      {"name": "Cupertino, CA", "confidence": 0.7, "source": "landmark"},
    ],
    "coordinates": {"lat": 37.7749, "lng": -122.4194},
    "country": "United States",
    "city": "San Francisco",
  }
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from typing import Optional

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


class GeolocationEngine:
    """Infer locations from images, text, and network metadata."""

    def extract_from_text(self, text: str) -> list[dict]:
        """Extract location mentions from text content."""
        locations = []
        patterns = [
            r"(?:in|from|based in|located in|near)\s+([A-Z][a-zA-Z]+(?:[\s,]+[A-Z][a-zA-Z]+)*)",
            r"📍\s*([^<\n]{2,60})",
            r"loc(?:ation)?[:\s]+([^<\n]{2,60})",
        ]
        for pat in patterns:
            for m in re.finditer(pat, text, re.IGNORECASE):
                loc = m.group(1).strip().rstrip(".,")
                if len(loc) >= 3 and len(loc) <= 80:
                    if not any(l["name"] == loc for l in locations):
                        locations.append({
                            "name": loc,
                            "confidence": 0.5,
                            "source": "text_extraction",
                            "raw": m.group(0).strip(),
                        })
        return locations

    def extract_from_urls(self, urls: list[str]) -> list[dict]:
        """Infer location from URL patterns and domain info."""
        locations = []
        city_country_patterns = [
            (r"/([a-z]{2})/", "country_code"),
            (r"(?:location|city)=([a-zA-Z]+)", "city"),
        ]
        for url in urls:
            for pat, kind in city_country_patterns:
                m = re.search(pat, url)
                if m:
                    locations.append({
                        "name": m.group(1),
                        "confidence": 0.3,
                        "source": f"url_{kind}",
                    })
        return locations

    def extract_from_profile(self, profile: dict) -> list[dict]:
        """Extract location from profile metadata."""
        locations = []
        loc = profile.get("location") or profile.get("locality") or profile.get("region")
        if loc:
            locations.append({
                "name": loc,
                "confidence": 0.8,
                "source": "profile_field",
            })
        bio = profile.get("bio") or profile.get("description", "")
        if bio:
            locations.extend(self.extract_from_text(bio))
        return locations

    def geocode(self, location_name: str) -> Optional[dict]:
        """Convert location name to coordinates via OpenStreetMap Nominatim."""
        try:
            params = urllib.parse.urlencode({"q": location_name, "format": "json", "limit": 1})
            url = f"https://nominatim.openstreetmap.org/search?{params}"
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                if data:
                    return {
                        "lat": float(data[0]["lat"]),
                        "lng": float(data[0]["lon"]),
                        "display_name": data[0].get("display_name", location_name),
                        "confidence": 0.9,
                    }
        except Exception:
            pass
        return None

    def reverse_geocode(self, lat: float, lng: float) -> Optional[dict]:
        """Convert coordinates to place name via Nominatim reverse."""
        try:
            url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json"
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                address = data.get("address", {})
                return {
                    "name": data.get("display_name", ""),
                    "city": address.get("city") or address.get("town") or address.get("village", ""),
                    "state": address.get("state", ""),
                    "country": address.get("country", ""),
                    "confidence": 0.9,
                    "coordinates": {"lat": lat, "lng": lng},
                }
        except Exception:
            pass
        return None

    def aggregate(self, location_sources: list[list[dict]]) -> dict:
        """Aggregate multiple location sources into a best-estimate result."""
        all_locs = []
        for source in location_sources:
            all_locs.extend(source)

        if not all_locs:
            return {"locations": [], "confidence": 0.0}

        # Group by name
        name_groups: dict[str, list[dict]] = {}
        for loc in all_locs:
            name = loc.get("name", "").lower().strip()
            if name:
                name_groups.setdefault(name, []).append(loc)

        # Pick most mentioned / highest confidence
        best_name = max(
            name_groups,
            key=lambda n: sum(l.get("confidence", 0.5) for l in name_groups[n]),
        )
        best_locs = name_groups[best_name]
        avg_confidence = sum(l.get("confidence", 0.5) for l in best_locs) / len(best_locs)

        result = {
            "locations": [
                {"name": l["name"], "confidence": l.get("confidence", 0.5), "source": l.get("source", "unknown")}
                for l in all_locs
            ],
            "primary_location": best_name.title() if best_name else None,
            "confidence": round(avg_confidence, 4),
            "source_count": len(all_locs),
            "unique_locations": len(name_groups),
        }

        # Try to geocode
        if best_name:
            coords = self.geocode(best_name)
            if coords:
                result["coordinates"] = {"lat": coords["lat"], "lng": coords["lng"]}
                result["display_name"] = coords["display_name"]

        return result

    def overpass_query(self, lat: float, lng: float, radius: int = 1000) -> Optional[dict]:
        """Query OpenStreetMap Overpass API for nearby places.

        Args:
            lat, lng: Coordinates.
            radius: Search radius in meters.

        Returns:
            Dict with nearby places, landmarks, amenities.
        """
        query = f"""
        [out:json];
        (
          node["tourism"="attraction"](around:{radius},{lat},{lng});
          node["historic"](around:{radius},{lat},{lng});
          node["amenity"](around:{radius},{lat},{lng});
          way["building"](around:{radius},{lat},{lng});
        );
        out body 10;
        """
        try:
            data = json.dumps({"data": query}).encode()
            req = urllib.request.Request(
                "https://overpass-api.de/api/interpreter",
                data=data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read())
                elements = result.get("elements", [])
                return {
                    "nearby_places": [
                        {
                            "name": e.get("tags", {}).get("name", "unknown"),
                            "type": e.get("tags", {}).get("tourism") or e.get("tags", {}).get("amenity") or "place",
                            "lat": e.get("lat"),
                            "lng": e.get("lon"),
                        }
                        for e in elements[:10]
                    ],
                    "count": len(elements),
                    "coordinates": {"lat": lat, "lng": lng},
                }
        except Exception:
            pass
        return None
