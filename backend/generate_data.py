"""
Nuclear Sentinel — Smart Kernel
Generates frontend/data/latest.json by pulling from real public APIs:
  • Safecast (open radiation measurements near each plant)
  • Open-Meteo (wind speed/direction, temperature, precipitation near each plant)
  • ASN / FANC RSS feeds (regulator notices, parsed for plant keywords)
Then scores anomalies with z-scores and cross-source confirmation,
and writes a single JSON payload for the static Netlify frontend.
"""

import json
import os
import statistics
import xml.etree.ElementTree as ET
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Literal
from urllib.request import urlopen, Request
from urllib.error import URLError

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

PLANTS = [
    # Ukraine — War-zone high-risk
    {"name": "Zaporizhzhia",  "lat": 47.510, "lon": 34.590, "country": "UA", "priority": "high"},
    {"name": "South Ukraine", "lat": 47.812, "lon": 31.215, "country": "UA", "priority": "high"},
    {"name": "Khmelnytskyi", "lat": 50.296, "lon": 26.658, "country": "UA", "priority": "high"},
    {"name": "Rivne",         "lat": 51.387, "lon": 25.895, "country": "UA", "priority": "high"},
    # Belgium — Priority
    {"name": "Doel",            "lat": 51.326, "lon": 4.258,  "country": "BE", "priority": "high"},
    {"name": "Tihange",         "lat": 50.534, "lon": 5.276,  "country": "BE", "priority": "high"},
    # France — Border focus
    {"name": "Gravelines",      "lat": 51.015, "lon": 2.136,  "country": "FR", "priority": "high"},
    {"name": "Chooz",           "lat": 50.089, "lon": 4.789,  "country": "FR", "priority": "high"},
    {"name": "Cattenom",        "lat": 49.415, "lon": 6.218,  "country": "FR", "priority": "high"},
    {"name": "Nogent-sur-Seine","lat": 48.514, "lon": 3.518,  "country": "FR", "priority": "medium"},
    {"name": "Tricastin",       "lat": 44.327, "lon": 4.732,  "country": "FR", "priority": "medium"},
    {"name": "Bugey",           "lat": 45.798, "lon": 5.272,  "country": "FR", "priority": "medium"},
    {"name": "Blayais",         "lat": 45.256, "lon":-0.686,  "country": "FR", "priority": "medium"},
    {"name": "Golfech",         "lat": 44.106, "lon": 0.845,  "country": "FR", "priority": "low"},
    # Additional France
    {"name": "Belleville",      "lat": 47.514, "lon": 2.876,  "country": "FR", "priority": "low"},
    {"name": "Chinon",          "lat": 47.230, "lon": 0.169,  "country": "FR", "priority": "low"},
    {"name": "Civaux",          "lat": 46.443, "lon": 0.654,  "country": "FR", "priority": "low"},
    {"name": "Cruas",           "lat": 44.633, "lon": 4.757,  "country": "FR", "priority": "low"},
    {"name": "Dampierre",       "lat": 47.731, "lon": 2.518,  "country": "FR", "priority": "low"},
    {"name": "Flamanville",     "lat": 49.538, "lon":-1.881,  "country": "FR", "priority": "low"},
    {"name": "Paluel",          "lat": 49.859, "lon": 0.633,  "country": "FR", "priority": "low"},
    {"name": "Penly",           "lat": 49.976, "lon": 1.210,  "country": "FR", "priority": "low"},
    {"name": "Saint-Alban",     "lat": 45.407, "lon": 4.754,  "country": "FR", "priority": "low"},
    {"name": "Saint-Laurent",   "lat": 47.721, "lon": 1.579,  "country": "FR", "priority": "low"},
]

# Only fetch detailed data for high/medium priority plants
DETAILED_PLANTS = [p for p in PLANTS if p["priority"] in ("high", "medium")]

@dataclass
class Signal:
    source: str
    region: str
    metric: str
    value: float
    baseline: float
    timestamp: str
    confidence: float
    kind: Literal["measurement", "news", "weather", "notice"]

# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def zscore(value: float, baseline: float, sigma: float) -> float:
    if sigma <= 0:
        return 0.0
    return (value - baseline) / sigma

def signal_score(signals: list[Signal]) -> float:
    measurement = sum(min(35, s.confidence * 35) for s in signals if s.kind == "measurement")
    weather     = sum(min(20, s.confidence * 20) for s in signals if s.kind == "weather")
    news        = sum(min(25, s.confidence * 25) for s in signals if s.kind == "news")
    notice      = sum(min(20, s.confidence * 20) for s in signals if s.kind == "notice")
    total = measurement + weather + news + notice
    cross_bonus = 10 if len({s.kind for s in signals}) >= 2 else 0
    return min(100, total + cross_bonus)

# ---------------------------------------------------------------------------
# Collectors — Real APIs (stdlib only, no pip dependencies)
# ---------------------------------------------------------------------------

def _fetch_json(url: str, timeout: int = 15):
    """Fetch JSON from a URL using only stdlib."""
    req = Request(url, headers={"User-Agent": "NuclearSentinel/1.0"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except (URLError, json.JSONDecodeError, Exception) as e:
        print(f"  [WARN] fetch failed for {url[:80]}…: {e}")
        return None

def _fetch_text(url: str, timeout: int = 15) -> str | None:
    req = Request(url, headers={"User-Agent": "NuclearSentinel/1.0"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  [WARN] fetch failed for {url[:80]}…: {e}")
        return None

# ---- Safecast (open radiation data, no key needed) ----

def fetch_safecast(lat: float, lon: float, distance_km: int = 50, limit: int = 50) -> list[dict]:
    """Fetch recent Safecast radiation readings near a coordinate."""
    url = (
        f"https://api.safecast.org/measurements.json"
        f"?latitude={lat}&longitude={lon}"
        f"&distance={distance_km * 1000}"  # API uses meters
        f"&limit={limit}"
        f"&order=captured_at+desc"
    )
    data = _fetch_json(url)
    if not data or not isinstance(data, list):
        return []
    return data

# ---- Open-Meteo (free weather, no key needed) ----

def fetch_weather(lat: float, lon: float) -> dict | None:
    """Fetch current weather conditions for a coordinate."""
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,rain"
        f"&timezone=Europe%2FBerlin"
    )
    data = _fetch_json(url)
    if data and "current" in data:
        return data["current"]
    return None

# ---- ASN (France) RSS ----

RSS_FEEDS = [
    ("ASN", "https://www.asn.fr/rss"),
    ("ASN-Avis", "https://www.asn.fr/rss/avis"),
    ("FANC", "https://fanc.fgov.be/nl/rss.xml"),
    ("IAEA", "https://www.iaea.org/feeds/topical/safeguards.xml"),
]

PLANT_KEYWORDS = [p["name"].lower().split("-")[0] for p in PLANTS]  # first word
# Add Ukraine-specific terms so RSS can flag Ukrainian plant news
UKRAINE_KEYWORDS = ["zaporizhzhia", "zaporizhia", "znpp", "rivne", "khmelnytsk", "south ukraine",
                    "enerhodar", "ukraine nuclear", "ukrainian nuclear", "iaea ukraine"]

def fetch_rss_notices() -> list[dict]:
    """Fetch and parse RSS feeds, returning items that mention plant names."""
    items = []
    for source_name, feed_url in RSS_FEEDS:
        xml_text = _fetch_text(feed_url)
        if not xml_text:
            continue
        try:
            root = ET.fromstring(xml_text)
            for item in root.iter("item"):
                title_el = item.find("title")
                desc_el = item.find("description")
                link_el = item.find("link")
                pubdate_el = item.find("pubDate")
                title = title_el.text if title_el is not None and title_el.text else ""
                desc = desc_el.text if desc_el is not None and desc_el.text else ""
                link = link_el.text if link_el is not None and link_el.text else ""
                pubdate = pubdate_el.text if pubdate_el is not None and pubdate_el.text else ""
                combined = (title + " " + desc).lower()
                matched_plants = [kw for kw in PLANT_KEYWORDS if kw in combined]
                ukraine_hit = any(kw in combined for kw in UKRAINE_KEYWORDS)
                items.append({
                    "source": source_name,
                    "title": title,
                    "link": link,
                    "pubdate": pubdate,
                    "matched_plants": matched_plants,
                    "is_nuclear_mention": bool(matched_plants) or ukraine_hit or any(
                        w in combined for w in ["nucléaire", "nuclear", "radioact", "incident", "rejet"]
                    ),
                })
        except ET.ParseError:
            print(f"  [WARN] RSS parse error for {source_name}")
    return items

# ---------------------------------------------------------------------------
# Main kernel
# ---------------------------------------------------------------------------

def run_kernel():
    now = datetime.now(timezone.utc)
    print(f"[{now.isoformat()}] Nuclear Sentinel kernel starting…")

    all_signals: list[Signal] = []
    plant_results = []
    connector_status = {
        "safecast": "offline",
        "open_meteo": "offline",
        "rss_feeds": "offline",
    }

    # 1. Fetch RSS notices (once for all plants)
    print("  Fetching RSS feeds…")
    rss_items = fetch_rss_notices()
    if rss_items:
        connector_status["rss_feeds"] = "online"
    nuclear_rss = [i for i in rss_items if i["is_nuclear_mention"]]

    # 2. For each detailed plant, fetch radiation + weather
    for plant in DETAILED_PLANTS:
        name = plant["name"]
        lat, lon = plant["lat"], plant["lon"]
        print(f"  Processing {name} ({lat}, {lon})…")

        # --- Safecast radiation ---
        readings = fetch_safecast(lat, lon, distance_km=80, limit=30)
        cpm_values = [r["value"] for r in readings if r.get("value") is not None and r["value"] > 0]

        rad_val = None
        rad_baseline = None
        rad_sigma = None
        rad_zscore = 0.0
        rad_confidence = 0.0

        if len(cpm_values) >= 3:
            connector_status["safecast"] = "online"
            rad_val = statistics.mean(cpm_values[:5]) if len(cpm_values) >= 5 else cpm_values[0]
            rad_baseline = statistics.median(cpm_values)
            rad_sigma = statistics.stdev(cpm_values) if len(cpm_values) >= 3 else 5.0
            rad_zscore = zscore(rad_val, rad_baseline, rad_sigma)
            # Confidence: high if z-score > 2, moderate if > 1
            rad_confidence = min(1.0, max(0.0, abs(rad_zscore) / 3.0))
            all_signals.append(Signal(
                source="Safecast",
                region=name,
                metric="gamma_cpm",
                value=round(rad_val, 1),
                baseline=round(rad_baseline, 1),
                timestamp=now.isoformat(),
                confidence=round(rad_confidence, 2),
                kind="measurement",
            ))

        # --- Weather ---
        weather = fetch_weather(lat, lon)
        wind_speed = None
        wind_dir = None
        temp = None
        precip = None

        if weather:
            connector_status["open_meteo"] = "online"
            wind_speed = weather.get("wind_speed_10m")
            wind_dir = weather.get("wind_direction_10m")
            temp = weather.get("temperature_2m")
            precip = weather.get("precipitation", 0) or weather.get("rain", 0)
            # Weather stress: high wind + rain can wash out or transport radioactive particles
            weather_stress = 0.0
            if wind_speed and wind_speed > 25:
                weather_stress += 0.4
            if precip and precip > 2:
                weather_stress += 0.3
            if temp and temp > 35:
                weather_stress += 0.3  # heat stress on cooling
            if weather_stress > 0:
                all_signals.append(Signal(
                    source="Open-Meteo",
                    region=name,
                    metric="weather_stress",
                    value=round(weather_stress, 2),
                    baseline=0.0,
                    timestamp=now.isoformat(),
                    confidence=round(min(1.0, weather_stress), 2),
                    kind="weather",
                ))

        # --- RSS mentions for this plant ---
        plant_keyword = name.lower().split("-")[0]
        plant_rss = [i for i in nuclear_rss if plant_keyword in " ".join(i.get("matched_plants", []))]
        if plant_rss:
            all_signals.append(Signal(
                source="RSS",
                region=name,
                metric="news_mentions",
                value=float(len(plant_rss)),
                baseline=0.0,
                timestamp=now.isoformat(),
                confidence=min(1.0, len(plant_rss) * 0.3),
                kind="notice",
            ))

        # --- Determine status ---
        plant_signals = [s for s in all_signals if s.region == name]
        plant_score = signal_score(plant_signals) if plant_signals else 0

        status = "ok"
        if plant_score >= 70:
            status = "risk"
        elif plant_score >= 40:
            status = "watch"
        elif rad_zscore and abs(rad_zscore) > 1.5:
            status = "watch"

        plant_results.append({
            "name": name,
            "lat": lat,
            "lon": lon,
            "country": plant["country"],
            "priority": plant["priority"],
            "status": status,
            "baseline": round(rad_baseline, 1) if rad_baseline else None,
            "val": round(rad_val, 1) if rad_val else None,
            "unit": "cpm",
            "zscore": round(rad_zscore, 2) if rad_zscore else 0,
            "wind_speed": round(wind_speed, 1) if wind_speed else None,
            "wind_dir": round(wind_dir) if wind_dir else None,
            "temp": round(temp, 1) if temp else None,
            "precip": round(precip, 1) if precip else None,
            "rss_mentions": len(plant_rss) if plant_rss else 0,
            "sample_count": len(cpm_values),
        })

    # Add low-priority plants with wind data (skip expensive Safecast/RSS)
    for plant in PLANTS:
        if plant["priority"] == "low" and not any(p["name"] == plant["name"] for p in plant_results):
            print(f"  Weather-only for {plant['name']}…")
            weather = fetch_weather(plant["lat"], plant["lon"])
            wind_speed = wind_dir = temp = precip = None
            if weather:
                connector_status["open_meteo"] = "online"
                wind_speed = weather.get("wind_speed_10m")
                wind_dir = weather.get("wind_direction_10m")
                temp = weather.get("temperature_2m")
                precip = weather.get("precipitation", 0) or weather.get("rain", 0)
            plant_results.append({
                "name": plant["name"],
                "lat": plant["lat"],
                "lon": plant["lon"],
                "country": plant["country"],
                "priority": "low",
                "status": "ok",
                "baseline": None,
                "val": None,
                "unit": "cpm",
                "zscore": 0,
                "wind_speed": round(wind_speed, 1) if wind_speed is not None else None,
                "wind_dir": round(wind_dir) if wind_dir is not None else None,
                "temp": round(temp, 1) if temp is not None else None,
                "precip": round(precip, 1) if precip is not None else None,
                "rss_mentions": 0,
                "sample_count": 0,
            })

    # 3. Global score — per-plant weighted blend, prevents multi-plant stacking to 100
    # signal_score() was designed for a single plant; summing all plants inflates it.
    per_plant_scores = []
    for res in plant_results:
        plant_sigs = [s for s in all_signals if s.region == res["name"]]
        if plant_sigs:
            per_plant_scores.append(signal_score(plant_sigs))

    if per_plant_scores:
        max_ps   = max(per_plant_scores)
        mean_ps  = statistics.mean(per_plant_scores)
        # Worst plant drives 70% of the score; average drives 30%
        total_score = round(min(100, 0.7 * max_ps + 0.3 * mean_ps))
    else:
        total_score = 0

    # 4. Build trend (simple: use plant scores as proxy)
    scored_plants = [p for p in plant_results if p["val"] is not None]
    trend_values = [abs(p.get("zscore", 0)) * 20 for p in scored_plants[:12]]
    while len(trend_values) < 12:
        trend_values.append(0)
    trend_values = [min(100, max(2, int(v))) for v in trend_values]

    # 5. Build event logs
    logs = []
    for p in plant_results:
        if p["status"] == "risk":
            logs.append({"time": now.strftime("%H:%M"), "level": "risk",
                         "msg": f"{p['name']}: z-score {p['zscore']}, wind {p['wind_speed']} km/h. Elevated."})
        elif p["status"] == "watch":
            logs.append({"time": now.strftime("%H:%M"), "level": "watch",
                         "msg": f"{p['name']}: z-score {p['zscore']}. Watching."})

    if connector_status["safecast"] == "online":
        logs.append({"time": now.strftime("%H:%M"), "level": "ok",
                     "msg": f"Safecast sync complete. {sum(p['sample_count'] for p in plant_results)} readings ingested."})
    if nuclear_rss:
        logs.append({"time": now.strftime("%H:%M"), "level": "watch",
                     "msg": f"RSS: {len(nuclear_rss)} nuclear-related items found across {len(RSS_FEEDS)} feeds."})
    else:
        logs.append({"time": now.strftime("%H:%M"), "level": "ok",
                     "msg": "RSS feeds scanned. No nuclear-related items detected."})

    logs.append({"time": now.strftime("%H:%M"), "level": "ok",
                 "msg": "Kernel cycle complete."})

    # 6. Build summary
    risk_plants = [p["name"] for p in plant_results if p["status"] == "risk"]
    watch_plants = [p["name"] for p in plant_results if p["status"] == "watch"]
    summary_parts = [f"Score: {total_score}/100."]
    if risk_plants:
        summary_parts.append(f"Risk: {', '.join(risk_plants)}.")
    if watch_plants:
        summary_parts.append(f"Watch: {', '.join(watch_plants)}.")
    sources_online = sum(1 for v in connector_status.values() if v == "online")
    summary_parts.append(f"{sources_online}/{len(connector_status)} connectors online.")
    summary = " ".join(summary_parts)

    # 7. RSS items for frontend
    rss_display = []
    for item in rss_items[:10]:
        rss_display.append({
            "source": item["source"],
            "title": item["title"][:120],
            "link": item["link"],
            "nuclear": item["is_nuclear_mention"],
        })

    # 8. Assemble payload
    payload = {
        "timestamp": now.isoformat(),
        "plants": plant_results,
        "total_score": total_score,
        "trend": trend_values,
        "logs": logs,
        "summary": summary,
        "connectors": connector_status,
        "rss_items": rss_display,
        "signals": [asdict(s) for s in all_signals],
    }

    return payload


if __name__ == "__main__":
    data = run_kernel()

    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "data")
    os.makedirs(output_dir, exist_ok=True)

    output_file = os.path.join(output_dir, "latest.json")
    with open(output_file, "w") as f:
        json.dump(data, f, indent=2)

    # Append to rolling 12-hour history
    history_file = os.path.join(output_dir, "history.json")
    try:
        with open(history_file) as f:
            history = json.load(f)
        if not isinstance(history, list):
            history = []
    except (FileNotFoundError, json.JSONDecodeError):
        history = []

    snapshot = {
        "ts": data["timestamp"],
        "score": data["total_score"],
        "plant_zscores": {
            p["name"]: p["zscore"]
            for p in data["plants"]
            if p.get("val") is not None
        },
    }
    history.append(snapshot)
    history = history[-12:]  # keep last 12 cycles (12 hours at hourly cadence)

    with open(history_file, "w") as f:
        json.dump(history, f, indent=2)

    print(f"\nDone. Written to {output_file}")
    print(f"  History entries: {len(history)}")
    print(f"  Total score: {data['total_score']}")
    print(f"  Plants: {len(data['plants'])}")
    print(f"  Signals: {len(data['signals'])}")
    print(f"  Connectors: {data['connectors']}")
