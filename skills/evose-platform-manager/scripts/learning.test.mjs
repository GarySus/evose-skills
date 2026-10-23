import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { learnLocator, recallLocator, lookup, learnResource } from './learning.mjs';

const dir = await mkdtemp(join(tmpdir(), 'evose-learning-'));
const store = join(dir, 'locations.jsonl');
let resource = '456';
let valid = true;
let fingerprint = { tag: 'BUTTON', attributes: { 'aria-label': '提示词' } };
const page = {
  info: async () => ({ url: `https://app.evose.ai/workspace/123/build-service/agent/${resource}/configure` }),
  evaluate: async () => ({ url: (await page.info()).url, valid, fingerprint }),
};
const args = { key: 'prompt-tab', selector: 'button[aria-label="提示词"]' };
try {
  assert.equal((await learnLocator(page, args, { store })).recorded, true);
  assert.equal((await learnLocator(page, args, { store })).recorded, false);
  assert.equal((await readFile(store, 'utf8')).trim().split('\n').length, 1);
  const oldRecord = JSON.parse((await readFile(store, 'utf8')).trim());
  assert.equal((await recallLocator(page, args.key, { store })).reused, true);
  resource = '999';
  assert.equal(await recallLocator(page, args.key, { store }), null);
  resource = '456';
  fingerprint = { tag: 'BUTTON', attributes: { 'aria-label': '删除' } };
  assert.equal(await recallLocator(page, args.key, { store }), null);
  assert.equal(await lookup({ origin: 'https://app.evose.ai', kind: 'agent-config', workspaceId: '123', resourceId: resource }, args.key, { store }), null);
  valid = false;
  await assert.rejects(learnLocator(page, args, { store }), /Not learned/);
  const otherScope = { origin: 'https://app.evose.ai', kind: 'agent-config', workspaceId: '999', resourceId: resource };
  await assert.rejects(learnResource(page, 'Name', otherScope, { store }), /identity differs/);
  valid = true;
  await learnLocator(page, args, { store });
  await appendFile(store, JSON.stringify({ ...oldRecord, status: 'stale' }) + '\n');
  assert.equal((await recallLocator(page, args.key, { store })).reused, true);
  await writeFile(store, '{broken json}\n');
  await assert.rejects(recallLocator(page, args.key, { store }), SyntaxError);
  console.log('learning checks passed: first success, deduplication, scoped reuse, stale fingerprint, rejected ambiguity, corrupt store');
} finally {
  await rm(dir, { recursive: true, force: true });
}
