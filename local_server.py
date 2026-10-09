import os
#!/usr/bin/env python3
import http.server
import socketserver
import json
import urllib.parse
from pathlib import Path
import random

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "matches.json"
PORT = int(os.environ.get("PORT", 8080))

def load_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def generate_custom_accumulator(day_key="today", risk="safe", count=3):
    data = load_data()
    days_data = data.get("days", {})
    day = days_data.get(day_key, days_data.get("today", {}))
    
    singles = day.get("singles", [])
    if not singles:
        singles = []
        for d in days_data.values():
            singles.extend(d.get("singles", []))

    if risk == "safe":
        candidates = [s for s in singles if s.get("type") in ["Safe", "Banker"] or s.get("confidence", 0) >= 84]
    elif risk == "medium":
        candidates = [s for s in singles if s.get("confidence", 0) >= 75]
    else: # fun
        candidates = [s for s in singles if s.get("odds", 0) >= 1.75 or s.get("type") == "Value"]

    if len(candidates) < count:
        candidates = singles

    random.shuffle(candidates)
    selected = candidates[:min(count, len(candidates))]

    total_odds = 1.0
    total_conf = 0
    for item in selected:
        total_odds *= item["odds"]
        total_conf += item["confidence"]

    avg_conf = round(total_conf / len(selected)) if selected else 0
    total_odds = round(total_odds, 2)

    return {
        "status": "success",
        "day": day_key,
        "risk_profile": risk,
        "total_odds": total_odds,
        "confidence": avg_conf,
        "picks_count": len(selected),
        "picks": selected,
        "ai_rationale": f"Combiné IA sur mesure ({day.get('label', '')}) : Cote totale de {total_odds} avec un indice de confiance de {avg_conf}%."
    }

def analyze_and_add_match(home, away, league, time_str, day_key="today"):
    data = load_data()
    if day_key not in data["days"]:
        day_key = "today"

    match_name = f"{home} vs {away}"
    
    # Heuristics based on teams
    has_messi = "messi" in home.lower() or "messi" in away.lower() or "miami" in home.lower() or "argentine" in home.lower() or "argentina" in home.lower()
    has_yamal = "barça" in home.lower() or "barcelone" in home.lower() or "barca" in home.lower() or "espagne" in home.lower() or "spain" in home.lower()

    if has_messi:
        pick = "Lionel Messi décisif (but ou passe)"
        market = "Buteur / Star"
        odds = 1.68
        confidence = 90
        type_str = "Banker"
        reason = f"Statistiques exceptionnelles du N°10 avec une implication dans plus de 80% des buts."
    elif has_yamal:
        pick = f"{home} ou Nul & Lamine Yamal décisif"
        market = "Double Chance & Prodige"
        odds = 1.82
        confidence = 88
        type_str = "Safe"
        reason = f"Lamine Yamal est le moteur offensif principal avec des créations d'occasions constantes."
    else:
        # Standard intelligent prediction
        pick = f"{home} ou Nul & Plus de 1.5 buts"
        market = "Double Chance & Buts"
        odds = 1.70
        confidence = 85
        type_str = "Safe"
        reason = f"Avantage à domicile pour {home} combiné à un rythme offensif favorable aux buts."

    new_single = {
        "id": f"s_custom_{random.randint(100, 999)}",
        "match": match_name,
        "league": league or "Football",
        "time": time_str or "20:45",
        "market": market,
        "pick": pick,
        "odds": odds,
        "confidence": confidence,
        "type": type_str,
        "reason": reason
    }

    data["days"][day_key]["singles"].insert(0, new_single)
    save_data(data)
    return new_single

class HNSTipsHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        url_parts = urllib.parse.urlparse(self.path)
        path = url_parts.path
        query = urllib.parse.parse_qs(url_parts.query)

        if path == "/" or path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            with open(BASE_DIR / "templates" / "index.html", "rb") as f:
                self.wfile.write(f.read())
            return

        elif path == "/api/data":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            data = load_data()
            
            day_req = query.get("day", [None])[0]
            if day_req and day_req in data.get("days", {}):
                resp_payload = {
                    "day_data": data["days"][day_req],
                    "all_days": list(data.get("days", {}).keys()),
                    "stats_summary": data.get("stats_summary", {})
                }
            else:
                resp_payload = data

            self.wfile.write(json.dumps(resp_payload, ensure_ascii=False).encode("utf-8"))
            return

        return super().do_GET()

    def do_POST(self):
        url_parts = urllib.parse.urlparse(self.path)
        path = url_parts.path

        if path == "/api/generate-accumulator":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            params = json.loads(body) if body else {}

            risk = params.get("risk", "safe")
            count = int(params.get("count", 3))
            day = params.get("day", "today")

            result = generate_custom_accumulator(day_key=day, risk=risk, count=count)

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
            return

        elif path == "/api/analyze-custom-match":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            params = json.loads(body) if body else {}

            home = params.get("home", "Équipe 1")
            away = params.get("away", "Équipe 2")
            league = params.get("league", "Football")
            time_str = params.get("time", "20:45")
            day_key = params.get("day", "today")

            new_pick = analyze_and_add_match(home, away, league, time_str, day_key)

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "pick": new_pick}, ensure_ascii=False).encode("utf-8"))
            return

        elif path == "/api/calculate-stake":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            params = json.loads(body) if body else {}

            bankroll = float(params.get("bankroll", 100))
            odds = float(params.get("odds", 2.0))
            confidence = float(params.get("confidence", 75)) / 100.0

            p = confidence
            q = 1.0 - p
            b = odds - 1.0
            kelly_pct = max(0.01, (b * p - q) / b) if b > 0 else 0.01
            safe_pct = min(0.05, kelly_pct * 0.25)
            stake = round(bankroll * safe_pct, 2)

            res = {
                "bankroll": bankroll,
                "recommended_stake": stake,
                "stake_percentage": round(safe_pct * 100, 1),
                "potential_gain": round(stake * odds, 2),
                "potential_profit": round((stake * odds) - stake, 2),
                "advice": "Gestion prudente : ne dépasse jamais 5% de ton capital sur un seul pari."
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), HNSTipsHandler) as httpd:
        print(f"🔥 Serveur HNS Tips démarré avec succès !")
        print(f"👉 Application accessible sur : http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()
