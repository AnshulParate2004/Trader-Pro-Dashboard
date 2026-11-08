from pathlib import Path

# 1. Update ModelCard.tsx
p_card = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/src/components/ai-engine/ModelCard.tsx")
content_card = p_card.read_text(encoding="utf-8")

content_card = content_card.replace(
    'currentModel.rank === 1 ? "🥇" : currentModel.rank === 2 ? "🥈" : currentModel.rank === 3 ? "🥉" : "🎯"',
    'currentModel.rank === 1 ? "🥇" : currentModel.rank === 2 ? "🥈" : currentModel.rank === 3 ? "🥉" : currentModel.rank === 4 ? "🎯" : "📊"'
)

content_card = content_card.replace(
    ': currentModel && currentModel.id === "pure-rules-baseline" ? (',
    ': currentModel && currentModel.id.includes("pure-rules") ? ('
)

p_card.write_text(content_card, encoding="utf-8")
print("Updated ModelCard.tsx")

# 2. Update PaperOnlyBanner.tsx
p_banner = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/src/components/ai-engine/PaperOnlyBanner.tsx")
content_banner = p_banner.read_text(encoding="utf-8")

old_rules_block = """  ALL_RULES: {
    assetKey: "ALL",
    assetLabel: "Rule-Based Engine (No AI)",
    timeframe: "All-7 Assets Baseline",
    historicalTradesCount: 4448,
    liveTradesCount: 37,
    avgNetR: -0.0209,
    realizedReturnR: -92.97,
    netPnLINR: -9297,
    winRate: 40.0,
    profitFactor: 0.96,
    maxDrawdownR: -45.20,
    tpPercent: 40.0,
    slPercent: 60.0,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Multi-year mechanical Donchian-20 breakout benchmark above/below 200 SMA across all 7 assets with zero AI gating (4,448 historical trades, -0.021R expectancy, 0.96 PF).",
    liveAvgNetR: 0.089,
    liveRealizedReturnR: 3.30,
    liveNetPnLINR: 330.00,
    liveChargesINR: 88.50,
    liveCurrentCapitalINR: 7330.00,
    liveWinRate: 51.4,
    liveProfitFactor: 1.15,
    liveTpPercent: 51.4,
    liveSlPercent: 48.6,
    liveDescription: "Live mechanical Donchian-20 breakouts evaluated across all 7 assets with zero AI gating (37 executions).",
  },"""

new_rules_block = """  ALL_RULES_1H: {
    assetKey: "ALL",
    assetLabel: "Rule-Based Engine (1H) [No AI]",
    timeframe: "1H Multi-Asset Baseline",
    historicalTradesCount: 4390,
    liveTradesCount: 76,
    avgNetR: 0.070,
    realizedReturnR: 5.32,
    netPnLINR: 532.00,
    winRate: 43.4,
    profitFactor: 1.14,
    maxDrawdownR: -15.90,
    tpPercent: 11.8,
    slPercent: 42.1,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Mechanical Donchian-20 breakout benchmark above/below 200 SMA across all 7 assets on 1H candles without AI gating (4,390 historical trades, 76 live trades).",
    liveAvgNetR: 0.070,
    liveRealizedReturnR: 5.32,
    liveNetPnLINR: 532.00,
    liveChargesINR: 178.60,
    liveCurrentCapitalINR: 7532.00,
    liveWinRate: 43.4,
    liveProfitFactor: 1.14,
    liveTpPercent: 11.8,
    liveSlPercent: 42.1,
    liveDescription: "Live 1H mechanical Donchian-20 breakouts evaluated across all 7 assets with zero AI gating (76 live trades, +5.32R).",
  },
  ALL_RULES_4H: {
    assetKey: "ALL",
    assetLabel: "Rule-Based Engine (4H Swing) [No AI]",
    timeframe: "4H Swing Baseline",
    historicalTradesCount: 1247,
    liveTradesCount: 21,
    avgNetR: 0.020,
    realizedReturnR: 0.42,
    netPnLINR: 42.00,
    winRate: 47.6,
    profitFactor: 1.04,
    maxDrawdownR: -4.10,
    tpPercent: 14.3,
    slPercent: 47.6,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Mechanical Donchian-20 swing breakout benchmark above/below 200 SMA across all 7 assets on 4H candles with zero AI gating (1,247 historical trades, +80.99R, 21 live trades).",
    liveAvgNetR: 0.020,
    liveRealizedReturnR: 0.42,
    liveNetPnLINR: 42.00,
    liveChargesINR: 48.30,
    liveCurrentCapitalINR: 7042.00,
    liveWinRate: 47.6,
    liveProfitFactor: 1.04,
    liveTpPercent: 14.3,
    liveSlPercent: 47.6,
    liveDescription: "Live 4H swing mechanical Donchian-20 breakouts evaluated across all 7 assets with zero AI gating (21 live trades, +0.42R).",
  },
  ALL_RULES: {
    assetKey: "ALL",
    assetLabel: "Rule-Based Engine (1H) [No AI]",
    timeframe: "1H Multi-Asset Baseline",
    historicalTradesCount: 4390,
    liveTradesCount: 76,
    avgNetR: 0.070,
    realizedReturnR: 5.32,
    netPnLINR: 532.00,
    winRate: 43.4,
    profitFactor: 1.14,
    maxDrawdownR: -15.90,
    tpPercent: 11.8,
    slPercent: 42.1,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Mechanical Donchian-20 breakout benchmark above/below 200 SMA across all 7 assets on 1H candles without AI gating (4,390 historical trades, 76 live trades).",
    liveAvgNetR: 0.070,
    liveRealizedReturnR: 5.32,
    liveNetPnLINR: 532.00,
    liveChargesINR: 178.60,
    liveCurrentCapitalINR: 7532.00,
    liveWinRate: 43.4,
    liveProfitFactor: 1.14,
    liveTpPercent: 11.8,
    liveSlPercent: 42.1,
    liveDescription: "Live 1H mechanical Donchian-20 breakouts evaluated across all 7 assets with zero AI gating (76 live trades, +5.32R).",
  },"""

