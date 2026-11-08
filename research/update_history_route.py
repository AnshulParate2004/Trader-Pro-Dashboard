from pathlib import Path

p = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/src/app/api/history/route.ts")
content = p.read_text(encoding="utf-8")

old_block = """    if (modelParam === "distributed-1h-engine") {
      targetCollection = "historical_trades_distributed_1h";
      fallbackFile = "distributed_1h_historical_trades.json";
    } else if (modelParam === "unified-4h-engine" || modelParam === "4h-swing-meta-017") {
      targetCollection = "historical_trades_unified_4h";
      fallbackFile = "unified_4h_historical_trades.json";
    } else if (modelParam === "distributed-4h-engine") {
      targetCollection = "historical_trades_distributed_4h";
      fallbackFile = "distributed_4h_historical_trades.json";
    } else if (modelParam === "pure-rules-baseline") {
      targetCollection = "historical_trades_pure_rule";
      fallbackFile = "pure_rule_historical_trades.json";
    } else {
      targetCollection = "historical_trades_unified_1h";
      fallbackFile = "unified_1h_historical_trades.json";
    }"""

new_block = """    if (modelParam === "distributed-1h-engine") {
      targetCollection = "historical_trades_distributed_1h";
      fallbackFile = "distributed_1h_historical_trades.json";
    } else if (modelParam === "unified-4h-engine" || modelParam === "4h-swing-meta-017") {
      targetCollection = "historical_trades_unified_4h";
      fallbackFile = "unified_4h_historical_trades.json";
    } else if (modelParam === "distributed-4h-engine") {
      targetCollection = "historical_trades_distributed_4h";
      fallbackFile = "distributed_4h_historical_trades.json";
    } else if (modelParam === "pure-rules-4h-baseline") {
      targetCollection = "historical_trades_pure_rules_4h";
      fallbackFile = "pure_rules_4h_historical_trades.json";
    } else if (modelParam === "pure-rules-1h-baseline" || modelParam === "pure-rules-baseline") {
      targetCollection = "historical_trades_pure_rules_1h";
      fallbackFile = "pure_rules_1h_historical_trades.json";
    } else {
      targetCollection = "historical_trades_unified_1h";
      fallbackFile = "unified_1h_historical_trades.json";
    }"""

assert old_block in content, "old_block not found in history/route.ts"
content = content.replace(old_block, new_block)
p.write_text(content, encoding="utf-8")
print("Successfully updated src/app/api/history/route.ts!")
