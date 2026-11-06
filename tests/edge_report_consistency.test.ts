import { test, describe } from "node:test";
import assert from "node:assert/strict";

/**
 * TypeScript implementations mirroring analysis/edge_report.py
 * to guarantee cross-language mathematical consistency.
 */
export function computeCostInR(costPercent: number, stopPercent: number): number {
  if (stopPercent <= 0) return 0;
  return Number((costPercent / stopPercent).toFixed(6));
}

export function computeBreakevenCostPercent(grossAvgR: number, stopPercent: number): number {
  return Number((grossAvgR * stopPercent).toFixed(6));
}

export function computeBootstrapCI95(
  data: number[],
  nResamples: number = 2000,
  seed: number = 42
): [number, number] {
  if (data.length === 0) return [0, 0];

  // Simple pseudo-random LCG for deterministic seeding
  let s = seed;
  const nextRand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const sampleMeans: number[] = [];
  const n = data.length;

  for (let b = 0; b < nResamples; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(nextRand() * n);
      sum += data[idx];
    }
    sampleMeans.push(sum / n);
  }

  sampleMeans.sort((a, b) => a - b);
  const lowIdx = Math.floor(0.025 * nResamples);
  const highIdx = Math.floor(0.975 * nResamples);

  return [sampleMeans[lowIdx], sampleMeans[highIdx]];
}

describe("Edge Report Mathematical Consistency Tests", () => {
  test("computeCostInR identity: cost% / stop% calculates exact friction in R units", () => {
    // 0.1144% friction with 1.0% stop = 0.1144 R
    const r1 = computeCostInR(0.001144, 0.01);
    assert.strictEqual(r1, 0.1144);

    // 0.1144% friction with 0.40% stop = 0.286 R
    const r2 = computeCostInR(0.001144, 0.004);
    assert.strictEqual(r2, 0.286);

    // Zero stop safety
    const rZero = computeCostInR(0.001144, 0);
    assert.strictEqual(rZero, 0);
  });

  test("computeBreakevenCostPercent: grossAvgR * stop% calculates exact threshold", () => {
    // Gross avg R = +0.10, Stop% = 1.0% -> Break-even fee = 0.001 (0.10%)
    const be = computeBreakevenCostPercent(0.1, 0.01);
    assert.strictEqual(be, 0.001);

    // Gross avg R = 0 -> 0
    const beZero = computeBreakevenCostPercent(0, 0.01);
    assert.strictEqual(beZero, 0);
  });

  test("computeBootstrapCI95: confidence interval strictly brackets sample mean", () => {
    const data = [0.1, 0.15, -0.05, 0.2, 0.08, -0.02, 0.12, 0.18, 0.04, 0.09];
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const [low, high] = computeBootstrapCI95(data, 1000, 123);

    assert.ok(low < mean, `Lower bound ${low} must be less than sample mean ${mean}`);
    assert.ok(high > mean, `Upper bound ${high} must be greater than sample mean ${mean}`);
  });
});