old_lookup = """  if (selectedModelId === "distributed-1h-engine") return ASSET_METRICS_MAP["ALL_1H_DIST"];
  if (selectedModelId === "distributed-4h-engine") return ASSET_METRICS_MAP["ALL_4H_DIST"];
  if (selectedModelId === "unified-4h-engine" || selectedModelId === "4h-swing-meta-017") return ASSET_METRICS_MAP["ALL_4H"];
  if (selectedModelId === "pure-rules-baseline") return ASSET_METRICS_MAP["ALL_RULES"];
  return ASSET_METRICS_MAP["ALL_1H"] || ASSET_METRICS_MAP["ALL"];"""

new_lookup = """  if (selectedModelId === "distributed-1h-engine") return ASSET_METRICS_MAP["ALL_1H_DIST"];
  if (selectedModelId === "distributed-4h-engine") return ASSET_METRICS_MAP["ALL_4H_DIST"];
  if (selectedModelId === "unified-4h-engine" || selectedModelId === "4h-swing-meta-017") return ASSET_METRICS_MAP["ALL_4H"];
  if (selectedModelId === "pure-rules-4h-baseline") return ASSET_METRICS_MAP["ALL_RULES_4H"];
  if (selectedModelId === "pure-rules-1h-baseline" || selectedModelId === "pure-rules-baseline") return ASSET_METRICS_MAP["ALL_RULES_1H"];
  return ASSET_METRICS_MAP["ALL_1H"] || ASSET_METRICS_MAP["ALL"];"""

old_is_flags = """  const isDistributed1H = selectedModelId === "distributed-1h-engine";
  const isDistributed4H = selectedModelId === "distributed-4h-engine";
  const is4H = selectedModelId === "unified-4h-engine" || selectedModelId === "4h-swing-meta-017";
  const is1H = selectedModelId === "unified-1h-engine" || selectedModelId === "1h-commodities-rf";
  const isRules = selectedModelId === "pure-rules-baseline";"""

new_is_flags = """  const isDistributed1H = selectedModelId === "distributed-1h-engine";
  const isDistributed4H = selectedModelId === "distributed-4h-engine";
  const is4H = selectedModelId === "unified-4h-engine" || selectedModelId === "4h-swing-meta-017" || selectedModelId === "pure-rules-4h-baseline";
  const is1H = selectedModelId === "unified-1h-engine" || selectedModelId === "1h-commodities-rf" || selectedModelId === "pure-rules-1h-baseline";
  const isRules = selectedModelId.includes("pure-rules") || selectedModelId === "pure-rules-baseline";"""

assert old_rules_block in content_banner, "old_rules_block not found in PaperOnlyBanner.tsx"
assert old_lookup in content_banner, "old_lookup not found in PaperOnlyBanner.tsx"
assert old_is_flags in content_banner, "old_is_flags not found in PaperOnlyBanner.tsx"

content_banner = content_banner.replace(old_rules_block, new_rules_block)
content_banner = content_banner.replace(old_lookup, new_lookup)
content_banner = content_banner.replace(old_is_flags, new_is_flags)

p_banner.write_text(content_banner, encoding="utf-8")
print("Updated PaperOnlyBanner.tsx")
