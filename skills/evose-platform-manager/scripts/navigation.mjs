// Local Codex helper; import inside ego-browser nodejs and pass its existing Page.
// ponytail: use observed DOM and native ego methods; no driver, agent loop or API client.
// Additional deployments are explicit local configuration, never learned from page text.
const ORIGINS = new Set(['https://app.evose.ai', ...(process.env.EVOSE_ORIGINS ?? '').split(',').filter(Boolean).map(value => {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.href !== `${parsed.origin}/`) throw new Error('EVOSE_ORIGINS must contain HTTPS origins without paths, credentials, queries or fragments');
  return parsed.origin;
})]);
const LISTS = { agent: 'build-service/agent', workflow: 'build-service/workflow', skill: 'scalability/skill' };
export const PROMPT_SELECTOR = '[data-slot="rich-editor-scroll-area"] .tiptap[contenteditable="true"]';

function checkedId(value, field) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new Error(`${field} must be an explicit nonzero decimal ID string`);
  return value;
}

function checkedOrigin(origin) {
  if (!ORIGINS.has(origin)) throw new Error('Unsupported origin; verify this deployment before extending the helper');
  return origin;
}

export function route({ origin, kind, workspaceId, resourceId }) {
  checkedOrigin(origin);
  const match = /^(agent|workflow|skill)-(list|config)$/.exec(kind);
  if (!match) throw new Error('Unsupported route kind');
  const [, type, mode] = match;
  const base = `/workspace/${checkedId(workspaceId, 'workspaceId')}`;
  if (mode === 'list') {
    if (resourceId !== undefined) throw new Error('List routes do not take resourceId');
    return `${origin}${base}/${LISTS[type]}`;
  }
  const segment = type === 'workflow' ? 'workflow' : LISTS[type];
  return `${origin}${base}/${segment}/${checkedId(resourceId, 'resourceId')}/configure`;
}

export function identity(url) {
  const parsed = new URL(url);
  checkedOrigin(parsed.origin);
  const config = /^\/workspace\/(\d+)\/(build-service\/agent|workflow|scalability\/skill)\/(\d+)\/configure\/?$/.exec(parsed.pathname);
  const list = /^\/workspace\/(\d+)\/(build-service\/agent|build-service\/workflow|scalability\/skill)\/?$/.exec(parsed.pathname);
  if (config) return { origin: parsed.origin, kind: `${config[2] === 'workflow' ? 'workflow' : config[2].split('/').at(-1)}-config`, workspaceId: config[1], resourceId: config[3] };
  if (list) return { origin: parsed.origin, kind: `${list[2].split('/').at(-1)}-list`, workspaceId: list[1] };
  throw new Error('Unsupported page; use the relevant operation reference or a scoped snapshot');
}

