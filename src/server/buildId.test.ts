import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeBuildId } from './buildId';

describe('computeBuildId', () => {
  it('fingerprints the built pages and changes when they change', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flipsign-build-'));
    writeFileSync(join(dir, 'index.html'), '<script src="/assets/display-aaa.js"></script>');
    const first = computeBuildId(dir);
    expect(first).toMatch(/^[0-9a-f]{12}$/);
    expect(computeBuildId(dir)).toBe(first);
    writeFileSync(join(dir, 'index.html'), '<script src="/assets/display-bbb.js"></script>');
    expect(computeBuildId(dir)).not.toBe(first);
  });

  it('falls back to "dev" when there is no build', () => {
    expect(computeBuildId(join(tmpdir(), 'flipsign-no-such-dir'))).toBe('dev');
  });
});
