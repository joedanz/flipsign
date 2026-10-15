import { describe, expect, it } from 'vitest';
import { watchBuild } from './buildWatcher';

describe('watchBuild', () => {
  it('reloads only when the server reports a different build than the page was loaded with', () => {
    let reloads = 0;
    const seen = watchBuild(() => reloads++);
    seen('aaa'); // first hello: remember it
    seen('aaa'); // reconnect to the same server build
    expect(reloads).toBe(0);
    seen('bbb'); // server was upgraded
    expect(reloads).toBe(1);
  });
});
