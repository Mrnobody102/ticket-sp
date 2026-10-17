import { readFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile('.output/chrome-mv3/manifest.json', 'utf8'));
if (manifest.version !== version) throw new Error('Build version does not match package.json. Run npm run share again.');
const guide = await readFile('.output/chrome-mv3/huong-dan.html', 'utf8');
if (!guide.includes('Cài một lần') || !guide.includes('manifest.json')) throw new Error('Installation guide missing from output.');
if (/<script\b/i.test(guide)) throw new Error('The shared guide must be standalone HTML, without runtime scripts.');
const source = resolve(`.output/ticket-sp-${version}-chrome.zip`);
const target = resolve(`.output/Camp-ve-${version}.zip`);
await copyFile(source, target);
const bytes = await readFile(target);
console.log(JSON.stringify({ file: target, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), guide: 'huong-dan.html inside ZIP', setup: 'Unzip, open huong-dan.html, Load unpacked the folder containing manifest.json' }, null, 2));
