const express = require('express');
const router = express.Router();
const { queryAll, queryOne, execute } = require('../database/init');

function checkRep(req, res, next) {
  if (req.session.user && req.session.user.role === 'representative') next();
  else res.json({ success: false, message: '无权限，请先登录物业代表账号' });
}

router.get('/pending-applications', checkRep, (req, res) => {
  const apps = queryAll(`SELECT pa.*, o.name as owner_name, o.building, o.unit FROM parking_applications pa LEFT JOIN owners o ON pa.owner_id = o.id WHERE pa.status = 'pending' ORDER BY pa.created_at DESC`);
  res.json({ success: true, data: apps });
});

router.post('/review-application', checkRep, (req, res) => {
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

router.get('/parking-spots', checkRep, (req, res) => {
  res.json({ success: true, data: queryAll('SELECT * FROM parking_spots ORDER BY area, spot_code') });
});

router.get('/parking-assignments', checkRep, (req, res) => {
  res.json({ success: true, data: queryAll(`SELECT pa.*, o.building, o.unit, o.phone FROM parking_assignments pa LEFT JOIN owners o ON pa.owner_id = o.id ORDER BY pa.created_at DESC`) });
});

router.get('/my-reviews', checkRep, (req, res) => {
  res.json({ success: true, data: queryAll('SELECT * FROM parking_applications WHERE reviewer_id = ? ORDER BY reviewed_at DESC', [req.session.user.id]) });
});

module.exports = router;