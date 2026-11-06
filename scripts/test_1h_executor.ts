process.env.MONGODB_URI = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority";

import { runPaper1HAExecutor } from "../src/lib/paperExecutor1HA";

async function main() {
  console.log("Testing 1H-A Paper Executor on current closed 1H BTC bar...");
  const result = await runPaper1HAExecutor();
  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
