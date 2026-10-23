// Run the real installer under a temporary home; never replace the user's skills.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const home = await mkdtemp(join(tmpdir(), 'evose-install-'));
const source = process.env.EVOSE_TEST_SOURCE || root;
const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: join(home, '.codex'), XDG_CONFIG_HOME: join(home, '.config'), XDG_DATA_HOME: join(home, '.local', 'share'), DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1' };
delete env.EVOSE_LEARNING_STORE;
delete env.EVOSE_ORIGINS;
try {
  const dataDir = join(env.XDG_DATA_HOME, 'evose-skills');
  await mkdir(dataDir, { recursive: true });
  const store = join(dataDir, 'locations.jsonl');
  const sentinel = 'private observations must survive installation\n';
  await writeFile(store, sentinel);
  for (let pass = 1; pass <= 2; pass++) {
    const result = spawnSync(process.execPath, [join(root, 'node_modules/skills/bin/cli.mjs'), 'add', source, '--skill', 'evose-platform-manager', 'evose-agent-interaction', '-a', 'codex', '-g', '-y', '--copy'], { env, cwd: home, encoding: 'utf8', timeout: 90000 });
    assert.equal(result.status, 0, `Installer pass ${pass} failed: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
    // Universal agent skills are installed under .agents/skills by this CLI.
    const installed = join(home, '.agents', 'skills');
    assert.deepEqual((await readdir(installed)).sort(), ['evose-agent-interaction', 'evose-platform-manager']);
    for (const skill of ['evose-platform-manager', 'evose-agent-interaction']) {
      const content = await readFile(join(installed, skill, 'SKILL.md'), 'utf8');
      assert(content.includes(`name: ${skill}`));
    }
    await access(join(installed, 'evose-platform-manager', 'scripts', 'learning.mjs'));
    const imported = spawnSync(process.execPath, ['--input-type=module', '-e', 'const m = await import(process.argv[1]); console.log(m.DEFAULT_STORE);', pathToFileURL(join(installed, 'evose-platform-manager', 'scripts', 'learning.mjs')).href], { env, encoding: 'utf8' });
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout.trim(), store);
    assert.equal(await readFile(store, 'utf8'), sentinel);
  }
  console.log(`Real installer passed twice: both skills, helper imports and private state preserved (${source === root ? 'local source' : 'remote source'})`);
} finally {
  await rm(home, { recursive: true, force: true });
}
