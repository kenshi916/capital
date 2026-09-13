import { build } from 'esbuild';
await build({ entryPoints: ['src/chain.js'], outfile: 'dist/chain.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], legalComments: 'eof' });
await build({ entryPoints: ['src/launch.js'], outfile: 'dist/launch.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], legalComments: 'eof' });
console.log('Wallet application bundled.');
await build({ entryPoints: ['src/holder-preview.js'], outfile: 'dist/holder-preview.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], legalComments: 'eof' });
await build({ entryPoints: ['src/metamask-connect.js'], outfile: 'dist/metamask-connect.js', bundle: true, minify: true, format: 'esm', platform: 'browser', target: ['es2022'], legalComments: 'eof' });
