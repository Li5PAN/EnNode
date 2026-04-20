const express = require('express');
const router = express.Router();
const { readJSON, writeJSON, generateId } = require('../utils/fileHelper');
const { authMiddleware, teacherOrAdmin, adminOnly } = require('../middleware/auth');

const FILE = 'courses.json';

/**
 * GET /api/courses
 * 获取课程列表，支持分页和关键字搜索
 * Query: page, pageSize, keyword
 */
router.get('/', authMiddleware, (req, res) => {
  let list = readJSON(FILE);

  const { keyword, page, pageSize } = req.query;

  if (keyword) {
    list = list.filter(c => c.name.includes(keyword) || c.teacher.includes(keyword));
  }

  const total = list.length;

  if (page && pageSize) {
    const p = parseInt(page);
    const ps = parseInt(pageSize);
    list = list.slice((p - 1) * ps, p * ps);
  }

  return res.json({
    code: 200,
    message: '获取成功',
    data: { list, total }
  });
});

/**
 * GET /api/courses/:id
 * 获取单个课程详情
 */
router.get('/:id', authMiddleware, (req, res) => {
  const list = readJSON(FILE);
  const item = list.find(c => c.id === parseInt(req.params.id));

  if (!item) {
    return res.status(404).json({ code: 404, message: '课程不存在' });
  }

  return res.json({ code: 200, message: '获取成功', data: item });
});

/**
 * POST /api/courses
 * 新增课程（teacher 和 admin 可操作）
 * Body: { name, teacher, credit, hours }
 */
router.post('/', authMiddleware, teacherOrAdmin, (req, res) => {
  const { name, teacher, credit, hours } = req.body;

  if (!name || !teacher) {
    return res.status(400).json({ code: 400, message: '课程名称和教师为必填项' });
  }

  const list = readJSON(FILE);
  const newItem = {
    id: generateId(list),
    name,
    teacher,
    credit: credit !== undefined ? parseInt(credit) : 0,
    hours: hours !== undefined ? parseInt(hours) : 0
  };

  list.push(newItem);
  writeJSON(FILE, list);

  return res.status(201).json({ code: 201, message: '新增成功', data: newItem });
});

/**
 * PUT /api/courses/:id
 * 修改课程（teacher 和 admin 可操作）
 * Body: { name, teacher, credit, hours }
 */
router.put('/:id', authMiddleware, teacherOrAdmin, (req, res) => {
  const list = readJSON(FILE);
  const index = list.findIndex(c => c.id === parseInt(req.params.id));

  if (index === -1) {
    return res.status(404).json({ code: 404, message: '课程不存在' });
  }

  const { name, teacher, credit, hours } = req.body;

  list[index] = {
    ...list[index],
    ...(name !== undefined && { name }),
    ...(teacher !== undefined && { teacher }),
    ...(credit !== undefined && { credit: parseInt(credit) }),
    ...(hours !== undefined && { hours: parseInt(hours) })
  };

  writeJSON(FILE, list);

  return res.json({ code: 200, message: '修改成功', data: list[index] });
});

/**
 * DELETE /api/courses/:id
 * 删除课程（仅 admin 可操作）
 */
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const list = readJSON(FILE);
  const index = list.findIndex(c => c.id === parseInt(req.params.id));

  if (index === -1) {
    return res.status(404).json({ code: 404, message: '课程不存在' });
  }

  const deleted = list.splice(index, 1)[0];
  writeJSON(FILE, list);

  return res.json({ code: 200, message: '删除成功', data: deleted });
});

module.exports = router;
