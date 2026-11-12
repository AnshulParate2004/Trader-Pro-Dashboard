#!/usr/bin/env python3
"""
scripts/fetch_sec_edgar_data.py

Phase 2 SEC XBRL Data Fetcher & Local Cache.
Fetches official SEC EDGAR company facts and submissions JSON for all study tickers
using standard rate-limiting (max 8 requests/sec) and caches them in data/sec_edgar/.
"""

import os
import sys
import json
import time
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CACHE_DIR = os.path.join(BASE_DIR, "data", "sec_edgar")
FACTS_DIR = os.path.join(CACHE_DIR, "companyfacts")
SUBS_DIR = os.path.join(CACHE_DIR, "submissions")

os.makedirs(FACTS_DIR, exist_ok=True)
os.makedirs(SUBS_DIR, exist_ok=True)

USER_AGENT = "QuantResearchAgent admin@tradeproquant.com"
HEADERS = {"User-Agent": USER_AGENT}

# Load universe tickers
CONFIG_PATH = os.path.join(BASE_DIR, "config", "us_equities", "universe.json")
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    univ = json.load(f)

pit = univ.get("monthly_pit_constituents", {})
pit_tickers = sorted(list(set(t for tickers in pit.values() for t in tickers)))
missing_task_b = ["BA", "C", "COP", "GILD", "MCD", "PYPL", "SLB", "UTX", "WFC"]
ALL_TICKERS = sorted(list(set(pit_tickers + missing_task_b)))

print(f"Total study tickers to verify with SEC EDGAR: {len(ALL_TICKERS)}")

# 1. Fetch SEC Company Tickers map
tickers_map_path = os.path.join(CACHE_DIR, "company_tickers.json")
if not os.path.exists(tickers_map_path):
    print("Fetching official SEC company_tickers.json...")
    req = urllib.request.Request("https://www.sec.gov/files/company_tickers.json", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = resp.read().decode("utf-8")
        with open(tickers_map_path, "w", encoding="utf-8") as f:
            f.write(data)

with open(tickers_map_path, "r", encoding="utf-8") as f:
    sec_tickers_raw = json.load(f)

ticker_to_cik = {}
for item in sec_tickers_raw.values():
    t = item["ticker"].upper()
    ticker_to_cik[t] = item["cik_str"]

# Manual overrides for special ticker symbols / mergers
SPECIAL_CIK_MAP = {
    "BRK-B": 1067983,
    "BRK.B": 1067983,
    "UTX": 101829, # Raytheon / United Technologies
}

def get_cik_for_ticker(ticker: str) -> int:
    if ticker in SPECIAL_CIK_MAP:
        return SPECIAL_CIK_MAP[ticker]
    clean_t = ticker.replace("-", ".").replace("/", ".")
    if ticker in ticker_to_cik:
        return ticker_to_cik[ticker]
    if clean_t in ticker_to_cik:
        return ticker_to_cik[clean_t]
    if ticker.replace("-", "") in ticker_to_cik:
        return ticker_to_cik[ticker.replace("-", "")]
    raise ValueError(f"Could not map ticker {ticker} to SEC CIK")

# 2. Fetch Facts and Submissions
success_count = 0
for idx, ticker in enumerate(ALL_TICKERS, 1):
    try:
        cik = get_cik_for_ticker(ticker)
        cik_str = str(cik).zfill(10)
        
        facts_file = os.path.join(FACTS_DIR, f"CIK{cik_str}.json")
        subs_file = os.path.join(SUBS_DIR, f"CIK{cik_str}.json")
        
        # Submissions (contains SIC code and fiscal year end)
        if not os.path.exists(subs_file):
            subs_url = f"https://data.sec.gov/submissions/CIK{cik_str}.json"
            req = urllib.request.Request(subs_url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                content = resp.read().decode("utf-8")
                with open(subs_file, "w", encoding="utf-8") as f:
                    f.write(content)
            time.sleep(0.12) # Respectful rate limiting <= 8 req/sec
            
        # Company Facts (contains full XBRL financial statement tags)
        if not os.path.exists(facts_file):
            facts_url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik_str}.json"
            req = urllib.request.Request(facts_url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                content = resp.read().decode("utf-8")
                with open(facts_file, "w", encoding="utf-8") as f:
                    f.write(content)
            time.sleep(0.12)
            
        success_count += 1
        if idx % 10 == 0 or idx == len(ALL_TICKERS):
            print(f"[{idx}/{len(ALL_TICKERS)}] Cached SEC facts & submissions for {ticker} (CIK: {cik_str})")
            
    except Exception as e:
        print(f"Error fetching SEC data for {ticker}: {e}")

print(f"\nSuccessfully cached {success_count} / {len(ALL_TICKERS)} SEC EDGAR company profiles.")
