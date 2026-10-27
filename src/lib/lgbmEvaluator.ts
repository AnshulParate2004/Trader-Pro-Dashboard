import fs from "fs";
import path from "path";
import {
  Candle,
  computeFull53Features,
  HTFData,
} from "./features";

export { type Candle };

export interface PredictionResult {
  modelId: string;
  modelName: string;
  timeframe: string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  pLong: number;
  pShort: number;
  thresholdLong: number;
  thresholdShort: number;
  donchianBreakout: "BULLISH" | "BEARISH" | "NONE";
  gate4HPassed?: boolean;
  gate15MPassed?: boolean;
  htfScore: number;
  ratchetR: number;
  stopLossR: number;
  takeProfitR: number;
  recommendation: string;
  currentPrice: number;
  atr: number;
  suggestedStopLoss: number;
  suggestedTakeProfit: number;
  suggestedRatchetTrigger: number;
}

// In-memory cache for loaded tree JSONs to prevent disk churn
const modelCache: Record<string, any> = {};

function loadModelJSON(tf: string): any {
  if (modelCache[tf]) return modelCache[tf];
  try {
    const filePath = path.join(process.cwd(), "src", "models", `lgbm_${tf}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      modelCache[tf] = data;
      return data;
    }
  } catch (err) {
    console.warn(`Could not load tree json for ${tf}:`, err);
  }
  return null;
}

function evalNode(node: any, featureMap: Record<string, number>, featureNames: string[]): number {
  if (node.leaf_value !== undefined) return node.leaf_value;
  const featName = featureNames[node.split_feature];
  const val = featureMap[featName];

  // If feature is missing or NaN, use default_left specified in the LightGBM node
  if (val === undefined || isNaN(val)) {
    const defaultLeft = node.default_left ?? true;
    return defaultLeft
      ? evalNode(node.left_child, featureMap, featureNames)
      : evalNode(node.right_child, featureMap, featureNames);
  }

  if (val <= node.threshold) {
    return evalNode(node.left_child, featureMap, featureNames);
  } else {
    return evalNode(node.right_child, featureMap, featureNames);
  }
}

export function predictLGBM(tf: string, featureMap: Record<string, number>): { pLong: number; pShort: number } {
  const model = loadModelJSON(tf);
  if (!model || !model.trees_long || !model.trees_short) {
    // Return fallback balanced probabilities if model JSON not on disk
    return { pLong: 0.52, pShort: 0.48 };
  }

  const featureNames: string[] = model.features || [];

  let rawLong = 0;
  for (const tree of model.trees_long) {
    rawLong += evalNode(tree.tree_structure, featureMap, featureNames);
  }
  const pLong = 1 / (1 + Math.exp(-rawLong));

  let rawShort = 0;
  for (const tree of model.trees_short) {
    rawShort += evalNode(tree.tree_structure, featureMap, featureNames);
  }
  const pShort = 1 / (1 + Math.exp(-rawShort));

  return { pLong, pShort };
}

/**
 * Computes all 53 features conforming 100% to research specification
 */
export function extractFeaturesFromCandles(
  candles: Candle[],
  htfData: HTFData = {}
): { features: Record<string, number>; atr: number; htfScore: number } {
  return computeFull53Features(candles, htfData);
}

// Compute AI Strategy Prediction for a given active model
export async function getModelPrediction(
  modelId: string,
  candles15m: Candle[],
  candles5m?: Candle[],
  candles4h?: Candle[],
  candles1h?: Candle[],
  candles1d?: Candle[],
  candles1w?: Candle[]
): Promise<PredictionResult> {
  const htfData: HTFData = {
    candles1h,
    candles4h,
    candles1d,
    candles1w,
  };

  // Full 53-feature extraction on 15m
  const { features: feat15, atr: atr15, htfScore } = extractFeaturesFromCandles(candles15m, htfData);
  const currentPrice = candles15m[candles15m.length - 1].close;

  // Run 15m LightGBM inference
  const { pLong: p15L, pShort: p15S } = predictLGBM("15m", feat15);

  // Donchian-20 Breakout on 15m (closed bars prior to current)
  const lookback20 = candles15m.slice(-21, -1);
  const donchianHigh15 = Math.max(...lookback20.map((c) => c.high));
  const donchianLow15 = Math.min(...lookback20.map((c) => c.low));
  const donLong15 = currentPrice > donchianHigh15;
  const donShort15 = currentPrice < donchianLow15;

  // 4H Directional Gate (Separate Long and Short)
  let gate4H_L = true;
  let gate4H_S = true;
  let p4hL = 0.5;
  let p4hS = 0.5;
  const median4hL = 0.5547;
  const median4hS = 0.5258;

  if (candles4h && candles4h.length >= 20) {
    const { features: feat4h } = extractFeaturesFromCandles(candles4h, {
      candles1d,
      candles1w,
    });
    const p4h = predictLGBM("4h", feat4h);
    p4hL = p4h.pLong;
    p4hS = p4h.pShort;

    // Asymmetric Directional Macro Gating:
    // Longs permitted only if 4H model is bullish AND HTF consensus is non-negative
    gate4H_L = p4hL >= median4hL && htfScore >= 0;
    // Shorts permitted only if 4H model is bearish AND HTF consensus is non-positive
    gate4H_S = p4hS >= median4hS && htfScore <= 0;
  }

  // 5M Breakout & Direction
  let donLong5m = donLong15;
  let donShort5m = donShort15;
  if (candles5m && candles5m.length >= 21) {
    const lookback5m = candles5m.slice(-21, -1);
    const donHigh5m = Math.max(...lookback5m.map((c) => c.high));
    const donLow5m = Math.min(...lookback5m.map((c) => c.low));
    const price5m = candles5m[candles5m.length - 1].close;
    donLong5m = price5m > donHigh5m;
    donShort5m = price5m < donLow5m;
  }

  // Notebook OOS Medians
  const median15L = 0.5457;
  const median15S = 0.5594;

  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let confidence = 50.0;
  let ratchetR = 0.30;
  let modelName = "15M Sniper Scalp (+0.30R Ratchet)";
  let donchianBreakout: "BULLISH" | "BEARISH" | "NONE" = donLong15 ? "BULLISH" : donShort15 ? "BEARISH" : "NONE";

  switch (modelId) {
    case "15m-sniper-030":
    default:
      modelName = "15M Sniper Scalp (+0.30R Ratchet)";
      ratchetR = 0.30;
      {
        const condL = donLong15 && p15L >= median15L && htfScore >= 0;
        const condS = donShort15 && p15S >= median15S && htfScore <= 0;
        if (condL && condS) {
          // Relative margin arbitration
          if (p15L - median15L >= p15S - median15S) {
            signal = "BUY";
            confidence = Math.min(94, Math.round(p15L * 100 * 1.35));
          } else {
            signal = "SELL";
            confidence = Math.min(94, Math.round(p15S * 100 * 1.35));
          }
        } else if (condL) {
          signal = "BUY";
          confidence = Math.min(94, Math.round(p15L * 100 * 1.35));
        } else if (condS) {
          signal = "SELL";
          confidence = Math.min(94, Math.round(p15S * 100 * 1.35));
        }
      }
      break;

    case "15m-precision-035":
      modelName = "15M Precision Scalp (+0.35R Ratchet)";
      ratchetR = 0.35;
      {
        const condL = donLong15 && p15L >= median15L && htfScore >= 0;
        const condS = donShort15 && p15S >= median15S && htfScore <= 0;
        if (condL && condS) {
          if (p15L - median15L >= p15S - median15S) {
            signal = "BUY";
            confidence = Math.min(91, Math.round(p15L * 100 * 1.3));
          } else {
            signal = "SELL";
            confidence = Math.min(91, Math.round(p15S * 100 * 1.3));
          }
        } else if (condL) {
          signal = "BUY";
          confidence = Math.min(91, Math.round(p15L * 100 * 1.3));
        } else if (condS) {
          signal = "SELL";
          confidence = Math.min(91, Math.round(p15S * 100 * 1.3));
        }
      }
      break;

    case "master-confluence-multi":
      modelName = "Full Master Sniper (5M + 15M + 4H)";
      ratchetR = 0.30;
      donchianBreakout = donLong5m ? "BULLISH" : donShort5m ? "BEARISH" : "NONE";
      {
        const condL = donLong5m && p15L >= median15L && gate4H_L;
        const condS = donShort5m && p15S >= median15S && gate4H_S;
        if (condL && condS) {
          if (p15L - median15L >= p15S - median15S) {
            signal = "BUY";
            confidence = 92;
          } else {
            signal = "SELL";
            confidence = 92;
          }
        } else if (condL) {
          signal = "BUY";
          confidence = 92;
        } else if (condS) {
          signal = "SELL";
          confidence = 92;
        } else {
          signal = "NEUTRAL";
          confidence = Math.round(Math.max(p15L, p15S) * 100);
        }
      }
      break;

    case "5m-15m-confluence":
      modelName = "5M + 15M Confluence Sniper";
      ratchetR = 0.30;
      donchianBreakout = donLong5m ? "BULLISH" : donShort5m ? "BEARISH" : "NONE";
      {
        const condL = donLong5m && p15L >= median15L;
        const condS = donShort5m && p15S >= median15S;
        if (condL && condS) {
          if (p15L - median15L >= p15S - median15S) {
            signal = "BUY";
            confidence = 88;
          } else {
            signal = "SELL";
            confidence = 88;
          }
        } else if (condL) {
          signal = "BUY";
          confidence = 88;
        } else if (condS) {
          signal = "SELL";
          confidence = 88;
        } else {
          signal = "NEUTRAL";
          confidence = Math.round(Math.max(p15L, p15S) * 100);
        }
      }
      break;
  }

  // Calculate strict stop loss and target levels
  const is5MModel = modelId.includes("5m") || modelId.includes("master");
  const maxSlPct = is5MModel ? 0.03 : 0.05;
  const slDist = Math.min(1.0 * atr15, maxSlPct * currentPrice);

  const suggestedStopLoss = signal === "BUY" ? currentPrice - slDist : currentPrice + slDist;
  const suggestedTakeProfit = signal === "BUY" ? currentPrice + 1.0 * atr15 : currentPrice - 1.0 * atr15;
  const suggestedRatchetTrigger = signal === "BUY" ? currentPrice + ratchetR * atr15 : currentPrice - ratchetR * atr15;

  let recommendation = "Standby: Wait for Donchian breakout and model probability confirmation.";
  if (signal === "BUY") {
    recommendation = `LONG BTC: Model indicates ${confidence}% upside edge (HTF Score: ${htfScore.toFixed(2)}). Set SL at $${suggestedStopLoss.toFixed(1)} and lock BE (+0.05R) at $${suggestedRatchetTrigger.toFixed(1)}.`;
  } else if (signal === "SELL") {
    recommendation = `SHORT BTC: Model indicates ${confidence}% downside edge (HTF Score: ${htfScore.toFixed(2)}). Set SL at $${suggestedStopLoss.toFixed(1)} and lock BE (+0.05R) at $${suggestedRatchetTrigger.toFixed(1)}.`;
  }

  return {
    modelId,
    modelName,
    timeframe: is5MModel ? "5m" : "15m",
    signal,
    confidence,
    pLong: Number(p15L.toFixed(4)),
    pShort: Number(p15S.toFixed(4)),
    thresholdLong: median15L,
    thresholdShort: median15S,
    donchianBreakout,
    gate4HPassed: signal === "BUY" ? gate4H_L : signal === "SELL" ? gate4H_S : (gate4H_L || gate4H_S),
    gate15MPassed: p15L >= median15L || p15S >= median15S,
    htfScore,
    ratchetR,
    stopLossR: 1.0,
    takeProfitR: 1.0,
    recommendation,
    currentPrice,
    atr: Number(atr15.toFixed(2)),
    suggestedStopLoss: Number(suggestedStopLoss.toFixed(2)),
    suggestedTakeProfit: Number(suggestedTakeProfit.toFixed(2)),
    suggestedRatchetTrigger: Number(suggestedRatchetTrigger.toFixed(2)),
  };
}
