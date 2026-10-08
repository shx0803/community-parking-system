const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { initDatabase } = require('./database/init');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const ownerRoutes = require('./routes/owner');
const representativeRoutes = require('./routes/representative');

const app = express();
const PORT = 3000;

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session配置（密钥优先从环境变量读取，避免敏感配置硬编码进代码库）
app.use(session({
  secret: process.env.SESSION_SECRET || 'community-forum-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2小时
}));

// 初始化数据库
initDatabase();

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/representative', representativeRoutes);

// 主页跳转
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`小区论坛管理系统运行在 http://localhost:${PORT}`);
});
