import {build} from 'esbuild';
import {readFile,mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';

const root=resolve(import.meta.dirname,'..'),out=resolve(root,'dist');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const common={absWorkingDir:root,outdir:'dist/assets',entryNames:'[name]-[hash]',bundle:true,minify:true,target:['es2022','safari15.4','chrome110','firefox110'],metafile:true,write:true,legalComments:'eof',logLevel:'warning'};
const [engine,app]=await Promise.all([
  build({...common,entryPoints:{engine:'my-3d2dge-agent.js'},format:'iife'}),
  build({...common,entryPoints:{game:'src/game.js',theme:'styles.css'},format:'esm',splitting:true,chunkNames:'chunk-[hash]'}),
]);
const outputs={...engine.metafile.outputs,...app.metafile.outputs};
const entry=source=>{const name=Object.entries(outputs).find(([,value])=>value.entryPoint===source)?.[0];if(!name)throw new Error(`Missing build entry ${source}`);return'/'+relative(out,resolve(root,name)).replaceAll('\\','/');};
const assets={engine:entry('my-3d2dge-agent.js'),game:entry('src/game.js'),style:entry('styles.css')};
let html=await readFile(resolve(root,'index.html'),'utf8');
for(const [before,after]of [['href="styles.css"',`href="${assets.style}"`],['src="my-3d2dge-agent.js"',`src="${assets.engine}"`],['src="src/game.js"',`src="${assets.game}"`]]){if(!html.includes(before))throw new Error(`Missing HTML build reference ${before}`);html=html.replace(before,after);}
html=html.replace('</head>',`  <link rel="preload" as="script" href="${assets.engine}">\n  <link rel="modulepreload" href="${assets.game}">\n</head>`);
await writeFile(resolve(out,'index.html'),html);
await writeFile(resolve(out,'third-party-notices.txt'),await readFile(resolve(root,'THIRD_PARTY_NOTICES.md'),'utf8'));
let revision=process.env.VERCEL_GIT_COMMIT_SHA||null;try{revision||=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
const sizes=[];for(const name of Object.keys(outputs)){const bytes=await readFile(resolve(root,name));sizes.push({file:relative(out,resolve(root,name)).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),gzip:gzipSync(bytes).length,brotli:brotliCompressSync(bytes).length});}
await writeFile(resolve(out,'build-info.json'),JSON.stringify({game:'Dust & Mercy',revision,assets,files:sizes},null,2)+'\n');
await writeFile(resolve(out,'404.html'),'<!doctype html><meta name="viewport" content="width=device-width"><title>Dust & Mercy</title><style>body{background:#242a22;color:#e5d5af;font:20px Georgia;margin:10vh auto;max-width:36rem;padding:1.5rem}a{color:inherit}</style><h1>That trail ends here.</h1><p><a href="/">Return to Dust & Mercy</a></p>');
console.log(JSON.stringify({output:'dist',revision,files:sizes,totalBytes:sizes.reduce((n,f)=>n+f.bytes,0),brotliBytes:sizes.reduce((n,f)=>n+f.brotli,0)},null,2));
