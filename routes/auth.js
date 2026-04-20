const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { readJSON } = require('../utils/fileHelper');
const { SECRET } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * 登录接口
 * Body: { username, password }
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  const users = readJSON('users.json');
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  // 生成 Token，有效期 24 小时
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    SECRET,
    { expiresIn: '24h' }
  );

  return res.json({
    code: 200,
    message: '登录成功',
    data: {
      token,
      userInfo: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    }
  });
});

/**
 * GET /api/auth/info
 * 获取当前登录用户信息（需要 Token）
 */
const { authMiddleware } = require('../middleware/auth');

router.get('/info', authMiddleware, (req, res) => {
  return res.json({
    code: 200,
    message: '获取成功',
    data: req.user
  });
});

module.exports = router;
