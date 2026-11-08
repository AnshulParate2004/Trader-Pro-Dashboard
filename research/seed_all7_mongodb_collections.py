#!/usr/bin/env python3
"""
Seed the 3 Pure MongoDB Collections (that database) from the newly generated all-7 historical JSON files.
1. historical_trades_unified_1h <- src/data/unified_1h_historical_trades.json
2. historical_trades_unified_4h <- src/data/unified_4h_historical_trades.json
3. historical_trades_pure_rule  <- src/data/pure_rule_historical_trades.json
"""

import json
import sys
from pathlib import Path
from pymongo import MongoClient

ROOT_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard")
DATA_DIR = ROOT_DIR / "src" / "data"

MONGO_URI = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority"

def seed_collection(db, collection_name: str, json_path: Path, expected_timeframe: str = None, expected_model_id: str = None):
    print(f"\n--- Seeding {collection_name} from {json_path.name} ---")
    if not json_path.exists():
        raise FileNotFoundError(f"Missing file: {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        records = json.load(f)

    print(f"Loaded {len(records)} records from {json_path.name}")
    col = db[collection_name]

    # Verification of records
    timeframes = set(r.get("timeframe") for r in records)
    symbols = set(r.get("symbol") for r in records)
    model_ids = set(r.get("modelId") for r in records)

    print(f"  Timeframes in dataset: {timeframes}")
    print(f"  Symbols in dataset ({len(symbols)}): {sorted(list(symbols))}")
    print(f"  Model IDs in dataset: {model_ids}")

    if expected_timeframe:
        assert timeframes == {expected_timeframe}, f"Expected timeframe {expected_timeframe}, got {timeframes}"
    if expected_model_id:
        assert expected_model_id in model_ids, f"Expected modelId {expected_model_id} not found in {model_ids}"
    assert len(symbols) == 7, f"Expected 7 symbols, found {len(symbols)}: {symbols}"

    # Clear old collection and insert batch
    print(f"  Dropping existing collection {collection_name}...")
    col.drop()

    # Batch insert
    batch_size = 1000
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        col.insert_many(batch)
        print(f"  Inserted {min(i + batch_size, len(records))} / {len(records)} records...")

    count_in_db = col.count_documents({})
    print(f"  Successfully seeded {collection_name}! Total in MongoDB: {count_in_db}")

def main():
    print("=" * 80)
    print("SEEDING 3 PURE ALL-7 MONGODB COLLECTIONS")
    print("=" * 80)

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
    db = client["that"]

    # 1. 1H Unified
    seed_collection(
        db=db,
        collection_name="historical_trades_unified_1h",
        json_path=DATA_DIR / "unified_1h_historical_trades.json",
        expected_timeframe="1h",
        expected_model_id="unified-1h-engine"
    )

    # 2. 4H Unified
    seed_collection(
        db=db,
        collection_name="historical_trades_unified_4h",
        json_path=DATA_DIR / "unified_4h_historical_trades.json",
        expected_timeframe="4h",
        expected_model_id="unified-4h-engine"
    )

    # 3. Pure Rule
    seed_collection(
        db=db,
        collection_name="historical_trades_pure_rule",
        json_path=DATA_DIR / "pure_rule_historical_trades.json",
        expected_model_id="pure-rules-baseline"
    )

    print("\n" + "=" * 80)
    print("ALL 3 COLLECTIONS SEEDED AND VERIFIED IN MONGODB ATLAS ('that' database)")
    print("=" * 80)

if __name__ == "__main__":
    main()
