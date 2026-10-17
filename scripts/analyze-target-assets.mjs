import { readFileSync } from 'node:fs';

// Inspect only public assets already observed in scripts/research-target.mjs.
// Print UI snippets, never auth/signing modules or full bundles.
const terms = process.argv.slice(2).filter(term => !term.startsWith('--file='));
if (!terms.length) throw new Error('Pass UI markers to inspect, for example: btn-add btn-continue');
const observed = JSON.parse(readFileSync('artifacts/target-research/event.json', 'utf8'));
const files = [...new Set(observed.assets.map(asset => asset.src)
  .filter(src => /^https:\/\/ticket\.1zone\.vn\/_next\/static\/chunks\/[\w-]+\.js$/.test(src)))];
const chosen = process.argv.find(term => term.startsWith('--file='))?.slice(7);
for (const src of files.filter(src => !chosen || src.endsWith(`/${chosen}.js`))) {
  const file = src.split('/').at(-1);
  const response = await fetch(src, { signal: AbortSignal.timeout(10000), credentials: 'omit', redirect: 'error' });
  if (!response.ok) continue;
  const code = await response.text();
  for (const term of terms) {
    let start = 0, count = 0;
    while ((start = code.indexOf(term, start)) >= 0 && count++ < 3) {
      const snippet = code.slice(Math.max(0, start - 450), start + term.length + 650); start += term.length;
      if (!/secret|signature|authorization|Bearer|api.?key|password/i.test(snippet)) console.log(JSON.stringify({ file, term, snippet }));
    }
  }
}
