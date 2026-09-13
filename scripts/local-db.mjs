import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function localDatabase(filename=':memory:'){
 const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA journal_mode=WAL');
 const db={prepare(sql){return {args:[],bind(...args){this.args=args;return this;},async first(){return sqlite.prepare(sql).get(...this.args)||null;},async all(){return {results:sqlite.prepare(sql).all(...this.args)};},async run(){const r=sqlite.prepare(sql).run(...this.args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)},success:true};}};},async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},withSession(){return this;},sqlite};return db;
}
export function migrate(db){db.sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)');for(const name of fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()){if(db.sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name))continue;db.sqlite.exec(fs.readFileSync('drizzle/'+name,'utf8'));db.sqlite.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(name);}}
