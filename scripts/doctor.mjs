import { spawnSync } from 'node:child_process';

const version = process.versions.node.split('.').map(Number);
let ok = version[0] > 22 || (version[0] === 22 && version[1] >= 20);
console.log(`${ok ? 'OK' : 'MISSING'} Node ${process.versions.node} (requires >=22.20.0)`);
for (const [command, args] of [['git', ['--version']], ['ego-browser', ['skill']]]) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
  const complete = command !== 'ego-browser' || result.stdout?.includes('[ego-browser:skill] end of guide');
  const ready = result.status === 0 && complete;
  ok &&= ready;
  console.log(`${ready ? 'OK' : 'MISSING'} ${command}${command === 'ego-browser' ? ' (complete runtime guide)' : ''}`);
  if (!ready) console.log(command === 'ego-browser' ? 'Install/open ego lite from https://lite.ego.app/, complete onboarding, then retry.' : result.error?.message || result.stderr);
}
console.log('Evose login and workspace permissions require a separate check in the browser.');
process.exitCode = ok ? 0 : 1;
