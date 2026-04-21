const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// ==================== 数据概览 ====================
const mockOverviewData = {
  totalUsers: 1250,
  totalStudents: 980,
  totalTeachers: 45,
  totalClasses: 68,
  activeToday: 356,
  pendingApplications: 12,
  monthNewStudents: 85,
  monthNewTeachers: 5,
  monthNewClasses: 8
};

// ==================== 各等级班级分布 ====================
const mockLevelDistributionData = [
  { level: 'A级', classCount: 12, studentCount: 320, percentage: 18 },
  { level: 'B级', classCount: 18, studentCount: 480, percentage: 27 },
  { level: 'C级', classCount: 22, studentCount: 550, percentage: 31 },
  { level: 'D级', classCount: 16, studentCount: 380, percentage: 24 }
];

// ==================== 用户增长趋势（近7天）====================
const mockUserGrowthTrendData = [
  { date: '2026-04-14', newStudents: 12, newTeachers: 1, newUsers: 13 },
  { date: '2026-04-15', newStudents: 18, newTeachers: 2, newUsers: 20 },
  { date: '2026-04-16', newStudents: 15, newTeachers: 0, newUsers: 15 },
  { date: '2026-04-17', newStudents: 22, newTeachers: 1, newUsers: 23 },
  { date: '2026-04-18', newStudents: 20, newTeachers: 2, newUsers: 22 },
  { date: '2026-04-19', newStudents: 25, newTeachers: 1, newUsers: 26 },
  { date: '2026-04-20', newStudents: 30, newTeachers: 2, newUsers: 32 }
];

// ==================== 换班变化趋势（近7天）====================
const mockClassChangeTrendData = [
  { date: '2026-04-14', transferOut: 3, transferIn: 2 },
  { date: '2026-04-15', transferOut: 5, transferIn: 4 },
  { date: '2026-04-16', transferOut: 2, transferIn: 3 },
  { date: '2026-04-17', transferOut: 8, transferIn: 6 },
  { date: '2026-04-18', transferOut: 4, transferIn: 5 },
  { date: '2026-04-19', transferOut: 6, transferIn: 7 },
  { date: '2026-04-20', transferOut: 10, transferIn: 8 }
];

// ==================== 退班变化趋势（近7天）====================
const mockDropClassTrendData = [
  { date: '2026-04-14', dropCount: 2 },
  { date: '2026-04-15', dropCount: 5 },
  { date: '2026-04-16', dropCount: 1 },
  { date: '2026-04-17', dropCount: 4 },
  { date: '2026-04-18', dropCount: 3 },
  { date: '2026-04-19', dropCount: 6 },
  { date: '2026-04-20', dropCount: 8 }
];

// ==================== 班级创建趋势（近7天）====================
const mockClassCreateTrendData = [
  { date: '2026-04-14', classCount: 1 },
  { date: '2026-04-15', classCount: 3 },
  { date: '2026-04-16', classCount: 2 },
  { date: '2026-04-17', classCount: 4 },
  { date: '2026-04-18', classCount: 2 },
  { date: '2026-04-19', classCount: 5 },
  { date: '2026-04-20', classCount: 6 }
];

// ==================== 待审核班级列表（管理员用）====================
let _pendingClassList = [
  {
    classId: 101,
    className: 'A级-英语强化班',
    classLevel: 'A',
    maxStudents: 30,
    taskCount: 15,
    createTime: '2026-04-18',
    teacherId: 'teacher',
    teacherName: '张老师'
  },
  {
    classId: 102,
    className: 'B级-英语冲刺班',
    classLevel: 'B',
    maxStudents: 35,
    taskCount: 12,
    createTime: '2026-04-19',
    teacherId: 'teacherLi',
    teacherName: '李老师'
  },
  {
    classId: 103,
    className: 'C级-英语基础班',
    classLevel: 'C',
    maxStudents: 40,
    taskCount: 10,
    createTime: '2026-04-20',
    teacherId: 'teacherWang',
    teacherName: '王老师'
  }
];

// ==================== 已通过班级列表（管理员用）====================
let _approvedClassList = [
  {
    classId: 1,
    className: 'A级-英语精英班',
    classLevel: 'A',
    currentStudents: 25,
    maxStudents: 30,
    taskCount: 15,
    createTime: '2026-03-01',
    teacherId: 'teacher',
    teacherName: '张老师'
  },
  {
    classId: 2,
    className: 'B级-英语进阶班',
    classLevel: 'B',
    currentStudents: 35,
    maxStudents: 40,
    taskCount: 12,
    createTime: '2026-03-05',
    teacherId: 'teacher',
    teacherName: '张老师'
  },
  {
    classId: 3,
    className: 'C级-英语提高班',
    classLevel: 'C',
    currentStudents: 48,
    maxStudents: 50,
    taskCount: 10,
    createTime: '2026-02-20',
    teacherId: 'teacherLi',
    teacherName: '李老师'
  },
  {
    classId: 4,
    className: 'D级-英语基础班',
    classLevel: 'D',
    currentStudents: 48,
    maxStudents: 50,
    taskCount: 8,
    createTime: '2026-02-15',
    teacherId: 'teacherWang',
    teacherName: '王老师'
  }
];

