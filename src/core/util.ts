// Small helpers shared by the engine and its modules.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Reads a namespaced setting: the Wikae name first, the Étude name as a fallback for old installs. */
export function appEnv(env: Record<string, string | undefined>, name: string): string | undefined {
  return env[`WIKAE_${name}`] ?? env[`WIKAA_${name}`] ?? env[`ETUDE_${name}`];
}

/** The per-install home: an explicit path, then an existing branded directory, else `~/.wikae`. */
export function resolveAppHome(env: Record<string, string | undefined> = process.env): string {
  const explicit = appEnv(env, "HOME");
  if (explicit) return resolve(explicit);
  const home = homedir();
  for (const dir of [".wikae", ".wikaa", ".etude"]) if (existsSync(join(home, dir))) return resolve(join(home, dir));
  return resolve(join(home, ".wikae"));
}

export const parse = <T>(s: string | null | undefined, fallback: T): T => {
  if (s == null) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export const deckParts = (name: string) => name.split("::").map((s) => s.trim()).filter(Boolean);

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Two piles in one order that finishes both together, given how many of each were done already. Ties go to `a`. */
export function interleave<T>(a: T[], b: T[], doneA = 0, doneB = 0): T[] {
  const out: T[] = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    const takeA = j >= b.length || (i < a.length && (doneA + i) / (doneA + a.length) <= (doneB + j) / (doneB + b.length));
    out.push(takeA ? a[i++] : b[j++]);
  }
  return out;
}
