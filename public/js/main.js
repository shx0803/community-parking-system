// ==================== 通用工具函数 ====================

// API基础地址
const API_BASE = '/api';

// Toast通知
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// 发送API请求
async function api(path, options = {}) {
  const url = API_BASE + path;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  try {
    const res = await fetch(url, config);
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, message: '网络请求失败' };
  }
}

// 检查登录状态
async function checkLogin() {
  const res = await api('/auth/userinfo');
  return res.success ? res.user : null;
}

// 退出登录
async function logout() {
  await api('/auth/logout', { method: 'POST' });
  window.location.href = '/index.html';
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 创建DOM元素
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') e.className = v;
    else if (k === 'innerHTML') e.innerHTML = v;
    else if (k === 'textContent') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  });
  if (typeof children === 'string') e.textContent = children;
  else if (Array.isArray(children)) children.forEach(c => { if (c) e.appendChild(c); });
  return e;
}

// 根据角色获取显示名称
function getRoleName(role) {
  const map = { admin: '管理员', owner: '业主', representative: '物业代表' };
  return map[role] || role;
}
