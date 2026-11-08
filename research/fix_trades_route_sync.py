from pathlib import Path

p = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/src/app/api/trades/route.ts")
content = p.read_text(encoding="utf-8")

old_seed = """    if (is4H) {

      const p = path.join(process.cwd(), "src", "data", "live_4h_executed_trades.json");

      if (fs.existsSync(p)) {

        const data = JSON.parse(fs.readFileSync(p, "utf-8"));

        if (data.length > 0) await col.insertMany(data);

      }

    } else if (isPure) {

      const p = path.join(process.cwd(), "src", "data", "pure_rules_executed_trades.json");

      if (fs.existsSync(p)) {

        const data = JSON.parse(fs.readFileSync(p, "utf-8"));

        if (data.length > 0) await col.insertMany(data);

      }

    } else {"""

new_seed = """    if (is4H) {
      const p = path.join(process.cwd(), "src", "data", "live_4h_executed_trades.json");
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (data.length > 0) await col.insertMany(data);
      }
    } else if (is4HRules) {
      const p = path.join(process.cwd(), "src", "data", "pure_rules_4h_executed_trades.json");
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (data.length > 0) await col.insertMany(data);
      }
    } else if (is1HRules) {
      const p = path.join(process.cwd(), "src", "data", "pure_rules_1h_executed_trades.json");
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (data.length > 0) await col.insertMany(data);
      }
    } else {"""

assert old_seed in content, "old_seed block not found"
content = content.replace(old_seed, new_seed)
p.write_text(content, encoding="utf-8")
print("Fixed syncDeltaWatermark in trades/route.ts!")
