#!/usr/bin/env python3
"""
Seed the MongoDB Collections ('that' database) for the 5-Engine Dashboard:
1. historical_trades_unified_1h    <- src/data/unified_1h_historical_trades.json (1,296 trades)
2. historical_trades_unified_4h    <- src/data/unified_4h_historical_trades.json (319 trades)
3. paper_trades_unified_1h         <- src/data/live_executed_trades.json (37 trades)
4. historical_trades_distributed_1h<- src/data/distributed_1h_historical_trades.json (1,994 trades)
5. historical_trades_distributed_4h<- src/data/distributed_4h_historical_trades.json (1,174 trades)
6. paper_trades_distributed_1h     <- src/data/distributed_1h_live_trades.json (33 trades)
7. paper_trades_distributed_4h     <- src/data/distributed_4h_live_trades.json (13 trades)
"""

import json
import sys
from pathlib import Path
from pymongo import MongoClient

ROOT_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard")
DATA_DIR = ROOT_DIR / "src" / "data"

MONGO_URI = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority"

def seed_collection(db, collection_name: str, json_path: Path):
    print(f"\n--- Seeding {collection_name} from {json_path.name} ---")
    if not json_path.exists():
        raise FileNotFoundError(f"Missing file: {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        records = json.load(f)

    print(f"Loaded {len(records)} records from {json_path.name}")
    col = db[collection_name]

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
    print("SEEDING MONGODB COLLECTIONS FOR 5-ENGINE DASHBOARD")
    print("=" * 80)

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
    db = client["that"]

    # 1. Historical Unified 1H
    seed_collection(
        db=db,
        collection_name="historical_trades_unified_1h",
        json_path=DATA_DIR / "unified_1h_historical_trades.json"
    )

    # 2. Historical Unified 4H
    seed_collection(
        db=db,
        collection_name="historical_trades_unified_4h",
        json_path=DATA_DIR / "unified_4h_historical_trades.json"
    )

    # 3. Live Unified 1H (37 trades)
    seed_collection(
        db=db,
        collection_name="paper_trades_unified_1h",
        json_path=DATA_DIR / "live_executed_trades.json"
    )

    # 4. Historical Distributed 1H (1,994 trades)
    seed_collection(
        db=db,
        collection_name="historical_trades_distributed_1h",
        json_path=DATA_DIR / "distributed_1h_historical_trades.json"
    )

    # 5. Historical Distributed 4H (1,174 trades)
    seed_collection(
        db=db,
        collection_name="historical_trades_distributed_4h",
        json_path=DATA_DIR / "distributed_4h_historical_trades.json"
    )

    # 6. Live Distributed 1H (33 trades)
    seed_collection(
        db=db,
        collection_name="paper_trades_distributed_1h",
        json_path=DATA_DIR / "distributed_1h_live_trades.json"
    )

    # 7. Live Distributed 4H (13 trades)
    seed_collection(
        db=db,
        collection_name="paper_trades_distributed_4h",
        json_path=DATA_DIR / "distributed_4h_live_trades.json"
    )

    print("\n" + "=" * 80)
    print("ALL MONGODB COLLECTIONS SEEDED AND VERIFIED IN ATLAS ('that' database)")
    print("=" * 80)

if __name__ == "__main__":
    main()
