const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'community_forum.db');
const SALT_ROUNDS = 10;

let db = null;

// 密码加密存储：入库前统一哈希，禁止明文落库
function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

// 判断是否已是 bcrypt 哈希（$2a$ / $2b$ / $2y$ 开头）
function isHashed(password) {
  return typeof password === 'string' && /^\$2[aby]\$/.test(password);
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

function getDatabase() {
  if (!db) throw new Error('数据库未初始化，请先调用 initDatabase()');
  return db;
}

function queryAll(sql, params = []) {
  const stmt = getDatabase().prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function execute(sql, params = []) {
  getDatabase().run(sql, params);
  saveDatabase();
}

// 兼容历史数据：把早期版本遗留的明文密码升级为 bcrypt 哈希（幂等，仅对未哈希的生效）
function migratePlaintextPasswords() {
  let migrated = 0;
  ['admins', 'owners', 'representatives'].forEach(table => {
    queryAll(`SELECT id, password FROM ${table}`).forEach(row => {
      if (row.password && !isHashed(row.password)) {
        execute(`UPDATE ${table} SET password = ? WHERE id = ?`, [hashPassword(row.password), row.id]);
        migrated++;
      }
    });
  });
  if (migrated > 0) console.log(`已将 ${migrated} 条历史明文密码升级为 bcrypt 哈希.`);
}

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
    console.log('从文件加载已有数据库.');
  } else {
    db = new SQL.Database();
    console.log('创建新数据库.');
  }

  // 建表
  db.run(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS owners (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, building TEXT, unit TEXT, phone TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS representatives (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, department TEXT, phone TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS parking_spots (id INTEGER PRIMARY KEY AUTOINCREMENT, spot_code TEXT UNIQUE NOT NULL, area TEXT, floor TEXT, status TEXT DEFAULT 'available', price DECIMAL(10,2), remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS parking_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, owner_name TEXT, spot_code TEXT, reason TEXT, status TEXT DEFAULT 'pending', reviewer_id INTEGER, reviewer_name TEXT, review_comment TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, reviewed_at DATETIME)`);
  db.run(`CREATE TABLE IF NOT EXISTS parking_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, owner_name TEXT, spot_id INTEGER NOT NULL, spot_code TEXT, start_date DATE, end_date DATE, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  saveDatabase();

  // 历史明文密码升级为哈希
  migratePlaintextPasswords();

  // 默认管理员
  const adminRow = queryOne('SELECT COUNT(*) as cnt FROM admins WHERE username = ?', ['admin']);
  if (!adminRow || adminRow.cnt === 0) {
    execute('INSERT INTO admins (username, password, name, email) VALUES (?, ?, ?, ?)', ['admin', hashPassword('admin123'), '系统管理员', 'admin@community.com']);
    console.log('默认管理员账号已创建: admin / admin123');
  }

  // 默认物业代表
  const repRow = queryOne('SELECT COUNT(*) as cnt FROM representatives WHERE username = ?', ['rep001']);
  if (!repRow || repRow.cnt === 0) {
    execute('INSERT INTO representatives (username, password, name, department, phone) VALUES (?, ?, ?, ?, ?)', ['rep001', hashPassword('rep123'), '张代表', '物业管理部', '13800138001']);
    execute('INSERT INTO representatives (username, password, name, department, phone) VALUES (?, ?, ?, ?, ?)', ['rep002', hashPassword('rep123'), '李代表', '工程维修部', '13800138002']);
    console.log('默认物业代表账号已创建: rep001/rep123, rep002/rep123');
  }

  // 默认业主
  const ownerRow = queryOne('SELECT COUNT(*) as cnt FROM owners WHERE username = ?', ['owner001']);
  if (!ownerRow || ownerRow.cnt === 0) {
    execute('INSERT INTO owners (username, password, name, building, unit, phone) VALUES (?, ?, ?, ?, ?, ?)', ['owner001', hashPassword('owner123'), '王业主', '1栋', '1单元101', '13900139001']);
    execute('INSERT INTO owners (username, password, name, building, unit, phone) VALUES (?, ?, ?, ?, ?, ?)', ['owner002', hashPassword('owner123'), '刘业主', '2栋', '2单元202', '13900139002']);
    console.log('默认业主账号已创建: owner001/owner123, owner002/owner123');
  }

  // 默认车位
  const spotRow = queryOne('SELECT COUNT(*) as cnt FROM parking_spots WHERE spot_code = ?', ['A001']);
  if (!spotRow || spotRow.cnt === 0) {
    execute('INSERT INTO parking_spots (spot_code, area, floor, status, price, remark) VALUES (?, ?, ?, ?, ?, ?)', ['A001', 'A区', '地下一层', 'available', 300.00, '靠近电梯口']);
    execute('INSERT INTO parking_spots (spot_code, area, floor, status, price, remark) VALUES (?, ?, ?, ?, ?, ?)', ['A002', 'A区', '地下一层', 'available', 300.00, '靠近电梯口']);
    execute('INSERT INTO parking_spots (spot_code, area, floor, status, price, remark) VALUES (?, ?, ?, ?, ?, ?)', ['A003', 'A区', '地下一层', 'available', 300.00, '普通车位']);
    execute('INSERT INTO parking_spots (spot_code, area, floor, status, price, remark) VALUES (?, ?, ?, ?, ?, ?)', ['B001', 'B区', '地下一层', 'available', 280.00, '普通车位']);
    execute('INSERT INTO parking_spots (spot_code, area, floor, status, price, remark) VALUES (?, ?, ?, ?, ?, ?)', ['B002', 'B区', '地下一层', 'available', 280.00, '普通车位']);
    execute('INSERT INTO parking_spots (spot_code, area, floor, status, price, remark) VALUES (?, ?, ?, ?, ?, ?)', ['B003', 'B区', '地下一层', 'available', 280.00, '靠近出口']);
    execute('INSERT INTO parking_spots (spot_code, area, floor, status, price, remark) VALUES (?, ?, ?, ?, ?, ?)', ['C001', 'C区', '地下二层', 'available', 260.00, '普通车位']);
    execute('INSERT INTO parking_spots (spot_code, area, floor, status, price, remark) VALUES (?, ?, ?, ?, ?, ?)', ['C002', 'C区', '地下二层', 'available', 260.00, '普通车位']);
    execute('INSERT INTO parking_spots (spot_code, area, floor, status, price, remark) VALUES (?, ?, ?, ?, ?, ?)', ['C003', 'C区', '地下二层', 'available', 260.00, '普通车位']);
    execute('INSERT INTO parking_spots (spot_code, area, floor, status, price, remark) VALUES (?, ?, ?, ?, ?, ?)', ['D001', 'D区', '地下二层', 'available', 260.00, '无障碍车位']);
    console.log('默认车位已创建: A001-A003, B001-B003, C001-C003, D001');
  }

  console.log('数据库初始化完成.');
}

module.exports = { initDatabase, getDatabase, queryAll, queryOne, execute, saveDatabase, hashPassword };
