import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

const GOOD = [
  line('2026-10-28T01:00:00+01:00', 'zeta-sync', 'ok', 'ana'),
  line('2026-10-28T01:05:00+01:00', 'alpha-backup', 'retry', null, 'timeout'),
  line('2026-10-28T01:10:00+01:00', 'alpha-backup', 'ok', null),
  line('2026-10-28T01:15:00+01:00', 'mid-report', 'fail', 'bob', 'disk full'),
];
const JOBS_SORTED = ['alpha-backup', 'mid-report', 'zeta-sync'];

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(dir, '2026-10-28.jsonl'), GOOD.join('\n') + '\n');
  writeFileSync(join(dir, '2026-10-27.jsonl'), '');
  writeFileSync(join(dir, '2026-10-26.jsonl'), [GOOD[0], 'this is not json {', GOOD[3]].join('\n') + '\n');
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('200 with every job name and one row per job', async () => {
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of JOBS_SORTED) expect(html).toContain(job);
    expect(html.match(/<tr[\s>]/g)?.length).toBe(JOBS_SORTED.length + 1); // + header row
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('empty file: 200 and says nothing ran', async () => {
    const res = await app.request('/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('one unparseable line: 200, good jobs shown, says could not be read', async () => {
    const res = await app.request('/digest/2026-10-26');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('zeta-sync');
    expect(html).toContain('mid-report');
    expect(html).toContain('could not be read');
  });

  it('null owner renders as an em dash', async () => {
    const html = await (await app.request('/digest/2026-10-28')).text();
    expect(html).toContain('—');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with { night, rows, badLines }', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(Object.keys(body).sort()).toEqual(['badLines', 'night', 'rows']);
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(JOBS_SORTED);
    expect(body.rows[0]?.owner).toBeNull();
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('empty night: rows [] and badLines 0', async () => {
    const res = await app.request('/api/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-27', rows: [], badLines: 0 });
  });

  it('bad-line night: badLines 1', async () => {
    const res = await app.request('/api/digest/2026-10-26');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(2);
  });
});

describe('page and JSON agree', () => {
  it('job names appear in the page in the same order as JSON rows', async () => {
    const night = '2026-10-28';
    const body = (await (await app.request(`/api/digest/${night}`)).json()) as Night;
    const html = await (await app.request(`/digest/${night}`)).text();
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
