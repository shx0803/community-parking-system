const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { queryOne, execute, hashPassword } = require('../database/init');

// 角色 -> 用户表（白名单映射，避免表名拼接带来的注入风险）
const ROLE_TABLES = { admin: 'admins', owner: 'owners', representative: 'representatives' };

router.post('/login', (req, res) => {
  const { username, password, role } = req.body;
  const table = ROLE_TABLES[role];
  if (!table) return res.json({ success: false, message: '无效的角色类型' });
  if (!username || !password) return res.json({ success: false, message: '请输入用户名和密码' });

  // 按用户名取出记录，再用 bcrypt 比对密码哈希，数据库中不保存明文
  const user = queryOne(`SELECT * FROM ${table} WHERE username = ?`, [username]);
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.user = { id: user.id, username: user.username, name: user.name, role: role };
    res.json({ success: true, user: req.session.user });
  } else {
    res.json({ success: false, message: '用户名或密码错误' });
  }
});

router.post('/register', (req, res) => {
  const { username, password, name, building, unit, phone } = req.body;
  if (!username || !password) return res.json({ success: false, message: '用户名和密码不能为空' });
  try {
    if (queryOne('SELECT id FROM owners WHERE username = ?', [username]))
      return res.json({ success: false, message: '用户名已存在' });
    execute('INSERT INTO owners (username, password, name, building, unit, phone) VALUES (?, ?, ?, ?, ?, ?)', [username, hashPassword(password), name, building, unit, phone]);
    res.json({ success: true, message: '注册成功，请登录' });
  } catch (err) { res.json({ success: false, message: '注册失败: ' + err.message }); }
});

router.get('/userinfo', (req, res) => {
  if (req.session.user) res.json({ success: true, user: req.session.user });
  else res.json({ success: false, message: '未登录' });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: '已退出' });
});

module.exports = router;
