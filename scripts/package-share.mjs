import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { createZip } from '@aklinker1/zero-zip';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const output = process.env.CAMP_BUILD_DIR ?? '.output';
const build = resolve(output, 'chrome-mv3');
const manifest = JSON.parse(await readFile(join(build, 'manifest.json'), 'utf8'));
if (manifest.version !== version) throw new Error('Build version differs from package.json. Rebuild before packaging.');
const guide = await readFile(join(build, 'huong-dan.html'), 'utf8');
if (!guide.includes('Cài một lần') || !guide.includes('manifest.json')) throw new Error('Installation guide missing.');
if (/<script\b/i.test(guide)) throw new Error('The installation guide must work without JavaScript.');

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.sort((a, b) => a.name.localeCompare(b.name)).map(entry => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in output: ${path}`);
    return entry.isDirectory() ? files(path) : [path];
  }));
  return nested.flat();
}
const zip = createZip();
const hashes = {};
for (const file of await files(build)) {
  const path = relative(build, file).replaceAll('\\', '/');
  if (/\.map$|(^|\/)(\.env[^/]*|node_modules|artifacts)(\/|$)/i.test(path)) throw new Error(`Private/development file in output: ${path}`);
  const bytes = await readFile(file);
  zip.addFile(`tien-ich/${path}`, bytes);
  hashes[path] = sha256(bytes);
}
zip.addFile('BAT-DAU.html', guide);
zip.addFile('quyen-rieng-tu.html', await readFile(join(build, 'quyen-rieng-tu.html')));
zip.addFile('PHIEN-BAN.txt', `Camp vé ${version}\nMở BAT-DAU.html để cài. Chọn thư mục tien-ich khi Load unpacked.\nBản thử miễn phí. Chưa có hệ thống tài khoản/cấp quyền sử dụng.\n`);
const friendFile = join(output, `Camp-ve-${version}.zip`);
await writeFile(friendFile, await zip.toBuffer());
const storeFile = join(output, `ticket-sp-${version}-chrome.zip`);
const artifacts = await Promise.all([friendFile, storeFile].map(async file => {
  const bytes = await readFile(file);
  return { file, bytes: bytes.length, sha256: sha256(bytes) };
}));
const report = { version, artifacts, files: hashes };
await writeFile(join(output, 'release.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(join(output, 'SHA256SUMS.txt'), artifacts.map(item => `${item.sha256}  ${item.file.replaceAll('\\', '/').split('/').at(-1)}`).join('\n') + '\n');
console.log(JSON.stringify({ version, artifacts, install: 'Unzip → BAT-DAU.html → Load unpacked tien-ich' }, null, 2));

// Stable GitHub download path: overwrite the latest package, never accumulate versions.
const distribution = resolve('dist');
await mkdir(distribution, { recursive: true });
const friendBytes = await readFile(friendFile);
await writeFile(join(distribution, 'Camp-ve-latest.zip.tmp'), friendBytes);
await rename(join(distribution, 'Camp-ve-latest.zip.tmp'), join(distribution, 'Camp-ve-latest.zip'));
await writeFile(join(distribution, 'SHA256SUMS.txt'), `${sha256(friendBytes)}  Camp-ve-latest.zip\n`);
await writeFile(join(distribution, 'release.json'), JSON.stringify({ version, file: 'Camp-ve-latest.zip', sha256: sha256(friendBytes), bytes: friendBytes.length, installDirectory: 'tien-ich', files: hashes }, null, 2) + '\n');
