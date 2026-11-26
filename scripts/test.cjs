const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.join(__dirname, '..');
for (const name of fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.cjs')).sort()) {
  console.log('\n' + name);
  const result = spawnSync(process.execPath, [path.join(root, 'tests', name)], {cwd:root, stdio:'inherit'});
  if (result.status !== 0) process.exit(result.status || 1);
}
