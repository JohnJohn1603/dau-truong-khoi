// Bản cho link claude.ai: trang đó tự bọc <html><head><body>, nên chỉ cần phần ruột của dist/index.html.
// Ghi ra dist-artifact/index.html (assets dùng chung với dist/).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
mkdirSync(new URL('../dist-artifact/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist-artifact/index.html', import.meta.url), head.trim() + '\n' + body.trim() + '\n');
console.log('dist-artifact/index.html ready');