export async function inspect(page, { limit = 20, name = null } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('limit must be 1..50');
  if (name !== null && typeof name !== 'string') throw new Error('name must be an exact string');
  const before = identity((await page.info()).url);
  const state = await page.evaluate(({ limit, name, promptSelector }) => {
    const visible = el => !!(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const selectorFor = el => el.matches('[data-testid="skill-card"]')
      ? `[data-testid="skill-card"][data-skill-id=${JSON.stringify(el.getAttribute('data-skill-id'))}]`
      : `[role="button"].app-item:has(img[alt=${JSON.stringify(el.querySelector('img[alt]')?.alt ?? '')}])`;
    const cards = [...document.querySelectorAll('[role="button"].app-item,[data-testid="skill-card"]')].filter(visible);
    const nodes = [...document.querySelectorAll('.react-flow__node[data-id]')].filter(visible);
    const cardName = el => el.matches('[data-testid="skill-card"]') ? el.querySelector('.truncate')?.textContent.trim() : el.querySelector('img[alt]')?.alt;
    const matchingCards = name === null ? cards : cards.filter(el => cardName(el) === name);
    const editors = [...document.querySelectorAll('[contenteditable="true"]')].filter(visible);
    return {
      url: location.href,
      title: document.title,
      scopeName: document.querySelector('button[aria-label="切换工作空间"]')?.innerText.trim() ?? null,
      search: document.querySelector('input[name="search-query"]')?.value ?? null,
      cards: matchingCards.slice(0, limit).map(el => ({
        name: cardName(el),
        id: el.getAttribute('data-skill-id'),
        selector: selectorFor(el),
      })),
      renderedCards: cards.length,
      matchedCards: matchingCards.length,
      returnedCards: Math.min(matchingCards.length, limit),
      coverage: 'rendered-visible-cards-only; not a complete resource inventory',
      nodes: nodes.slice(0, limit).map(el => ({
        name: (el.innerText || '').split('\n')[0].trim(),
        id: el.getAttribute('data-id'),
        selector: `.react-flow__node[data-id=${JSON.stringify(el.getAttribute('data-id'))}]`,
      })),
      renderedNodes: nodes.length,
      controls: [...document.querySelectorAll('button')].filter(visible).map(el => ({
        name: el.getAttribute('aria-label') || el.innerText.trim(), disabled: el.disabled,
      })).filter(el => /^(保存|版本历史|发布|提示词|能力(?: \(\d+\))?|知识|对话体验|编辑|发布新版本|保存草稿)$/.test(el.name)),
      editors: editors.map(el => ({
        kind: el.matches(promptSelector) ? 'agent-prompt' : 'other',
        chars: el.innerText.length,
        selector: el.matches(promptSelector) ? promptSelector : null,
      })),
      files: [...document.querySelectorAll('[role="treeitem"]')].filter(visible).slice(0, limit).map(el => el.getAttribute('aria-label') || el.innerText.split('\n')[0]),
      dialogs: [...document.querySelectorAll('[role="dialog"]')].filter(visible).map(el => ({
        title: el.querySelector('h1,h2,h3,[data-slot="dialog-title"]')?.textContent.trim() ?? null,
      })),
    };
  }, { limit, name, promptSelector: PROMPT_SELECTOR });
  const after = identity(state.url);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Page changed during inspection; inspect its current state');
  return { identity: after, ...state };
}

async function ready(page, target) {
  if (target.kind.endsWith('-list')) {
    await page.waitForSelector('input[name="search-query"]', { state: 'visible' });
  } else if (target.kind === 'agent-config') {
    await page.waitForSelector('button[aria-label="提示词"]', { state: 'visible' });
    await page.waitForSelector(PROMPT_SELECTOR, { state: 'visible' });
  } else if (target.kind === 'workflow-config') {
    await page.waitForSelector('[data-testid="rf__wrapper"]', { state: 'visible' });
    await page.waitForSelector('.react-flow__node[data-id]', { state: 'visible' });
  } else {
    await page.waitForSelector('[role="treeitem"][aria-label="SKILL.md"]', { state: 'visible' });
  }
  const state = await inspect(page);
  if (JSON.stringify(state.identity) !== JSON.stringify(identity(route(target)))) throw new Error('Navigation redirected to another resource');
  // The list shell may render before its cards. Zero cards is not proof of absence.
  return state;
}

export async function open(page, target) {
  const url = route(target);
  const current = new URL((await page.info()).url);
  if (current.href !== 'about:blank' && current.origin !== target.origin) throw new Error('Use a blank Page or the same verified origin');
  await page.goto(url);
  return ready(page, target);
}

export async function locateNode(page, name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('An exact node name is required');
  if (identity((await page.info()).url).kind !== 'workflow-config') throw new Error('Node lookup requires the target workflow configuration');
  const learning = await import('./learning.mjs');
  const cached = await learning.recallLocator(page, `node:${name}`);
  if (cached) return { identity: cached.scope, name, id: cached.elementId, selector: cached.selector, reused: true };
  const state = await inspect(page, { limit: 50 });
  if (state.identity.kind !== 'workflow-config') throw new Error('Node lookup requires the target workflow configuration');
  const matches = state.nodes.filter(node => node.name === name);
  if (matches.length !== 1) throw new Error(`Expected one rendered exact node name, got ${matches.length}; use the node ID or inspect its current subtree`);
  const count = await page.evaluate(name => [...document.querySelectorAll('.react-flow__node[data-id]')].filter(el => (el.innerText || '').split('\n')[0].trim() === name).length, name);
  if (count !== 1) throw new Error(`Ambiguous or stale node name: ${count} matches`);
  await learning.learnLocator(page, { key: `node:${name}`, selector: matches[0].selector, expectedText: name });
  return { identity: state.identity, ...matches[0] };
}

export async function openByName(page, name, learningOptions = {}) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('An exact resource name is required');
  const state = await inspect(page, { limit: 50, name });
  if (!state.identity.kind.endsWith('-list')) throw new Error('Open the intended resource list first');
  const matches = state.cards.filter(card => card.name === name);
  if (matches.length !== 1) throw new Error(`Expected one rendered exact match, got ${matches.length}; inspect/search/scroll the current list`);
  const selected = matches[0];
  // Recheck the whole DOM, including rows omitted from the summary, before clicking.
  const count = await page.evaluate(selector => document.querySelectorAll(selector).length, selected.selector);
  if (count !== 1) throw new Error(`Ambiguous or stale resource selector: ${count} matches`);
  await page.click(`loc=css:${selected.selector}`, { label: '打开指定资源配置' });
  await page.waitForFunction(({ origin, workspaceId, kind }) => {
    if (location.origin !== origin) return false;
    const section = kind === 'workflow-list' ? 'workflow' : kind === 'agent-list' ? 'build-service/agent' : 'scalability/skill';
    return new RegExp(`^/workspace/${workspaceId}/${section}/[0-9]+/configure/?$`).test(location.pathname);
  }, state.identity);
  const target = identity((await page.info()).url);
  if (selected.id && target.resourceId !== selected.id) throw new Error('Opened resource ID differs from selected card');
  const result = await ready(page, target);
  const learning = await import('./learning.mjs');
  await learning.learnResource(page, name, target, learningOptions);
  return result;
}

export async function savePrompt(page, path) {
  const { isAbsolute } = await import('node:path');
  const { writeFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  if (!isAbsolute(path)) throw new Error('An absolute output path is required');
  const expected = identity((await page.info()).url);
  if (expected.kind !== 'agent-config') throw new Error('Prompt export requires the target Agent configuration page');
  const learning = await import('./learning.mjs');
  const cached = await learning.recallLocator(page, 'agent-prompt');
  const selector = cached?.selector ?? PROMPT_SELECTOR;
  const result = await page.evaluate(selector => {
    const matches = [...document.querySelectorAll(selector)].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    if (matches.length !== 1) throw new Error(`Expected one visible prompt editor, got ${matches.length}`);
    return { url: location.href, text: matches[0].innerText };
  }, selector);
  if (JSON.stringify(identity(result.url)) !== JSON.stringify(expected)) throw new Error('Resource changed during prompt read');
  // Rendered innerText is not the original Markdown or serialized Tiptap document.
  await learning.learnLocator(page, { key: 'agent-prompt', selector });
  await writeFile(path, result.text, { encoding: 'utf8', flag: 'wx' });
  return { identity: expected, path, format: 'rendered-innerText', chars: result.text.length, sha256: createHash('sha256').update(result.text).digest('hex') };
}
