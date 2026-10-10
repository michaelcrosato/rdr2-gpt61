import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';

const root=resolve(import.meta.dirname,'..'),out=resolve(root,'dist');
const info=JSON.parse(await readFile(resolve(out,'build-info.json'),'utf8'));
const html=await readFile(resolve(out,'index.html'),'utf8');
const config=JSON.parse(await readFile(resolve(root,'vercel.json'),'utf8'));
assert.match(info.revision??'',/^[a-f0-9]{40}$/,'Build must identify its Git commit');
assert.equal(config.outputDirectory,'dist');
assert.equal(config.installCommand,'npm ci --ignore-scripts');
assert.equal(new Set(info.files.map(file=>file.file)).size,info.files.length);
for(const file of info.files){
  assert.match(file.file,/^assets\/[\w-]+-[A-Z0-9]{8}\.(js|css)$/);
  const bytes=await readFile(resolve(out,file.file));
  assert.equal(bytes.length,file.bytes,`Wrong size: ${file.file}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,`Wrong digest: ${file.file}`);
}
for(const [kind,path]of Object.entries(info.assets)){
  assert.ok(info.files.some(file=>'/'+file.file===path),`Missing ${kind} entry`);
  assert.ok(html.includes(`"${path}"`),`HTML does not load ${kind}`);
}
const references=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
assert.deepEqual(references.filter(path=>!path.startsWith('data:')&&path!=='./').sort(),[
  info.assets.style,info.assets.engine,info.assets.game,info.assets.engine,info.assets.game,
].sort(),'HTML must load only the compiled game assets');
assert.equal((await readFile(resolve(out,'third-party-notices.txt'),'utf8')),await readFile(resolve(root,'THIRD_PARTY_NOTICES.md'),'utf8'));
async function publishedFiles(directory){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name);
    if(entry.isDirectory())files.push(...await publishedFiles(path));
    else files.push(relative(out,path).replaceAll('\\','/'));
  }
  return files;
}
const published=(await publishedFiles(out)).sort();
assert.deepEqual(published,['index.html','404.html','build-info.json','third-party-notices.txt',...info.files.map(file=>file.file)].sort(),'Unexpected published files');
for(const route of ['/','/index.html','/build-info.json']){
  assert.ok(config.headers.some(rule=>rule.source===route&&rule.headers.some(header=>header.key.toLowerCase()==='cache-control'&&header.value==='public, max-age=0, must-revalidate')),`${route} must revalidate`);
}
assert.ok(config.headers.some(rule=>rule.source==='/assets/(.*)'&&rule.headers.some(header=>header.key.toLowerCase()==='cache-control'&&header.value==='public, max-age=31536000, immutable')),'Hashed assets must use immutable caching');
console.log(`Production build verified: ${published.length} files; commit ${info.revision}; asset hashes, HTML, license and cache rules match.`);
