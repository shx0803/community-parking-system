const express = require('express');
const router = express.Router();
const { queryAll, queryOne, execute } = require('../database/init');

function checkAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') next();
  else res.json({ success: false, message: '无权限，请先登录管理员账号' });
}

router.get('/pending-applications', checkAdmin, (req, res) => {
  const apps = queryAll(`SELECT pa.*, o.name as owner_name, o.building, o.unit FROM parking_applications pa LEFT JOIN owners o ON pa.owner_id = o.id WHERE pa.status = 'pending' ORDER BY pa.created_at DESC`);
  res.json({ success: true, data: apps });
});

router.post('/review-application', checkAdmin, (req, res) => {
  const { appId, action, comment } = req.body;
  const app = queryOne('SELECT * FROM parking_applications WHERE id = ?', [appId]);
  if (!app) return res.json({ success: false, message: '申请不存在' });

  if (action === 'approve') {
    if (!app.spot_code) return res.json({ success: false, message: '申请未指定车位' });
    const spot = queryOne('SELECT * FROM parking_spots WHERE spot_code = ? AND status = "available"', [app.spot_code]);
    if (!spot) return res.json({ success: false, message: '所选车位不可用' });

    execute('INSERT INTO parking_assignments (owner_id, owner_name, spot_id, spot_code, start_date, end_date) VALUES (?, ?, ?, ?, date("now"), date("now", "+1 year"))', [app.owner_id, app.owner_name, spot.id, spot.spot_code]);
    execute("UPDATE parking_spots SET status = 'occupied' WHERE id = ?", [spot.id]);
    execute("UPDATE parking_applications SET status = 'approved', reviewer_id = ?, reviewer_name = ?, review_comment = ?, reviewed_at = datetime('now') WHERE id = ?", [req.session.user.id, req.session.user.name, comment || '', appId]);
    res.json({ success: true, message: '申请已审核通过，车位已分配' });
  } else if (action === 'reject') {
    execute("UPDATE parking_applications SET status = 'rejected', reviewer_id = ?, reviewer_name = ?, review_comment = ?, reviewed_at = datetime('now') WHERE id = ?", [req.session.user.id, req.session.user.name, comment || '', appId]);
    res.json({ success: true, message: '申请已拒绝' });
  } else { res.json({ success: false, message: '无效操作' }); }
});

router.get('/parking-spots', checkAdmin, (req, res) => {
  res.json({ success: true, data: queryAll('SELECT * FROM parking_spots ORDER BY area, spot_code') });
});

router.post('/parking-spots', checkAdmin, (req, res) => {
  const { spot_code, area, floor, price, remark } = req.body;
  if (!spot_code) return res.json({ success: false, message: '车位编号不能为空' });
  if (queryOne('SELECT id FROM parking_spots WHERE spot_code = ?', [spot_code]))
    return res.json({ success: false, message: '车位编号已存在' });
  execute('INSERT INTO parking_spots (spot_code, area, floor, price, remark) VALUES (?, ?, ?, ?, ?)', [spot_code, area || '', floor || '', price || 0, remark || '']);
  res.json({ success: true, message: '车位已添加' });
});

router.put('/parking-spots/:id', checkAdmin, (req, res) => {
  const { spot_code, area, floor, price, remark } = req.body;
  const existing = queryOne('SELECT id FROM parking_spots WHERE spot_code = ? AND id != ?', [spot_code, req.params.id]);
  if (existing) return res.json({ success: false, message: '车位编号已存在' });
  execute('UPDATE parking_spots SET spot_code = ?, area = ?, floor = ?, price = ?, remark = ? WHERE id = ?', [spot_code, area || '', floor || '', price || 0, remark || '', req.params.id]);
  res.json({ success: true, message: '车位信息已更新' });
});

router.delete('/parking-spots/:id', checkAdmin, (req, res) => {
  const spot = queryOne('SELECT * FROM parking_spots WHERE id = ?', [req.params.id]);
  if (spot && spot.status === 'occupied') return res.json({ success: false, message: '该车位已被占用，无法删除' });
  execute('DELETE FROM parking_spots WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: '车位已删除' });
});

router.get('/parking-assignments', checkAdmin, (req, res) => {
  res.json({ success: true, data: queryAll(`SELECT pa.*, o.building, o.unit, o.phone FROM parking_assignments pa LEFT JOIN owners o ON pa.owner_id = o.id ORDER BY pa.created_at DESC`) });
});

router.delete('/parking-assignments/:id', checkAdmin, (req, res) => {
  const assign = queryOne('SELECT * FROM parking_assignments WHERE id = ?', [req.params.id]);
  if (assign) {
    execute("UPDATE parking_spots SET status = 'available' WHERE spot_code = ?", [assign.spot_code]);
  }
  execute('DELETE FROM parking_assignments WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: '车位分配已取消' });
});

router.get('/users', checkAdmin, (req, res) => {
  res.json({ success: true, owners: queryAll('SELECT id, username, name, building, unit, phone, created_at FROM owners'), representatives: queryAll('SELECT id, username, name, department, phone, created_at FROM representatives') });
});

router.delete('/owners/:id', checkAdmin, (req, res) => {
  execute('DELETE FROM parking_assignments WHERE owner_id = ?', [req.params.id]);
  execute('DELETE FROM parking_applications WHERE owner_id = ?', [req.params.id]);
  execute('DELETE FROM owners WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: '业主已删除' });
});

router.delete('/representatives/:id', checkAdmin, (req, res) => {
  execute('DELETE FROM representatives WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: '物业代表已删除' });
});

router.get('/stats', checkAdmin, (req, res) => {
  const pc = queryOne("SELECT COUNT(*) as cnt FROM parking_applications WHERE status='pending'");
  const sc = queryOne('SELECT COUNT(*) as cnt FROM parking_spots');
  const oc = queryOne("SELECT COUNT(*) as cnt FROM parking_spots WHERE status='occupied'");
  const ac = queryOne('SELECT COUNT(*) as cnt FROM parking_assignments');
  const uc = queryOne('SELECT COUNT(*) as cnt FROM owners');
  const rc = queryOne('SELECT COUNT(*) as cnt FROM representatives');
  res.json({ success: true, data: { pendingCount: pc ? pc.cnt : 0, spotCount: sc ? sc.cnt : 0, occupiedCount: oc ? oc.cnt : 0, assignmentCount: ac ? ac.cnt : 0, ownerCount: uc ? uc.cnt : 0, repCount: rc ? rc.cnt : 0 }});
});

module.exports = router;