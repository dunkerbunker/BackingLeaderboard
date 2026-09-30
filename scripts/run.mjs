import { spawn } from "node:child_process";
const [environment, command] = process.argv.slice(2);
if (
  !["staging", "production"].includes(environment) ||
  !["dev", "build", "start"].includes(command)
)
  throw new Error("Use run.mjs staging|production dev|build|start");
process.loadEnvFile(`.env.${environment}`);
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", command],
  { stdio: "inherit", env: process.env },
);
child.on("exit", (code) => process.exit(code ?? 1));
