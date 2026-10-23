import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
async function walk(dir) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const path = resolve(dir, entry.name);
    assert(!entry.isSymbolicLink(), `Unexpected symlink: ${path}`);
    if (entry.isDirectory()) {
      assert(!['learned', 'output', '.local', '.agents', '.codex'].includes(entry.name), `Private directory in source: ${path}`);
      paths.push(...await walk(path));
    } else paths.push(path);
  }
  return paths;
}

for (const name of ['evose-platform-manager', 'evose-agent-interaction']) {
  const text = await readFile(resolve(root, 'skills', name, 'SKILL.md'), 'utf8');
  assert(text.startsWith(`---\nname: ${name}\ndescription: `), `Invalid frontmatter: ${name}`);
  assert(text.indexOf('\n---\n', 4) > 0, `Unclosed frontmatter: ${name}`);
}

const paths = await walk(root);
for (const path of paths) {
  assert(!/^(?:\.env(?:\..*)?|.*\.(?:pem|key))$/.test(path.split(sep).at(-1)), `Private file: ${path}`);
  const text = await readFile(path, 'utf8');
  assert(!/\/(?:Users|home)\/[a-zA-Z0-9_-]+\//.test(text), `Personal absolute path: ${path}`);
  assert(!/\b(?:ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+)\b/.test(text), `Credential-shaped content: ${path}`);
  if (path.includes(`${sep}skills${sep}`)) {
    assert(!/\b\d{15,20}\b|\b(?:ou_|oc_|om_|cli_)[a-f0-9]{12,}\b/.test(text), `Live resource identifier: ${path}`);
  }
  if (!path.endsWith('.md')) continue;
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].split('#')[0];
    if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    const target = resolve(dirname(path), decodeURIComponent(href));
    assert(!relative(root, target).startsWith(`..${sep}`), `Link escapes package: ${path}`);
    await access(target).catch(() => { throw new Error(`Broken link in ${relative(root, path)}: ${href}`); });
  }
}
console.log(`Package checks passed: ${paths.length} files, skill names, local links and public-file boundaries`);
