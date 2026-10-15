import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fingerprint of the built pages (their HTML names the hashed asset files), sent to every display
 * so a page still running an older build knows to reload after the server is upgraded.
 */
export function computeBuildId(staticRoot: string): string {
  const hash = createHash('sha256');
  try {
    hash.update(readFileSync(join(staticRoot, 'index.html')));
  } catch {
    return 'dev';
  }
  try {
    hash.update(readFileSync(join(staticRoot, 'control', 'index.html')));
  } catch {
    // the control page is optional for the fingerprint
  }
  return hash.digest('hex').slice(0, 12);
}