// 模拟延迟
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * GET /api/admin-home/overview
 * 获取数据概览
 */
router.get('/overview', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({
    code: 200,
    data: mockOverviewData
  });
});

/**
 * GET /api/admin-home/level-distribution
 * 获取各等级班级分布
 */
router.get('/level-distribution', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({
    code: 200,
    data: mockLevelDistributionData
  });
});

/**
 * GET /api/admin-home/user-growth-trend
 * 获取用户增长趋势
 */
router.get('/user-growth-trend', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({
    code: 200,
    data: mockUserGrowthTrendData
  });
});

/**
 * GET /api/admin-home/class-change-trend
 * 获取换班变化趋势
 */
router.get('/class-change-trend', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({
    code: 200,
    data: mockClassChangeTrendData
  });
});

/**
 * GET /api/admin-home/drop-class-trend
 * 获取退班变化趋势
 */
router.get('/drop-class-trend', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({
    code: 200,
    data: mockDropClassTrendData
  });
});

/**
 * GET /api/admin-home/class-create-trend
 * 获取班级创建趋势
 */
router.get('/class-create-trend', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({
    code: 200,
    data: mockClassCreateTrendData
  });
});

// ==================== 班级审核相关接口 ====================

/**
 * GET /api/admin-home/class-review/list
 * 获取待审核班级列表（支持按老师名字搜索）
 */
router.get('/class-review/list', authMiddleware, async (req, res) => {
  await delay(300);
  const { teacherName, pageNum = 1, pageSize = 10 } = req.query;
  
  let filteredList = [..._pendingClassList];
  
  // 按老师名字搜索（模糊匹配）
  if (teacherName) {
    filteredList = filteredList.filter(c => 
      c.teacherName && c.teacherName.toLowerCase().includes(teacherName.toLowerCase())
    );
  }
  
  // 分页
  const start = (parseInt(pageNum) - 1) * parseInt(pageSize);
  const end = start + parseInt(pageSize);
  
  return res.json({
    code: 200,
    rows: filteredList.slice(start, end),
    total: filteredList.length
  });
});

/**
 * GET /api/admin-home/class-review/management-list
 * 获取已通过班级列表（支持按老师名字搜索）
 */
router.get('/class-review/management-list', authMiddleware, async (req, res) => {
  await delay(300);
  const { teacherName, classLevel, pageNum = 1, pageSize = 10 } = req.query;
  
  let filteredList = [..._approvedClassList];
  
  // 按老师名字搜索（模糊匹配）
  if (teacherName) {
    filteredList = filteredList.filter(c => 
      c.teacherName && c.teacherName.toLowerCase().includes(teacherName.toLowerCase())
    );
  }
  
  // 按班级等级筛选
  if (classLevel) {
    filteredList = filteredList.filter(c => c.classLevel === classLevel);
  }
  
  // 分页
  const start = (parseInt(pageNum) - 1) * parseInt(pageSize);
  const end = start + parseInt(pageSize);
  
  return res.json({
    code: 200,
    rows: filteredList.slice(start, end),
    total: filteredList.length
  });
});

/**
 * POST /api/admin-home/class-review/approve/:classId
 * 审核通过班级
 */
router.post('/class-review/approve/:classId', authMiddleware, async (req, res) => {
  await delay(300);
  const classId = parseInt(req.params.classId);
  const index = _pendingClassList.findIndex(c => c.classId === classId);
  
  if (index === -1) {
    return res.json({ code: 404, msg: '待审核班级不存在' });
  }
  
  const pendingClass = _pendingClassList[index];
  
  // 移出待审核列表，加入已通过列表
  _pendingClassList.splice(index, 1);
  _approvedClassList.push(pendingClass);
  
  return res.json({
    code: 200,
    msg: '班级审核通过',
    data: pendingClass
  });
});

/**
 * POST /api/admin-home/class-review/reject/:classId
 * 拒绝班级
 */
router.post('/class-review/reject/:classId', authMiddleware, async (req, res) => {
  await delay(300);
  const classId = parseInt(req.params.classId);
  const index = _pendingClassList.findIndex(c => c.classId === classId);
  
  if (index === -1) {
    return res.json({ code: 404, msg: '待审核班级不存在' });
  }
  
  const rejectedClass = _pendingClassList[index];
  
  // 移出待审核列表
  _pendingClassList.splice(index, 1);
  
  return res.json({
    code: 200,
    msg: '班级已拒绝',
    data: rejectedClass
  });
});

/**
 * DELETE /api/admin-home/class-review/delete/:classId
 * 删除班级
 */
