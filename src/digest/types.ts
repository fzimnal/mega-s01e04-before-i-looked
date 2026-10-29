// Plan morning-digest § 1. One row per job for one night of runs/<night>.jsonl.
export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null; // null in the log; views show it as —
  runs: number; // lines for this job
  retries: number; // lines with status retry
  lastStatus: RunStatus;
  lastError: string | null; // most recent error on any line for this job
  firstAt: string; // times keep the log's offset
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse; counted, never thrown
};

// null when runs/<night>.jsonl does not exist.
export type ReadNight = (runsDir: string, night: string) => Night | null;
