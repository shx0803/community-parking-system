const express = require('express');
const router = express.Router();
const { queryAll, queryOne, execute } = require('../database/init');

function checkOwner(req, res, next) {
  if (req.session.user && req.session.user.role === 'owner') next();
  else res.json({ success: false, message: '无权限，请先登录业主账号' });
}

router.post('/apply-parking', checkOwner, (req, res) => {
  const { spot_code, reason } = req.body;
  if (!spot_code) return res.json({ success: false, message: '请选择要申请的车位' });
  
  const existingApp = queryOne("SELECT id FROM parking_applications WHERE owner_id = ? AND status = 'pending'", [req.session.user.id]);
  if (existingApp) return res.json({ success: false, message: '您已有待审核的申请，请等待处理结果' });
  
  const hasAssignment = queryOne("SELECT id FROM parking_assignments WHERE owner_id = ? AND status = 'active'", [req.session.user.id]);
  if (hasAssignment) return res.json({ success: false, message: '您已经拥有一个车位，不可重复申请' });
  
  const spot = queryOne('SELECT * FROM parking_spots WHERE spot_code = ?', [spot_code]);
  if (!spot) return res.json({ success: false, message: '所选车位不存在' });
  if (spot.status !== 'available') return res.json({ success: false, message: '所选车位不可用' });
  
  execute('INSERT INTO parking_applications (owner_id, owner_name, spot_code, reason) VALUES (?, ?, ?, ?)', [req.session.user.id, req.session.user.name, spot_code, reason || '']);
  res.json({ success: true, message: '车位申请已提交，等待审核' });
});

router.get('/my-applications', checkOwner, (req, res) => {
  res.json({ success: true, data: queryAll('SELECT * FROM parking_applications WHERE owner_id = ? ORDER BY created_at DESC', [req.session.user.id]) });
});

router.get('/available-spots', checkOwner, (req, res) => {
  res.json({ success: true, data: queryAll("SELECT * FROM parking_spots WHERE status = 'available' ORDER BY area, spot_code") });
});

router.get('/all-spots', checkOwner, (req, res) => {
  res.json({ success: true, data: queryAll('SELECT * FROM parking_spots ORDER BY area, spot_code') });
});

router.get('/my-assignment', checkOwner, (req, res) => {
  const assignment = queryOne("SELECT pa.*, ps.price, ps.area, ps.floor, ps.remark FROM parking_assignments pa LEFT JOIN parking_spots ps ON pa.spot_id = ps.id WHERE pa.owner_id = ? AND pa.status = 'active'", [req.session.user.id]);
  res.json({ success: true, assignment: assignment || null });
});

module.exports = router;