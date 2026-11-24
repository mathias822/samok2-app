// Bygger nettsideversjonen: samler all kode og CSS i én HTML-fil (artifact/dist/samok2.html)
// som kan publiseres på claude.ai. Kjør: npm run bygg-nettside

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const her = path.dirname(fileURLToPath(import.meta.url));
const rot = path.join(her, '..');

const resultat = await build({
  entryPoints: [path.join(her, 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  charset: 'utf8',
  legalComments: 'none',
});
const js = resultat.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const css = readFileSync(path.join(rot, 'public/css/stil.css'), 'utf8');
const ekstraCss = `
/* Tilpasning til claude.ai (mobilkanter og systemlinjer) */
.topp { top: env(safe-area-inset-top, 0px); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 11; background: var(--kort); }
main { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.demo-banner { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.talelinje { bottom: calc(16px + env(safe-area-inset-bottom, 0px)); max-width: calc(100% - 32px); }
`;

const index = readFileSync(path.join(rot, 'public/index.html'), 'utf8');
const kropp = index
  .slice(index.indexOf('<body>') + 6, index.indexOf('</body>'))
  .replace(/<script[^>]*><\/script>/g, '')
  .replace(/<div id="demo-banner"[\s\S]*?<\/div>/, `<div id="lagring-banner" class="demo-banner" hidden>
    Sidens database er ikke tilgjengelig akkurat nå, så det du gjør lagres bare i denne nettleseren.
  </div>`)
  .trim();

const html = `<title>Samøk 2 Øvingsapp</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
${ekstraCss}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.35.2/plotly.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"></script>
${kropp}
<script>
${js}
</script>
`;

mkdirSync(path.join(her, 'dist'), { recursive: true });
writeFileSync(path.join(her, 'dist/samok2.html'), html);
console.log(`Bygget artifact/dist/samok2.html (${Math.round(html.length / 1024)} KB)`);
