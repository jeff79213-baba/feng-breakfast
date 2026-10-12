import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JWT } from 'google-auth-library';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const keyDir = path.resolve(here, '..', '..');

function findKeyFile() {
  const files = fs.readdirSync(keyDir).filter(f => /^opencode-sk-.*\.json$/i.test(f)).sort();
  if (!files.length) throw new Error('找不到金鑰檔');
  return path.join(keyDir, files[0]);
}

function matchPaths(source) {
  const out = new Set();
  for (const line of String(source).split('\n')) {
    const m = line.match(/^\s*match\s+\/([^/{\s][^/\s]*)/);
    if (m && m[1] !== 'databases') out.add(m[1]);
  }
  return out;
}

async function main() {
  const strict = process.argv.includes('--strict');
  const key = JSON.parse(fs.readFileSync(findKeyFile(), 'utf8'));
  const client = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const { token } = await client.getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  const list = await (await fetch(
    'https://firebaserules.googleapis.com/v1/projects/opencode-sk/rulesets?pageSize=3', { headers })).json();
  const latest = (list.rulesets || [])[0];
  if (!latest) throw new Error('讀不到線上 rules 版本');
  console.log(`線上最新版：${latest.createTime}`);

  const src = await (await fetch(
    `https://firebaserules.googleapis.com/v1/${latest.name}`, { headers })).json();
  const liveText = ((src.source && src.source.files) || []).map(f => f.content).join('\n');
  const localText = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

  const live = matchPaths(liveText);
  const local = matchPaths(localText);
  const liveOnly = [...live].filter(p => !local.has(p));
  const localOnly = [...local].filter(p => !live.has(p));

  console.log(`線上段落：${[...live].join(', ') || '(無)'}`);
  console.log(`本地段落：${[...local].join(', ') || '(無)'}`);

  if (!liveOnly.length && !localOnly.length) {
    console.log('[OK] 線上與本地段落一致，可以部署');
    return;
  }
  for (const p of liveOnly) {
    console.log(`[危險] 線上有的「${p}」本地沒有——現在部署會把它刪掉！`);
  }
  for (const p of localOnly) {
    console.log(`[提醒] 本地有的「${p}」線上還沒有——部署後才會生效。`);
  }
  if (strict && liveOnly.length) {
    console.log('[中止] --strict 模式：有被刪段落風險，拒絕繼續。請先把線上段落併回本地。');
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('[失敗]', e.message); process.exit(1); });
