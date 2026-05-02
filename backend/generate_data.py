import json
import random
import os
from datetime import datetime, timezone

def generate_mock_data():
    now = datetime.now(timezone.utc).isoformat()
    
    # Generate random stations data around baselines
    plants = [
        {"name": "Doel", "lat": 51.326, "lon": 4.258, "status": "watch", "baseline": 60, "val": random.randint(55, 75)},
        {"name": "Tihange", "lat": 50.534, "lon": 5.276, "status": "ok", "baseline": 70, "val": random.randint(65, 80)},
        {"name": "Gravelines", "lat": 51.015, "lon": 2.136, "status": "ok", "baseline": 65, "val": random.randint(60, 70)},
        {"name": "Chooz", "lat": 50.089, "lon": 4.789, "status": "ok", "baseline": 80, "val": random.randint(75, 85)},
        {"name": "Cattenom", "lat": 49.415, "lon": 6.218, "status": "risk", "baseline": 75, "val": random.randint(90, 100)},
        {"name": "Nogent", "lat": 48.514, "lon": 3.518, "status": "ok", "baseline": 60, "val": random.randint(55, 65)},
        {"name": "Blayais", "lat": 45.256, "lon": -0.686, "status": "ok", "baseline": 55, "val": random.randint(50, 60)},
        {"name": "Golfech", "lat": 44.106, "lon": 0.845, "status": "ok", "baseline": 65, "val": random.randint(60, 70)},
        {"name": "Tricastin", "lat": 44.327, "lon": 4.732, "status": "ok", "baseline": 70, "val": random.randint(65, 75)},
        {"name": "Bugey", "lat": 45.798, "lon": 5.272, "status": "ok", "baseline": 75, "val": random.randint(70, 80)}
    ]

    # Overall score calculation based on mock logic
    scores = {
        "eurdep": random.randint(20, 45),
        "rnm": random.randint(30, 50),
        "news": random.randint(10, 40),
        "meteo": random.randint(10, 30)
    }
    
    total_score = min(100, (scores["eurdep"] + scores["rnm"] + scores["news"] + scores["meteo"]) // 2)

    data = {
        "timestamp": now,
        "plants": plants,
        "scores": scores,
        "total_score": total_score,
        "summary": "Mock summary: Readings at Cattenom are slightly elevated but within watch limits. Weather patterns indicate normal dispersion."
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
