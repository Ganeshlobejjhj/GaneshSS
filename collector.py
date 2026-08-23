import json
import os
import urllib.request

DATA_FILE = "data.json"
API_URL_W30S = "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json"
API_URL_PROXY = "https://k3-proxy.vercel.app/"

def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data[:500], f, indent=2)

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode())

def run():
    current_data = load_data()
    existing_periods = {str(item.get("period")) for item in current_data}
    
    try:
        w30s_res = fetch_json(API_URL_W30S)
        items = w30s_res.get("data", {}).get("list", [])
        
        new_records = []
        for item in reversed(items):
            period = str(item.get("issueNumber"))
            if period not in existing_periods:
                num = int(item.get("number", 0))
                size = "BIG" if num >= 5 else "SMALL"
                new_records.append({
                    "period": period,
                    "number": num,
                    "size": size
                })
        
        if new_records:
            updated_data = new_records + current_data
            save_data(updated_data)
            print(f"Recorded {len(new_records)} new rounds in GitHub Cloud!")
        else:
            print("No new rounds.")
    except Exception as e:
        print(f"Fetch error: {e}")

if __name__ == "__main__":
    run()
