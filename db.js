// db.js
// Lightweight, dependency-free JSON-file datastore.
// This is intentionally simple so the project runs anywhere (Replit, local, etc.)
// with zero native dependencies. Swap this for Postgres/SQLite in production —
// the read/write API below is the only thing you'd need to reimplement.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  invoices: path.join(DATA_DIR, 'invoices.json'),
  joinRequests: path.join(DATA_DIR, 'joinRequests.json'),
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const file of Object.values(FILES)) {
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf-8');
  }
}
ensureStore();

function readAll(collection) {
  const raw = fs.readFileSync(FILES[collection], 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeAll(collection, records) {
  // Write to a temp file then rename, to avoid corrupting the file if the
  // process is interrupted mid-write.
  const tmp = FILES[collection] + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf-8');
  fs.renameSync(tmp, FILES[collection]);
}

function nextId(records) {
  return records.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
}

const db = {
  users: {
    all() {
      return readAll('users');
    },
    findByEmail(email) {
      return readAll('users').find(
        (u) => u.email.toLowerCase() === String(email).toLowerCase()
      );
    },
    findById(id) {
      return readAll('users').find((u) => u.id === id);
    },
    create(user) {
      const records = readAll('users');
      const record = { id: nextId(records), created_at: new Date().toISOString(), ...user };
      records.push(record);
      writeAll('users', records);
      return record;
    },
    update(id, patch) {
      const records = readAll('users');
      const idx = records.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      records[idx] = { ...records[idx], ...patch };
      writeAll('users', records);
      return records[idx];
    },
  },
  invoices: {
    all() {
      return readAll('invoices');
    },
    forUser(userId) {
      return readAll('invoices')
        .filter((inv) => inv.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    findById(id, userId) {
      return readAll('invoices').find((inv) => inv.id === id && inv.user_id === userId);
    },
    create(invoice) {
      const records = readAll('invoices');
      const record = { id: nextId(records), created_at: new Date().toISOString(), ...invoice };
      records.push(record);
      writeAll('invoices', records);
      return record;
    },
    update(id, userId, patch) {
      const records = readAll('invoices');
      const idx = records.findIndex((inv) => inv.id === id && inv.user_id === userId);
      if (idx === -1) return null;
      records[idx] = { ...records[idx], ...patch };
      writeAll('invoices', records);
      return records[idx];
    },
    remove(id, userId) {
      const records = readAll('invoices');
      const next = records.filter((inv) => !(inv.id === id && inv.user_id === userId));
      const removed = next.length !== records.length;
      if (removed) writeAll('invoices', next);
      return removed;
    },
  },
  joinRequests: {
    all() {
      return readAll('joinRequests').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    findById(id) {
      return readAll('joinRequests').find((r) => r.id === id);
    },
    findPendingByEmail(email) {
      return readAll('joinRequests').find(
        (r) => r.email.toLowerCase() === String(email).toLowerCase() && r.status === 'pending'
      );
    },
    create(request) {
      const records = readAll('joinRequests');
      const record = {
        id: nextId(records),
        status: 'pending',
        created_at: new Date().toISOString(),
        ...request,
      };
      records.push(record);
      writeAll('joinRequests', records);
      return record;
    },
    update(id, patch) {
      const records = readAll('joinRequests');
      const idx = records.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      records[idx] = { ...records[idx], ...patch };
      writeAll('joinRequests', records);
      return records[idx];
    },
  },
};

module.exports = db;
