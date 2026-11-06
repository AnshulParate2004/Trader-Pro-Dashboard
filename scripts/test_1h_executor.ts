// MONGODB_URI is read from process.env.MONGODB_URI

import { runPaper1HAExecutor } from "../src/lib/paperExecutor1HA";

async function main() {
  console.log("Testing 1H-A Paper Executor on current closed 1H BTC bar...");
  const result = await runPaper1HAExecutor();
  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
