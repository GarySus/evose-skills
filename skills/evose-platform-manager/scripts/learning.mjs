// ponytail: append small JSON facts; never generate or execute learned code.
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';
import { identity, route, open, openByName } from './navigation.mjs';

// Keep private observations outside installed files so updates cannot erase them.
export const DEFAULT_STORE = process.env.EVOSE_LEARNING_STORE ?? join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'evose-skills', 'locations.jsonl');
if (!isAbsolute(DEFAULT_STORE)) throw new Error('EVOSE_LEARNING_STORE and XDG_DATA_HOME must resolve to an absolute path');

function keyFor(scope, key) {
  // Canonical field order; resource locators are isolated from sibling resources.
  identity(route(scope));
  if (typeof key !== 'string' || !key.trim() || key.length > 200) throw new Error('A short semantic key is required');
  return JSON.stringify([scope.origin, scope.workspaceId, scope.kind, scope.resourceId ?? null, key]);
}

async function records(store) {
  if (!isAbsolute(store)) throw new Error('Learning store path must be absolute');
  let text;
  try { text = await readFile(store, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return new Map(); throw error; }
  const latest = new Map();
  for (const line of text.split('\n').filter(Boolean)) {
    // Fail on damaged records; do not silently replace an unreadable knowledge file.
    const item = JSON.parse(line);
    if (item.schema !== 1 || !['resource', 'locator'].includes(item.category) || !['active', 'stale'].includes(item.status)) throw new Error('Invalid learned record');
    if (item.id !== keyFor(item.scope, item.key)) throw new Error('Learned record scope mismatch');
    // A late invalidation from another process must not retire a newer learned fact.
    const current = latest.get(item.id);
    if (item.status === 'stale' && current && (current.learnedAt !== item.learnedAt || JSON.stringify(current.fact) !== JSON.stringify(item.fact))) continue;
    latest.set(item.id, item);
  }
  return latest;
}

export async function lookup(scope, key, { store = DEFAULT_STORE } = {}) {
  const item = (await records(store)).get(keyFor(scope, key));
  return item?.status === 'active' ? item : null;
}

async function remember(category, scope, key, fact, { store = DEFAULT_STORE } = {}) {
  const id = keyFor(scope, key);
  const previous = (await records(store)).get(id);
  if (previous?.status === 'active' && previous.category === category && JSON.stringify(previous.fact) === JSON.stringify(fact)) return { recorded: false, record: previous };
  const now = new Date().toISOString();
  const record = { schema: 1, id, category, scope, key, fact, status: 'active', evidenceLevel: 'single-observation', learnedAt: now };
  const line = JSON.stringify(record) + '\n';
  if (line.length > 8192) throw new Error('Learned fact is too large');
  await mkdir(dirname(store), { recursive: true });
  await appendFile(store, line, { encoding: 'utf8', mode: 0o600 });
  return { recorded: true, record };
}

export async function invalidate(scope, key, reason, { store = DEFAULT_STORE } = {}) {
  const previous = await lookup(scope, key, { store });
  if (!previous) return false;
  await appendFile(store, JSON.stringify({ ...previous, status: 'stale', invalidatedAt: new Date().toISOString(), reason: String(reason).slice(0,200) }) + '\n');
  return true;
}

async function observe(page, selector, expectedText = null) {
  if (typeof selector !== 'string' || !selector.trim() || selector.length > 1000) throw new Error('A bounded CSS selector is required');
  if (expectedText !== null && (typeof expectedText !== 'string' || expectedText.length > 160)) throw new Error('Expected text must be a short first-line label');
  return page.evaluate(({ selector, expectedText }) => {
    const visible = el => !!(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const matches = [...document.querySelectorAll(selector)];
    if (matches.length !== 1 || !visible(matches[0])) return { url: location.href, valid: false, reason: `Expected one visible element; matched ${matches.length}` };
    const el = matches[0];
    if (expectedText !== null && (el.innerText || '').split('\n')[0].trim() !== expectedText) return { url: location.href, valid: false, reason: 'Element label changed' };
    const attributes = {};
    for (const name of ['role','aria-label','data-testid','data-slot','data-id','contenteditable','type']) {
      if (el.hasAttribute(name)) attributes[name] = el.getAttribute(name);
    }
    const label = el.isContentEditable || ['INPUT','TEXTAREA'].includes(el.tagName) ? null : (el.innerText || '').split('\n')[0].trim().slice(0,160);
    return { url: location.href, valid: true, fingerprint: { tag: el.tagName, attributes, label } };
  }, { selector, expectedText });
}

export async function learnLocator(page, { key, selector, expectedText = null }, options = {}) {
  const scope = identity((await page.info()).url);
  const observed = await observe(page, selector, expectedText);
  if (keyFor(identity(observed.url), key) !== keyFor(scope, key)) throw new Error('Page changed during learning');
  if (!observed.valid) throw new Error(`Not learned: ${observed.reason}`);
  const { recorded } = await remember('locator', scope, key, { selector, expectedText, fingerprint: observed.fingerprint }, options);
  return { scope, key, selector, recorded, evidenceLevel: 'single-observation' };
}

export async function recallLocator(page, key, options = {}) {
  const scope = identity((await page.info()).url);
  const record = await lookup(scope, key, options);
  if (!record || record.category !== 'locator') return null;
  const observed = await observe(page, record.fact.selector, record.fact.expectedText);
  // A navigation/control error is not evidence that the selector is stale.
  if (keyFor(identity(observed.url), key) !== keyFor(scope, key)) throw new Error('Page changed during recall');
  if (!observed.valid || JSON.stringify(observed.fingerprint) !== JSON.stringify(record.fact.fingerprint)) {
    await invalidate(scope, key, observed.reason || 'Element fingerprint changed', options);
    return null;
  }
  return { scope, key, selector: record.fact.selector, elementId: record.fact.fingerprint.attributes['data-id'] ?? null, reused: true };
}

async function nameVisible(page, name) {
  return page.evaluate(name => ({ url: location.href, found: [...document.querySelectorAll('span,div,h1,h2,h3')].some(el => el.textContent.trim() === name && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden') }), name);
}

export async function learnResource(page, name, target, options = {}) {
  if (!/^(agent|workflow|skill)-config$/.test(target.kind)) throw new Error('Resource learning requires a configuration page');
  if (JSON.stringify(identity((await page.info()).url)) !== JSON.stringify(identity(route(target)))) throw new Error('Resource identity differs from verified target');
  const observed = await nameVisible(page, name);
  if (!observed.found || JSON.stringify(identity(observed.url)) !== JSON.stringify(identity(route(target)))) throw new Error('Resource name was not corroborated on the destination page');
  const scope = { origin: target.origin, kind: target.kind.replace('-config','-list'), workspaceId: target.workspaceId };
  const { recorded } = await remember('resource', scope, name, { target: identity(route(target)) }, options);
  return { recorded, target };
}

export async function openResource(page, { origin, workspaceId, type, name }, { store = DEFAULT_STORE } = {}) {
  const scope = { origin, workspaceId, kind: `${type}-list` };
  const record = await lookup(scope, name, { store });
  if (record?.category === 'resource') {
    const expectedScope = { origin: record.fact.target.origin, workspaceId: record.fact.target.workspaceId, kind: record.fact.target.kind.replace('-config','-list') };
    if (keyFor(expectedScope, name) !== keyFor(scope, name)) throw new Error('Learned resource target escaped its scope');
    const state = await open(page, record.fact.target);
    const observed = await nameVisible(page, name);
    if (JSON.stringify(identity(observed.url)) !== JSON.stringify(state.identity)) throw new Error('Page changed during resource recall');
    if (observed.found) return { ...state, resolution: 'learned' };
    await invalidate(scope, name, 'Destination name no longer matches', { store });
    // Read-only rediscovery below; never run/publish/save to test a learned route.
  }
  await open(page, scope);
  await page.waitForFunction(name => [...document.querySelectorAll('[role="button"].app-item,[data-testid="skill-card"]')].some(el => (el.matches('[data-testid="skill-card"]') ? el.querySelector('.truncate')?.textContent.trim() : el.querySelector('img[alt]')?.alt) === name), name, { timeout: 8000 });
  const state = await openByName(page, name, { store });
  return { ...state, resolution: 'discovered' };
}
