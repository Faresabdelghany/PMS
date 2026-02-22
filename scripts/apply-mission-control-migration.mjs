/**
 * apply-mission-control-migration.mjs
 * 
 * Applies the Mission Control migration to the Supabase database.
 * Usage: node scripts/apply-mission-control-migration.mjs
 * 
 * Requires: SUPABASE_DB_PASSWORD env var OR interactive prompt
 */

import { readFileSync } from 'fs';
import { createConnection } from 'net';
import { connect } from 'tls';
import { createInterface } from 'readline';

// ─── Config ────────────────────────────────────────────────────────
const HOST = 'aws-1-eu-central-1.pooler.supabase.com';
const PORT = 5432;
const USER = 'postgres.lazhmdyajdqbnxxwyxun';
const DATABASE = 'postgres';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!PASSWORD) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n⚠️  SUPABASE_DB_PASSWORD environment variable not set.');
  console.log('   Find it at: Supabase Dashboard → Settings → Database → Database password');
  rl.close();
  process.exit(1);
}

// ─── Migration SQL ─────────────────────────────────────────────────
const SQL = readFileSync(
  new URL('../supabase/migrations/20260223000001_mission_control.sql', import.meta.url),
  'utf8'
);

// ─── Minimal Postgres wire protocol client ─────────────────────────
class PgClient {
  constructor() {
    this.socket = null;
    this.buf = Buffer.alloc(0);
    this.resolve = null;
    this.reject = null;
  }

  connect(host, port, user, password, database) {
    return new Promise((resolve, reject) => {
      this.socket = connect({ host, port, rejectUnauthorized: false }, () => {
        // Send startup message
        const startup = this._startupMessage(user, database);
        this.socket.write(startup);
        this.resolve = resolve;
        this.reject = reject;
        this._handleAuth(user, password);
      });
      this.socket.on('error', reject);
    });
  }

  _startupMessage(user, database) {
    const params = `user\x00${user}\x00database\x00${database}\x00\x00`;
    const len = 4 + 4 + params.length;
    const buf = Buffer.alloc(len);
    buf.writeInt32BE(len, 0);
    buf.writeInt32BE(196608, 4); // Protocol 3.0
    Buffer.from(params).copy(buf, 8);
    return buf;
  }

  _handleAuth(user, password) {
    this.socket.on('data', (chunk) => {
      this.buf = Buffer.concat([this.buf, chunk]);
      this._process();
    });
  }

  _process() {
    while (this.buf.length >= 5) {
      const type = String.fromCharCode(this.buf[0]);
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < 1 + len) break;

      const payload = this.buf.slice(5, 1 + len);
      this.buf = this.buf.slice(1 + len);

      switch (type) {
        case 'R': { // Authentication
          const authType = payload.readInt32BE(0);
          if (authType === 0) {
            // AuthenticationOk
          } else if (authType === 5) {
            // MD5 password
            const salt = payload.slice(4, 8);
            const md5pwd = this._md5Auth(user, this.password, salt);
            this._sendPassword(md5pwd);
          } else if (authType === 10) {
            // SASL - not implemented
            console.log('SASL auth not supported in this script. Use supabase CLI instead.');
            this.socket.destroy();
          }
          break;
        }
        case 'E': { // Error
          const msg = payload.toString('utf8');
          if (this.reject) this.reject(new Error('PG Error: ' + msg));
          break;
        }
        case 'Z': { // ReadyForQuery
          if (this.resolve) { this.resolve(this); this.resolve = null; }
          break;
        }
        // Ignore other messages during startup
      }
    }
  }

  _sendPassword(pwd) {
    const p = Buffer.from(pwd + '\x00');
    const buf = Buffer.alloc(1 + 4 + p.length);
    buf[0] = 0x70; // 'p'
    buf.writeInt32BE(4 + p.length, 1);
    p.copy(buf, 5);
    this.socket.write(buf);
  }

  async query(sql) {
    return new Promise((resolve, reject) => {
      const results = [];
      let error = null;

      const onData = (chunk) => {
        this.buf = Buffer.concat([this.buf, chunk]);
        while (this.buf.length >= 5) {
          const type = String.fromCharCode(this.buf[0]);
          const len = this.buf.readInt32BE(1);
          if (this.buf.length < 1 + len) break;
          const payload = this.buf.slice(5, 1 + len);
          this.buf = this.buf.slice(1 + len);

          if (type === 'C') results.push(payload.toString('utf8'));
          if (type === 'E') error = payload.toString('utf8');
          if (type === 'Z') {
            this.socket.removeListener('data', onData);
            if (error) reject(new Error(error));
            else resolve(results);
          }
        }
      };

      this.socket.on('data', onData);

      // Simple query
      const q = Buffer.from(sql + '\x00');
      const buf = Buffer.alloc(1 + 4 + q.length);
      buf[0] = 0x51; // 'Q'
      buf.writeInt32BE(4 + q.length, 1);
      q.copy(buf, 5);
      this.socket.write(buf);
    });
  }

  close() {
    const buf = Buffer.from([0x58, 0, 0, 0, 4]); // 'X' terminate
    this.socket.write(buf);
    this.socket.destroy();
  }
}

// ─── Main ──────────────────────────────────────────────────────────
const client = new PgClient();
client.password = PASSWORD;

try {
  console.log(`\n🔌 Connecting to ${HOST}:${PORT}...`);
  await client.connect(HOST, PORT, USER, PASSWORD, DATABASE);
  console.log('✅ Connected!\n');

  console.log('🚀 Applying migration: 20260223000001_mission_control.sql');
  const results = await client.query(SQL);
  
  results.forEach(r => console.log('  ✓', r.replace(/\x00/g, '').trim()));
  console.log('\n🎉 Migration applied successfully!');
} catch (err) {
  console.error('\n❌ Migration failed:', err.message);
  console.log('\n💡 Alternative: Apply the migration manually via:');
  console.log('   1. Supabase Dashboard → SQL Editor');
  console.log('   2. Paste contents of: supabase/migrations/20260223000001_mission_control.sql');
  process.exitCode = 1;
} finally {
  try { client.close(); } catch {}
}
