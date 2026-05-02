import json
import random
import os
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Literal

@dataclass
class Signal:
    source: str
    region: str
    metric: str
    value: float
    baseline: float | None
    timestamp: datetime
    confidence: float
    kind: Literal['measurement', 'news', 'weather', 'notice']

def zscore(value: float, baseline: float, sigma: float) -> float:
    if sigma <= 0:
        return 0.0
    return (value - baseline) / sigma

def signal_score(signals: list[Signal]) -> float:
    measurement = sum(min(35, s.confidence * 35) for s in signals if s.kind == 'measurement')
    weather = sum(min(20, s.confidence * 20) for s in signals if s.kind == 'weather')
    news = sum(min(25, s.confidence * 25) for s in signals if s.kind == 'news')
    notice = sum(min(20, s.confidence * 20) for s in signals if s.kind == 'notice')
    total = measurement + weather + news + notice
    cross_bonus = 10 if len({s.kind for s in signals}) >= 2 else 0
    return min(100, total + cross_bonus)

def generate_mock_data():
    now = datetime.now(timezone.utc)
    
    # Generate mock signals
    signals = [
        Signal("EURDEP", "Cattenom", "gamma", 95, 75, now, 0.8, "measurement"),
        Signal("WeatherAPI", "Cattenom", "wind", 20, 10, now, 0.6, "weather"),
        Signal("RNM", "Gravelines", "gamma", 66, 65, now, 0.9, "measurement"),
        Signal("Local News", "Doel", "keyword_spike", 5, 1, now, 0.4, "news")
    ]
    
    total_score = signal_score(signals)

    plants = [
        {"name": "Doel", "lat": 51.326, "lon": 4.258, "status": "watch", "baseline": 60, "val": random.randint(55, 75)},
        {"name": "Tihange", "lat": 50.534, "lon": 5.276, "status": "ok", "baseline": 70, "val": random.randint(65, 80)},
        {"name": "Gravelines", "lat": 51.015, "lon": 2.136, "status": "ok", "baseline": 65, "val": random.randint(60, 70)},
        {"name": "Chooz", "lat": 50.089, "lon": 4.789, "status": "ok", "baseline": 80, "val": random.randint(75, 85)},
        {"name": "Cattenom", "lat": 49.415, "lon": 6.218, "status": "risk" if total_score > 70 else "watch", "baseline": 75, "val": random.randint(90, 105)},
        {"name": "Nogent", "lat": 48.514, "lon": 3.518, "status": "ok", "baseline": 60, "val": random.randint(55, 65)},
        {"name": "Blayais", "lat": 45.256, "lon": -0.686, "status": "ok", "baseline": 55, "val": random.randint(50, 60)},
        {"name": "Golfech", "lat": 44.106, "lon": 0.845, "status": "ok", "baseline": 65, "val": random.randint(60, 70)},
        {"name": "Tricastin", "lat": 44.327, "lon": 4.732, "status": "ok", "baseline": 70, "val": random.randint(65, 75)},
        {"name": "Bugey", "lat": 45.798, "lon": 5.272, "status": "ok", "baseline": 75, "val": random.randint(70, 80)}
    ]

    # Generate 12 hours of trend data (for the sparkline)
    trend = [random.randint(30, 80) for _ in range(11)]
    trend.append(total_score) # latest score

    # Generate recent logs
    logs = [
        {"time": (now - timedelta(minutes=10)).strftime("%H:%M"), "level": "risk" if total_score > 70 else "watch", "msg": f"Cattenom: System scored {total_score:.0f} (elevated readings + weather)."},
        {"time": (now - timedelta(minutes=45)).strftime("%H:%M"), "level": "ok", "msg": "Routine EURDEP synchronization complete."},
        {"time": (now - timedelta(hours=2)).strftime("%H:%M"), "level": "watch", "msg": "Doel: Minor news keyword spike detected. No corroborating measurements."},
        {"time": (now - timedelta(hours=5)).strftime("%H:%M"), "level": "ok", "msg": "Daily baseline recalculation successful."}
    ]

    data = {
        "timestamp": now.isoformat(),
        "plants": plants,
        "total_score": round(total_score),
        "trend": trend,
        "logs": logs,
        "summary": f"Kernel assessment: Aggregate risk score is {total_score:.0f}/100. Signals show cross-confirmation across {(len({s.kind for s in signals}))} distinct sources."
    }
    
    return data

if __name__ == "__main__":
    data = generate_mock_data()
    
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "data")
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = os.path.join(output_dir, "latest.json")
    with open(output_file, "w") as f:
        json.dump(data, f, indent=2)
        
    print(f"Generated data written to {output_file}")
