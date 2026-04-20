const express = require('express');
const router = express.Router();
const { readJSON, writeJSON, generateId } = require('../utils/fileHelper');
const { authMiddleware, teacherOrAdmin, adminOnly } = require('../middleware/auth');

const FILE = 'students.json';

/**
 * GET /api/students
 * 获取学生列表，支持分页和关键字搜索
 * Query: page, pageSize, keyword, class
 */
router.get('/', authMiddleware, (req, res) => {
  let list = readJSON(FILE);

  const { keyword, class: className, page, pageSize } = req.query;

  // 关键字过滤（按姓名）
  if (keyword) {
    list = list.filter(s => s.name.includes(keyword));
  }

  // 按班级过滤
  if (className) {
    list = list.filter(s => s.class === className);
  }

  const total = list.length;

  // 分页
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
 * GET /api/students/:id
 * 获取单个学生详情
 */
router.get('/:id', authMiddleware, (req, res) => {
  const list = readJSON(FILE);
  const item = list.find(s => s.id === parseInt(req.params.id));

  if (!item) {
    return res.status(404).json({ code: 404, message: '学生不存在' });
  }

  return res.json({ code: 200, message: '获取成功', data: item });
});

/**
 * POST /api/students
 * 新增学生（teacher 和 admin 可操作）
 * Body: { name, age, gender, class, score }
 */
router.post('/', authMiddleware, teacherOrAdmin, (req, res) => {
  const { name, age, gender, class: className, score } = req.body;

  if (!name || !age || !gender || !className) {
    return res.status(400).json({ code: 400, message: '姓名、年龄、性别、班级为必填项' });
  }

  const list = readJSON(FILE);
  const newItem = {
    id: generateId(list),
    name,
    age: parseInt(age),
    gender,
    class: className,
    score: score !== undefined ? parseFloat(score) : 0
  };

  list.push(newItem);
  writeJSON(FILE, list);

  return res.status(201).json({ code: 201, message: '新增成功', data: newItem });
});

/**
 * PUT /api/students/:id
 * 修改学生信息（teacher 和 admin 可操作）
 * Body: { name, age, gender, class, score }
 */
router.put('/:id', authMiddleware, teacherOrAdmin, (req, res) => {
  const list = readJSON(FILE);
  const index = list.findIndex(s => s.id === parseInt(req.params.id));

  if (index === -1) {
    return res.status(404).json({ code: 404, message: '学生不存在' });
  }

  const { name, age, gender, class: className, score } = req.body;

  list[index] = {
    ...list[index],
    ...(name !== undefined && { name }),
    ...(age !== undefined && { age: parseInt(age) }),
    ...(gender !== undefined && { gender }),
    ...(className !== undefined && { class: className }),
    ...(score !== undefined && { score: parseFloat(score) })
  };

  writeJSON(FILE, list);

  return res.json({ code: 200, message: '修改成功', data: list[index] });
});

/**
 * DELETE /api/students/:id
 * 删除学生（仅 admin 可操作）
 */
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const list = readJSON(FILE);
  const index = list.findIndex(s => s.id === parseInt(req.params.id));

  if (index === -1) {
    return res.status(404).json({ code: 404, message: '学生不存在' });
  }

  const deleted = list.splice(index, 1)[0];
  writeJSON(FILE, list);

  return res.json({ code: 200, message: '删除成功', data: deleted });
});

module.exports = router;
