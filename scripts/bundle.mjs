import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';
await build({ entryPoints: ['src/chain.js'], outfile: 'dist/chain.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], legalComments: 'eof' });
await build({ entryPoints: ['src/launch.js'], outfile: 'dist/launch.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], legalComments: 'eof' });
console.log('Wallet application bundled.');
await build({entryPoints:['src/portfolio-explorer.js'],outfile:'dist/portfolio-explorer.js',bundle:true,minify:true,format:'iife',target:['es2022'],legalComments:'eof'});
await build({ entryPoints: ['src/holder-preview.js'], outfile: 'dist/holder-preview.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], legalComments: 'eof' });
await build({ entryPoints: ['src/metamask-connect.js'], outfile: 'dist/metamask-connect.js', bundle: true, minify: true, format: 'esm', platform: 'browser', target: ['es2022'], legalComments: 'eof' });

await build({ entryPoints: ['src/community.js'], outfile: 'dist/community.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], legalComments: 'eof' });
await build({ entryPoints: ['src/forum.js'], outfile: 'dist/forum.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], legalComments: 'eof' });

const companyContext=vm.createContext({});vm.runInContext(fs.readFileSync('dist/opportunities.js','utf8')+';globalThis.data=FUNDING_OPPORTUNITIES;',companyContext);fs.writeFileSync('server/companies.json',JSON.stringify(companyContext.data,null,2)+'\n');
await build({entryPoints:['server/worker.js'],outfile:'dist/server/index.js',bundle:true,minify:true,format:'esm',platform:'browser',target:['es2022'],legalComments:'eof'});
fs.mkdirSync('dist/client',{recursive:true});
for(const entry of fs.readdirSync('dist',{withFileTypes:true})){if(['client','server','.openai'].includes(entry.name))continue;fs.cpSync(path.join('dist',entry.name),path.join('dist/client',entry.name),{recursive:true});}
fs.mkdirSync('dist/.openai',{recursive:true});fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
fs.cpSync('drizzle','dist/.openai/drizzle',{recursive:true});
