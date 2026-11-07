/**
 * LightGBM Decision Tree Inference Engine for 4H Swing Meta-Labeling
 * Specification: docs/prereg/swing_meta_labeling_4h.md (Amendment 1)
 *
 * Invariants:
 * 1. Evaluates 150-tree LightGBM model directly in TypeScript (no Python subprocess).
 * 2. Reads model tree structures from src/models/swing_4h/model.json.
 * 3. Compares posterior probability against Top 25% quantile cutoff P_cutoff = 0.10.
 * 4. Zero lookahead feature vector mapping.
 */

import fs from "fs";
import path from "path";

export const SWING_4H_FEATURE_NAMES = [
  "rs_vs_btc_3d",
  "rs_vs_btc_7d",
  "rs_vs_btc_30d",
  "funding_rate_zscore",
  "oi_delta_1d",
  "oi_delta_3d",
  "vol_ratio_30d",
  "volume_zscore_20",
  "dist_ema_20",
  "dist_ema_50",
  "dist_sma_200",
  "trend_aligned",
  "donchian_pos_20",
  "atr_pct",
] as const;

export type Swing4HFeatureName = typeof SWING_4H_FEATURE_NAMES[number];

export interface Swing4HModelMetadata {
  model_name: string;
  training_max_date: string;
  n_samples: number;
  target_base_rate: number;
  p_cutoff: number;
  percentile_75: number;
  percentile_80: number;
  percentile_90: number;
  num_trees: number;
  feature_names: string[];
  feature_stats: Record<string, { mean: number; std: number; min: number; max: number }>;
  verification_samples?: Array<{
    features: Record<string, number>;
    feature_array: number[];
    expected_prob: number;
  }>;
}

export interface SwingInferenceResult {
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
let cachedMetadata: Swing4HModelMetadata | null = null;

export function clearSwingModelCache(): void {
  cachedModel = null;
  cachedMetadata = null;
}

/**
 * Loads and caches the exported LightGBM model and metadata.
 */
export function loadSwing4HModel(baseDir?: string): {
  model: ModelDump;
  metadata: Swing4HModelMetadata;
} {
  if (cachedModel && cachedMetadata) {
    return { model: cachedModel, metadata: cachedMetadata };
  }

  const root = baseDir || process.cwd();
  const modelPath = path.join(root, "src", "models", "swing_4h", "model.json");
  const metadataPath = path.join(root, "src", "models", "swing_4h", "metadata.json");

  if (!fs.existsSync(modelPath) || !fs.existsSync(metadataPath)) {
    throw new Error(
      `Swing 4H model files missing. Checked:\n  - ${modelPath}\n  - ${metadataPath}\nRun 'uv run python research/swing_engine/train.py' to generate them.`
    );
  }

  const modelRaw = JSON.parse(fs.readFileSync(modelPath, "utf-8"));
  const metadataRaw = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

  cachedModel = modelRaw;
  cachedMetadata = metadataRaw;

  return { model: cachedModel!, metadata: cachedMetadata! };
}

/**
 * Recursively evaluates a single decision tree node given an array of features.
 */
function evaluateTreeNode(node: TreeNode, featureVector: number[]): number {
  if (node.leaf_value !== undefined) {
    return node.leaf_value;
  }

  const featIdx = node.split_feature ?? 0;
  const val = featureVector[featIdx];

  // Handle missing or NaN feature values
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

/**
 * Converts a feature record or array into an aligned number array matching FEATURE_NAMES.
 */
export function alignFeatureVector(
  features: Record<string, number> | number[]
): number[] {
  if (Array.isArray(features)) {
    if (features.length !== SWING_4H_FEATURE_NAMES.length) {
      throw new Error(
        `Feature array length mismatch: expected ${SWING_4H_FEATURE_NAMES.length}, got ${features.length}`
      );
    }
    return features.map((v) => (isNaN(v) ? 0.0 : v));
  }

  return SWING_4H_FEATURE_NAMES.map((name) => {
    const val = features[name];
    return val !== undefined && !isNaN(val) ? val : 0.0;
  });
}

/**
 * Predicts the meta-label probability P(Win = +2.5R within 12 bars) using the LightGBM trees.
 */
export function predictSwingMetaProb(
  features: Record<string, number> | number[],
  customCutoff?: number,
  baseDir?: string
): SwingInferenceResult {
  const { model, metadata } = loadSwing4HModel(baseDir);
  const featureVector = alignFeatureVector(features);

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
