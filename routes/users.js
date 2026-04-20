const express = require('express');
const router = express.Router();
const { readJSON, writeJSON, generateId } = require('../utils/fileHelper');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const FILE = 'users.json';

/**
 * GET /api/users
 * 获取用户列表（仅 admin）
 */
router.get('/', authMiddleware, adminOnly, (req, res) => {
  const list = readJSON(FILE);
  // 不返回密码字段
  const safeList = list.map(({ password, ...rest }) => rest);

  return res.json({ code: 200, message: '获取成功', data: { list: safeList, total: safeList.length } });
});

/**
 * GET /api/users/:id
 * 获取单个用户（仅 admin）
 */
router.get('/:id', authMiddleware, adminOnly, (req, res) => {
  const list = readJSON(FILE);
  const item = list.find(u => u.id === parseInt(req.params.id));

  if (!item) {
    return res.status(404).json({ code: 404, message: '用户不存在' });
  }

  const { password, ...safeItem } = item;
  return res.json({ code: 200, message: '获取成功', data: safeItem });
});

/**
 * POST /api/users
 * 新增用户（仅 admin）
 * Body: { username, password, role, name }
 */
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { username, password, role, name } = req.body;

  if (!username || !password || !role || !name) {
    return res.status(400).json({ code: 400, message: '用户名、密码、角色、姓名均为必填项' });
  }

  const validRoles = ['student', 'teacher', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ code: 400, message: `角色必须是 ${validRoles.join('、')} 之一` });
  }

  const list = readJSON(FILE);

  if (list.find(u => u.username === username)) {
    return res.status(409).json({ code: 409, message: '用户名已存在' });
  }

  const newItem = { id: generateId(list), username, password, role, name };
  list.push(newItem);
  writeJSON(FILE, list);

  const { password: _, ...safeItem } = newItem;
  return res.status(201).json({ code: 201, message: '新增成功', data: safeItem });
});

/**
 * PUT /api/users/:id
 * 修改用户（仅 admin）
 * Body: { password, role, name }
 */
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const list = readJSON(FILE);
  const index = list.findIndex(u => u.id === parseInt(req.params.id));

  if (index === -1) {
    return res.status(404).json({ code: 404, message: '用户不存在' });
  }

  const { password, role, name } = req.body;

  if (role) {
    const validRoles = ['student', 'teacher', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ code: 400, message: `角色必须是 ${validRoles.join('、')} 之一` });
    }
  }

  list[index] = {
    ...list[index],
    ...(password !== undefined && { password }),
    ...(role !== undefined && { role }),
    ...(name !== undefined && { name })
  };

  writeJSON(FILE, list);

  const { password: _, ...safeItem } = list[index];
  return res.json({ code: 200, message: '修改成功', data: safeItem });
});

/**
 * DELETE /api/users/:id
 * 删除用户（仅 admin）
 */
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const list = readJSON(FILE);
  const index = list.findIndex(u => u.id === parseInt(req.params.id));

  if (index === -1) {
    return res.status(404).json({ code: 404, message: '用户不存在' });
  }

  const deleted = list.splice(index, 1)[0];
  writeJSON(FILE, list);

  const { password, ...safeItem } = deleted;
  return res.json({ code: 200, message: '删除成功', data: safeItem });
});

module.exports = router;
