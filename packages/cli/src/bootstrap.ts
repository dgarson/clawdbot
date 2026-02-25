import { run } from "./run.js";

export const runCli = async (args: string[]): Promise<number> => {
  const result = await run(args);
  if (result.output.length > 0) {
    console.log(result.output);
  }
  return result.exitCode;
};
