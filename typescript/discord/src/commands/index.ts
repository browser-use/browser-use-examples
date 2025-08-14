import { run } from "./run";
import type { Command } from "./types";

export const registry = {
  run,
} satisfies Record<string, Command>;
