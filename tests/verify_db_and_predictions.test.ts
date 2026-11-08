import test from "node:test";
import assert from "node:assert/strict";
import { GET as getTrades } from "../src/app/api/trades/route";
import { GET as getHistory } from "../src/app/api/history/route";

test("GET /api/trades: [v1] Distributed 4H Specialists returns 11 live trades and v1 4H live prediction logs", async () => {
  const req = new Request("http://localhost:3000/api/trades?modelId=v1-distributed-4h-engine&limit=100");
  const res = await getTrades(req);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.modelId, "v1-distributed-4h-engine");
  assert.equal(data.trades.length, 11, "Must return exactly 11 live trades for v1-distributed-4h-engine");
  assert.ok(data.livePredictionLogs.length > 0, "Must return live prediction logs");
  assert.equal(data.livePredictionLogs[0].model_id, "v1-distributed-4h-engine");
  assert.equal(data.livePredictionLogs[0].timeframe, "4h");
  assert.ok(data.livePredictionLogs[0].probability > 0, "Probability must be positive");
  assert.ok(data.livePredictionLogs[0].time_utc, "time_utc must be populated");
});

test("GET /api/trades: [v1] Stacking Meta-Learner returns 27 live trades and model-specific prediction logs", async () => {
  const req = new Request("http://localhost:3000/api/trades?modelId=v1-stacking-meta-engine&limit=100");
  const res = await getTrades(req);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.modelId, "v1-stacking-meta-engine");
  assert.equal(data.trades.length, 27, "Must return exactly 27 live trades for v1-stacking-meta-engine");
  assert.ok(data.livePredictionLogs.length > 0);
  assert.equal(data.livePredictionLogs[0].model_id, "v1-stacking-meta-engine");
  assert.equal(data.livePredictionLogs[0].timeframe, "1h");
});

test("GET /api/trades: 4H Rule-Based baseline returns 21 live trades and rule-based prediction logs", async () => {
  const req = new Request("http://localhost:3000/api/trades?modelId=pure-rules-4h-baseline&limit=100");
  const res = await getTrades(req);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.modelId, "pure-rules-4h-baseline");
  assert.equal(data.trades.length, 21, "Must return exactly 21 live trades for pure-rules-4h-baseline");
  assert.ok(data.livePredictionLogs.length > 0);
  assert.equal(data.livePredictionLogs[0].model_id, "pure-rules-4h-baseline");
  assert.equal(data.livePredictionLogs[0].p_cutoff, 0);
});

test("GET /api/history: [v1] Distributed 4H Specialists returns 336 unseen trades", async () => {
  const req = new Request("http://localhost:3000/api/history?modelId=v1-distributed-4h-engine&limit=10&page=1");
  const res = await getHistory(req);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.totalHistoricalTrades, 336, "Must return exactly 336 historical unseen trades for v1-distributed-4h-engine");
  assert.equal(data.trades.length, 10);
});

test("GET /api/history: [v1] Stacking Meta-Learner returns 1,669 unseen trades", async () => {
  const req = new Request("http://localhost:3000/api/history?modelId=v1-stacking-meta-engine&limit=10&page=1");
  const res = await getHistory(req);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.totalHistoricalTrades, 1669, "Must return exactly 1,669 historical unseen trades for v1-stacking-meta-engine");
  assert.equal(data.trades.length, 10);
});
