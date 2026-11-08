from pathlib import Path

p = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/src/app/api/trades/route.ts")
content = p.read_text(encoding="utf-8")

old_sync = """  const is4H = modelId === "unified-4h-engine" || modelId === "4h-swing-meta-017";

  const isPure = modelId === "pure-rules-baseline";



  const collectionName = is4H

    ? "paper_trades_unified_4h"

    : isPure

    ? "benchmark_pure_rules"

    : "paper_trades_unified_1h";"""

new_sync = """  const is4H = modelId === "unified-4h-engine" || modelId === "4h-swing-meta-017";
  const is4HRules = modelId === "pure-rules-4h-baseline";
  const is1HRules = modelId === "pure-rules-1h-baseline" || modelId === "pure-rules-baseline";

  const collectionName = is4H
    ? "paper_trades_unified_4h"
    : is4HRules
    ? "benchmark_pure_rules_4h"
    : is1HRules
    ? "benchmark_pure_rules_1h"
    : "paper_trades_unified_1h";"""

old_target = """    if (activeModelId === "distributed-1h-engine") {
      targetCollection = "paper_trades_distributed_1h";
      fallbackFile = "distributed_1h_live_trades.json";
    } else if (activeModelId === "unified-4h-engine" || activeModelId === "4h-swing-meta-017") {
      targetCollection = "paper_trades_unified_4h";
      fallbackFile = "live_4h_executed_trades.json";
    } else if (activeModelId === "distributed-4h-engine") {
      targetCollection = "paper_trades_distributed_4h";
      fallbackFile = "distributed_4h_live_trades.json";
    } else if (activeModelId === "pure-rules-baseline") {
      targetCollection = "benchmark_pure_rules";
      fallbackFile = "pure_rules_executed_trades.json";
    } else {
      targetCollection = "paper_trades_unified_1h";
      fallbackFile = "live_executed_trades.json";
    }"""

new_target = """    if (activeModelId === "distributed-1h-engine") {
      targetCollection = "paper_trades_distributed_1h";
      fallbackFile = "distributed_1h_live_trades.json";
    } else if (activeModelId === "unified-4h-engine" || activeModelId === "4h-swing-meta-017") {
      targetCollection = "paper_trades_unified_4h";
      fallbackFile = "live_4h_executed_trades.json";
    } else if (activeModelId === "distributed-4h-engine") {
      targetCollection = "paper_trades_distributed_4h";
      fallbackFile = "distributed_4h_live_trades.json";
    } else if (activeModelId === "pure-rules-4h-baseline") {
      targetCollection = "benchmark_pure_rules_4h";
      fallbackFile = "pure_rules_4h_executed_trades.json";
    } else if (activeModelId === "pure-rules-1h-baseline" || activeModelId === "pure-rules-baseline") {
      targetCollection = "benchmark_pure_rules_1h";
      fallbackFile = "pure_rules_1h_executed_trades.json";
    } else {
      targetCollection = "paper_trades_unified_1h";
      fallbackFile = "live_executed_trades.json";
    }"""

assert old_sync in content, "old_sync not found in trades/route.ts"
assert old_target in content, "old_target not found in trades/route.ts"

content = content.replace(old_sync, new_sync).replace(old_target, new_target)
p.write_text(content, encoding="utf-8")
print("Successfully updated src/app/api/trades/route.ts!")
