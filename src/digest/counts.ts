import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number>;

// Per-line status counts for runs/<night>.jsonl; lines that don't parse are skipped.
// null when the file does not exist.
export function nightCounts(runsDir: string, night: string): NightCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof v !== 'object' || v === null) continue;
    const s = (v as Record<string, unknown>).status;
    if (s === 'ok' || s === 'retry' || s === 'fail') counts[s]++;
  }
  return counts;
}
