import {DurableObject} from 'cloudflare:workers';
const enc = new TextEncoder();
export const hash = async value => hex(await crypto.subtle.digest('SHA-256',enc.encode(value)));
const hex = bytes => Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
async function derive(password,salt) {
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',salt:enc.encode(salt),iterations:100000},key,256));
}
export class Accounts extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env);
    this.db=ctx.storage.sql;
    this.db.exec("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT UNIQUE,hash TEXT,salt TEXT,role TEXT DEFAULT 'pending'); CREATE TABLE IF NOT EXISTS sessions(key TEXT PRIMARY KEY,user TEXT,expires INTEGER); CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,qty INTEGER,expires INTEGER)");
  }
  allow(key) {
    this.db.exec('DELETE FROM attempts WHERE expires<=?',Date.now());
    const row=this.db.exec('SELECT qty FROM attempts WHERE key=?',key).toArray()[0];
    if(row && row.qty>=20)return false;
    this.db.exec('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET qty=qty+1',key,Date.now()+600000);
    return true;
  }
  async signup(name,password) {
    const id=crypto.randomUUID(),salt=crypto.randomUUID(),digest=await derive(password,salt);
    const added=this.db.exec('INSERT INTO users(id,name,hash,salt) VALUES(?,?,?,?) ON CONFLICT(name) DO NOTHING RETURNING id',id,name,digest,salt).toArray();
    return added.length ? id : null;
  }
  async login(name,password) {
    const user=this.db.exec('SELECT * FROM users WHERE name=?',name).toArray()[0];
    const digest=await derive(password,user?.salt||'missing-user');
    if (!user || !crypto.subtle.timingSafeEqual(enc.encode(digest),enc.encode(user.hash)))return null;
    const token=hex(crypto.getRandomValues(new Uint8Array(32)));
    this.db.exec('DELETE FROM sessions WHERE expires<=?',Date.now());
    this.db.exec('INSERT INTO sessions VALUES(?,?,?)',await hash(token),user.id,Date.now()+8*3600000);
    return token;
  }
  account(key) {
    return this.db.exec('SELECT u.id,u.name,u.role FROM users u JOIN sessions s ON s.user=u.id WHERE s.key=? AND s.expires>?',key,Date.now()).toArray()[0]||null;
  }
  logout(key){this.db.exec('DELETE FROM sessions WHERE key=?',key);}
  list(){return this.db.exec('SELECT id,name,role FROM users ORDER BY name').toArray();}
  change(id,role){this.db.exec('UPDATE users SET role=? WHERE id=?',role,id);}
}
