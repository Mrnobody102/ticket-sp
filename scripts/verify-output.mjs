import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

// Validate the shipped files, not TypeScript sources. No network or credentials.
const root = resolve('.output/chrome-mv3');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, version);
assert(!manifest.host_permissions?.includes('<all_urls>'));
assert(!/unsafe-eval|https?:/i.test(manifest.content_security_policy?.extension_pages ?? ''));
async function reference(ref, base = root) {
  assert.equal(typeof ref, 'string');
  assert(ref && !/^(?:[a-z]+:|\/\/)/i.test(ref), `Non-local executable/resource: ${ref}`);
  const file = resolve(ref.startsWith('/') ? root : base, ref.replace(/^\/+/, '').split(/[?#]/)[0]);
  assert(file.startsWith(root + sep), `Resource escapes extension: ${ref}`);
  await access(file);
}
for (const ref of [manifest.background.service_worker, manifest.action.default_popup,
  ...Object.values(manifest.icons ?? {}), ...manifest.content_scripts.flatMap(script => [...(script.js ?? []), ...(script.css ?? [])])]) await reference(ref);
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    assert(!entry.isSymbolicLink(), 'Symlink in extension output');
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }))).flat();
}
const files = await walk(root);
for (const file of files) {
  const path = relative(root, file).replaceAll('\\', '/');
  assert(!/\.map$|(^|\/)(\.env[^/]*|node_modules|artifacts)(\/|$)/i.test(path), `Private/development file: ${path}`);
  if (file.endsWith('.js')) {
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
    assert.equal(checked.status, 0, checked.stderr || `Invalid JavaScript: ${path}`);
  }
  if (!file.endsWith('.html')) continue;
  const html = await readFile(file, 'utf8');
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const src = script[1].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    assert(src && !script[2].trim(), `Inline executable code in ${path}`);
    await reference(src, dirname(file));
  }
  for (const css of html.matchAll(/<link\b[^>]*href\s*=\s*["']([^"']+\.css)["'][^>]*>/gi)) await reference(css[1], dirname(file));
}
console.log(JSON.stringify({ version, manifest: 'MV3', files: files.length, localResources: true, javascriptSyntax: true, inlineScripts: false, privateFiles: false }));
