import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { identity, route, open, openByName, savePrompt } from './navigation.mjs';

const origin = 'https://app.evose.ai';
const target = { origin, kind: 'agent-config', workspaceId: '123', resourceId: '456' };
assert.deepEqual(identity(route(target)), target);
assert.equal(route({ ...target, kind: 'workflow-config' }), `${origin}/workspace/123/workflow/456/configure`);
assert.throws(() => route({ ...target, workspaceId: 123 }), /ID string/);
assert.throws(() => route({ ...target, resourceId: '../456' }), /ID string/);
assert.throws(() => route({ ...target, workspaceId: '0' }), /ID string/);
assert.throws(() => route({ ...target, origin: 'https://app.evose.ai.attacker.example' }), /origin/);
assert.throws(() => identity('https://app.evose.ai/login'), /Unsupported page/);

let navigated = false;
await assert.rejects(open({ info: async () => ({ url: 'https://example.com/' }), goto: async () => { navigated = true; } }, target), /same verified origin/);
assert.equal(navigated, false);

// No click is allowed when two currently rendered resources share the exact name.
let clicked = false;
const fakePage = {
  info: async () => ({ url: `${origin}/workspace/123/build-service/agent` }),
  evaluate: async () => ({ url: `${origin}/workspace/123/build-service/agent`, cards: [{ name: 'Duplicate' }, { name: 'Duplicate' }] }),
  click: async () => { clicked = true; },
};
await assert.rejects(openByName(fakePage, 'Duplicate'), /got 2/);
assert.equal(clicked, false);
await assert.rejects(savePrompt(fakePage, 'relative.txt'), /absolute/);
await assert.rejects(savePrompt(fakePage, '/tmp/evose-test-never-written.txt'), /configuration page/);
// Configured deployments stay explicit; credentials and path-bearing origins fail closed.
for (const [configured, expected] of [['https://deployment.example.com', 0], ['https://name:secret@deployment.example.com', 1], ['https://deployment.example.com/path', 1], ['http://deployment.example.com', 1]]) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', 'const n = await import(process.argv[1]); n.route({origin: "https://deployment.example.com", kind: "agent-list", workspaceId: "123"});', new URL('./navigation.mjs', import.meta.url).href], { env: { ...process.env, EVOSE_ORIGINS: configured }, encoding: 'utf8' });
  assert.equal(result.status, expected, result.stderr);
}
console.log('navigation checks passed: identity, origin/ID validation, ambiguity, prompt export boundary');
