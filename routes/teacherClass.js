const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// ==================== 老师ID与名字映射 ====================
const teacherNameMap = {
  'teacher': '张老师',
  'teacherLi': '李老师',
  'teacherWang': '王老师'
};

// 获取老师名字
const getTeacherName = (teacherId) => {
  return teacherNameMap[teacherId] || teacherId || '未知教师';
};

// ==================== 班级列表数据 ====================
const mockTeacherClassListData = [
  {
    classId: 1,
    className: 'A级-英语精英班',
    classLevel: 'A',
    currentStudents: 25,
    maxStudents: 30,
    taskCount: 15,
    createTime: '2026-03-01',
    pendingApplicationCount: 2,
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
    pendingApplicationCount: 3,
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
    pendingApplicationCount: 1,
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
    pendingApplicationCount: 2,
    teacherId: 'teacherWang',
    teacherName: '王老师'
  }
];

// 任务类型映射
const taskTypeMap = {
  '1': '单词学习',
  '2': '单词测试',
  '3': '综合练习'
};

// 模拟延迟
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// 获取当前用户名
const getUsername = (req) => {
  return req.user?.username || 'teacher';
};

// 班级列表（内存存储）
let _localClassList = [...mockTeacherClassListData];

// ==================== 待审核班级列表 ====================
let _pendingClassList = [];

/**
 * GET /api/teacher-class/overview
 * 获取班级概览数据
 */
router.get('/overview', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  // 只统计已审核通过的班级
  const teacherClassList = _localClassList.filter(c => c.teacherId === username);
  const totalPending = teacherClassList.reduce((sum, c) => sum + (c.pendingApplicationCount || 0), 0);
  
  return res.json({
    code: 200,
    data: {
      totalClasses: teacherClassList.length,
      avgCompletionRate: 80,
      pendingApplications: totalPending
    }
  });
});

/**
 * GET /api/teacher-class/list
 * 获取班级列表（当前老师）
 */
router.get('/list', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const { classLevel, pageNum = 1, pageSize = 100 } = req.query;
  
  let filteredList = [..._localClassList].filter(c => c.teacherId === username);
  
  // 按等级筛选
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
 * GET /api/teacher-class/all
 * 获取所有班级列表（管理员用）
 */
router.get('/all', authMiddleware, async (req, res) => {
  await delay(300);
  const { classLevel, teacherId, pageNum = 1, pageSize = 100 } = req.query;
  
  let filteredList = [..._localClassList];
  
  // 按等级筛选
  if (classLevel) {
    filteredList = filteredList.filter(c => c.classLevel === classLevel);
  }
  
  // 按老师筛选
  if (teacherId) {
    filteredList = filteredList.filter(c => c.teacherId === teacherId);
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
 * POST /api/teacher-class/create
 * 创建班级（需管理员审核）
 */
router.post('/create', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const { className, classLevel, maxStudents, taskRequirement } = req.body;
  
  if (!className || !classLevel || !maxStudents) {
    return res.json({ code: 400, msg: '缺少必要参数' });
  }
  
  const newClass = {
    classId: Date.now(),
    className,
    classLevel,
    currentStudents: 0,
    maxStudents,
    taskCount: taskRequirement || 0,
    createTime: new Date().toISOString().split('T')[0],
    pendingApplicationCount: 0,
    teacherId: username,
    teacherName: getTeacherName(username),
    status: 'pending',  // pending: 待审核, approved: 已通过, rejected: 已拒绝
    createTimeRaw: new Date().toISOString()
  };
  
  // 班级先进入待审核列表
  _pendingClassList.push(newClass);
  
  return res.json({
    code: 200,
    msg: '班级创建成功，等待管理员审核',
    data: {
      classId: newClass.classId,
      status: 'pending'
    }
  });
});

/**
 * GET /api/teacher-class/pending
 * 获取待审核班级列表（管理员用）
 */
router.get('/pending', authMiddleware, async (req, res) => {
  await delay(300);
  
  return res.json({
    code: 200,
    data: _pendingClassList
  });
});

/**
 * POST /api/teacher-class/approve/:classId
 * 审核通过班级
 */
router.post('/approve/:classId', authMiddleware, async (req, res) => {
  await delay(300);
  const classId = parseInt(req.params.classId);
  const index = _pendingClassList.findIndex(c => c.classId === classId);
  
  if (index === -1) {
    return res.json({ code: 404, msg: '待审核班级不存在' });
  }
  
  const pendingClass = _pendingClassList[index];
  
  // 移出待审核列表，加入正式班级列表
  _pendingClassList.splice(index, 1);
  _localClassList.push(pendingClass);
  
  return res.json({
    code: 200,
    msg: '班级审核通过',
    data: pendingClass
  });
});

/**
 * POST /api/teacher-class/reject/:classId
 * 拒绝班级
 */
router.post('/reject/:classId', authMiddleware, async (req, res) => {
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
 * DELETE /api/teacher-class/delete/:classId
 * 删除班级
 */
router.delete('/delete/:classId', authMiddleware, async (req, res) => {
  await delay(300);
  const classId = parseInt(req.params.classId);
  const index = _localClassList.findIndex(c => c.classId === classId);
  
  if (index > -1) {
    _localClassList.splice(index, 1);
    return res.json({ code: 200, msg: '班级删除成功' });
  }
  
  return res.json({ code: 404, msg: '班级不存在' });
});

/**
 * POST /api/teacher-class/publish-task
 * 发布任务
 */
router.post('/publish-task', authMiddleware, async (req, res) => {
  await delay(500);
  const { classId, taskName, taskType, startTime, deadline, questions } = req.body;
  
  if (!classId || !taskName || !taskType || !startTime || !deadline || !questions) {
    return res.json({ code: 400, msg: '缺少必要参数' });
  }
  
  const taskId = Date.now();
  
  // 验证班级是否存在
  const classInfo = _localClassList.find(c => c.classId === classId);
  if (!classInfo) {
    return res.json({ code: 404, msg: '班级不存在' });
  }
  
  return res.json({
    code: 200,
    msg: '任务发布成功',
    data: {
      taskId
    }
  });
});

module.exports = router;