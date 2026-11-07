/**
 * Decision Tree Model Inference for 1H Macro Commodities Meta-Labeling
 * Models stored in: src/models/swing_1h_commodities/
 */

import fs from "fs";
import path from "path";

export const COMMODITIES_1H_FEATURE_NAMES = [
  "feat_dxy_mom_24h",
  "feat_dxy_mom_72h",
  "feat_dxy_corr_60",
  "feat_vol_zscore",
  "feat_volatility_ratio",
  "feat_atr_pct",
  "feat_donchian_pos",
  "feat_trend_dist_200",
] as const;

export type Commodities1HFeatureName = typeof COMMODITIES_1H_FEATURE_NAMES[number];

export interface CommoditiesModelMetadata {
  model_name: string;
  asset_class?: string;
  timeframe: string;
  universe: string[];
  benchmark?: string;
  n_samples: number;
  target_base_rate: number;
  p_cutoff: number;
  percentile_75?: number;
  percentile_80?: number;
  percentile_85?: number;
  friction_bps: number;
  num_trees: number;
  feature_names: string[];
  feature_stats?: Record<string, { mean: number; std: number; min: number; max: number }>;
}

export interface CommoditiesInferenceResult {
  probability: number;
  pCutoff: number;
  passesGate: boolean;
  rawScore: number;
  featureVector: number[];
}

interface TreeNode {
  leaf_value?: number;
  split_feature?: number;
  threshold?: number;
  decision_type?: string;
  default_left?: boolean;
  left_child?: TreeNode;
  right_child?: TreeNode;
}

interface TreeInfo {
  tree_index: number;
  num_leaves: number;
  tree_structure: TreeNode;
}

interface ModelDump {
  name?: string;
  tree_info: TreeInfo[];
  feature_names?: string[];
}

let cachedModel: ModelDump | null = null;
let cachedMetadata: CommoditiesModelMetadata | null = null;

export function clearCommoditiesModelCache(): void {
  cachedModel = null;
  cachedMetadata = null;
}

export function loadCommodities1HModel(baseDir?: string): {
  model: ModelDump;
  metadata: CommoditiesModelMetadata;
} {
  if (cachedModel && cachedMetadata) {
    return { model: cachedModel, metadata: cachedMetadata };
  }

  const root = baseDir || process.cwd();
  const modelPath = path.join(root, "src", "models", "swing_1h_commodities", "model.json");
  const metadataPath = path.join(root, "src", "models", "swing_1h_commodities", "metadata.json");

  if (!fs.existsSync(modelPath) || !fs.existsSync(metadataPath)) {
    throw new Error(
      `Commodities 1H model files missing. Checked:\n  - ${modelPath}\n  - ${metadataPath}`
    );
  }

  const modelRaw = JSON.parse(fs.readFileSync(modelPath, "utf-8"));
  const metadataRaw = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

  cachedModel = modelRaw;
  cachedMetadata = metadataRaw;

  return { model: cachedModel!, metadata: cachedMetadata! };
}

function evaluateTreeNode(node: TreeNode, featureVector: number[]): number {
  if (node.leaf_value !== undefined) {
    return node.leaf_value;
  }

  const featIdx = node.split_feature ?? 0;
  const val = featureVector[featIdx];

  if (val === undefined || isNaN(val)) {
    const defaultLeft = node.default_left ?? true;
    return defaultLeft
      ? evaluateTreeNode(node.left_child!, featureVector)
      : evaluateTreeNode(node.right_child!, featureVector);
  }

  if (val <= node.threshold!) {
    return evaluateTreeNode(node.left_child!, featureVector);
  } else {
    return evaluateTreeNode(node.right_child!, featureVector);
  }
}

export function alignCommoditiesFeatureVector(
  features: Record<string, number> | number[]
): number[] {
  if (Array.isArray(features)) {
    if (features.length !== COMMODITIES_1H_FEATURE_NAMES.length) {
      throw new Error(
        `Feature array length mismatch: expected ${COMMODITIES_1H_FEATURE_NAMES.length}, got ${features.length}`
      );
    }
    return features.map((v) => (isNaN(v) ? 0.0 : v));
  }

  return COMMODITIES_1H_FEATURE_NAMES.map((name) => {
    const val = features[name];
    return val !== undefined && !isNaN(val) ? val : 0.0;
  });
}

export function predictCommoditiesMetaProb(
  features: Record<string, number> | number[],
  customCutoff?: number,
  baseDir?: string
): CommoditiesInferenceResult {
  const { model, metadata } = loadCommodities1HModel(baseDir);
  const featureVector = alignCommoditiesFeatureVector(features);

  let rawScore = 0.0;
  for (const tree of model.tree_info) {
    rawScore += evaluateTreeNode(tree.tree_structure, featureVector);
  }

  // Logistic Sigmoid Link Function
  const probability = 1.0 / (1.0 + Math.exp(-rawScore));
  const pCutoff = customCutoff ?? metadata.p_cutoff;
  const passesGate = probability >= pCutoff;

  return {
    probability,
    pCutoff,
    passesGate,
    rawScore,
    featureVector,
  };
}
