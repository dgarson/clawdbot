import path from "node:path";
import { fileURLToPath } from "node:url";
import { Generator, getConfig } from "@tanstack/router-generator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const config = getConfig(
  {
    target: "react",
    autoCodeSplitting: true,
  },
  projectRoot
);

const generator = new Generator({ config, root: projectRoot });
await generator.run();
