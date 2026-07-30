import path from "path";
import { baseDir } from "./constants";

export function getLiteParseRunnerPath(): string {
  return path.join(baseDir, "resources", "document-extraction", "liteparse_runner.mjs");
}