router.delete('/class-review/delete/:classId', authMiddleware, async (req, res) => {
  await delay(300);
  const classId = parseInt(req.params.classId);
  const index = _approvedClassList.findIndex(c => c.classId === classId);
  
  if (index === -1) {
    return res.json({ code: 404, msg: '班级不存在' });
  }
  
  _approvedClassList.splice(index, 1);
  
  return res.json({
    code: 200,
    msg: '班级删除成功'
  });
});

// ==================== 人员管理相关接口 ====================

// 人员列表数据
let _userList = [
  {
    userId: 1,
    userName: 'zhangsan',
    nickName: '张三',
    roleType: 'student',
    role: 'student',
    className: '计算机1班',
    classLevel: 'A',
    email: 'zhangsan@example.com',
    phonenumber: '13800138001',
    createTime: '2026-01-15 10:30:00'
  },
  {
    userId: 2,
    userName: 'lisi',
    nickName: '李四',
    roleType: 'student',
    role: 'student',
    className: '计算机2班',
    classLevel: 'B',
    email: 'lisi@example.com',
    phonenumber: '13800138002',
    createTime: '2026-01-16 14:20:00'
  },
  {
    userId: 3,
    userName: 'wangwu',
    nickName: '王五',
    roleType: 'student',
    role: 'student',
    className: null,
    classLevel: null,
    email: 'wangwu@example.com',
    phonenumber: '13800138003',
    createTime: '2026-02-01 09:15:00'
  },
  {
    userId: 4,
    userName: 'teacher',
    nickName: '张老师',
    roleType: 'teacher',
    role: 'teacher',
    className: null,
    classLevel: null,
    email: 'teacher@example.com',
    phonenumber: '13900139001',
    createTime: '2025-12-01 08:00:00'
  },
  {
    userId: 5,
    userName: 'teacherLi',
    nickName: '李老师',
    roleType: 'teacher',
    role: 'teacher',
    className: null,
    classLevel: null,
    email: 'teacherLi@example.com',
    phonenumber: '13900139002',
    createTime: '2025-12-05 10:30:00'
  },
  {
    userId: 6,
    userName: 'teacherWang',
    nickName: '王老师',
    roleType: 'teacher',
    role: 'teacher',
    className: null,
    classLevel: null,
    email: 'teacherWang@example.com',
    phonenumber: '13900139003',
    createTime: '2025-12-10 15:45:00'
  },
  {
    userId: 7,
    userName: 'zhaoliu',
    nickName: '赵六',
    roleType: 'student',
    role: 'student',
    className: '计算机1班',
    classLevel: 'A',
    email: 'zhaoliu@example.com',
    phonenumber: '13800138004',
    createTime: '2026-02-10 11:20:00'
  },
  {
    userId: 8,
    userName: 'sunqi',
    nickName: '孙七',
    roleType: 'student',
    role: 'student',
    className: '计算机3班',
    classLevel: 'C',
    email: 'sunqi@example.com',
    phonenumber: '13800138005',
    createTime: '2026-02-15 16:00:00'
  }
];

/**
 * GET /api/admin-home/user/list
 * 获取人员列表（支持身份筛选、搜索）
 */
router.get('/user/list', authMiddleware, async (req, res) => {
  await delay(300);
  const { role, keyword, pageNum = 1, pageSize = 10 } = req.query;
  
  let filteredList = [..._userList];
  
  // 按身份筛选
  if (role) {
    filteredList = filteredList.filter(u => u.role === role);
  }
  
  // 按关键字搜索（姓名、账号）
  if (keyword) {
    const kw = keyword.toLowerCase();
    filteredList = filteredList.filter(u => 
      (u.nickName && u.nickName.toLowerCase().includes(kw)) ||
      (u.userName && u.userName.toLowerCase().includes(kw))
    );
  }
  
  // 分页
  const start = (parseInt(pageNum) - 1) * parseInt(pageSize);
  const end = start + parseInt(pageSize);
  
  return res.json({
    code: 200,
    rows: filteredList.slice(start, end),
    total: filteredList.length
  });
});

/**
 * GET /api/admin-home/user/:userId
 * 获取人员详情
 */
router.get('/user/:userId', authMiddleware, async (req, res) => {
  await delay(300);
  const userId = parseInt(req.params.userId);
  const user = _userList.find(u => u.userId === userId);
  
  if (!user) {
    return res.json({ code: 404, msg: '用户不存在' });
  }
  
  return res.json({
    code: 200,
    data: user
  });
});

/**
 * DELETE /api/admin-home/user/:userId
 * 删除人员
 */
router.delete('/user/:userId', authMiddleware, async (req, res) => {
  await delay(300);
  const userId = parseInt(req.params.userId);
  const index = _userList.findIndex(u => u.userId === userId);
  
  if (index === -1) {
    return res.json({ code: 404, msg: '用户不存在' });
  }
  
  _userList.splice(index, 1);
  
  return res.json({
    code: 200,
    msg: '删除成功'
  });
});

module.exports = router;