const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// 模拟延迟
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// 获取当前用户名
const getUsername = (req) => {
  return req.user?.username || 'student';
};

// ==================== 班级状态枚举 ====================
const ClassStatus = {
  NO_CLASS: 0,        // 未入班
  JOINED: 1,          // 已入班
  APPLYING_JOIN: 2,   // 申请入班中
  APPLYING_QUIT: 3,   // 申请退班中
  APPLYING_CHANGE: 4  // 申请换班中
};

// ==================== 所有班级数据 ====================
const mockAllClasses = [
  { id: 1, classId: 1, level: 'A', name: 'A级-英语精英班', teacher: '张教授', teacherName: '张教授', studentCount: 25, memberCount: 25, totalTasks: 20, taskCount: 20 },
  { id: 2, classId: 2, level: 'A', name: 'A级-英语冲刺班', teacher: '刘教授', teacherName: '刘教授', studentCount: 22, memberCount: 22, totalTasks: 18, taskCount: 18 },
  { id: 3, classId: 3, level: 'B', name: 'B级-英语进阶班', teacher: '张老师', teacherName: '张老师', studentCount: 35, memberCount: 35, totalTasks: 15, taskCount: 15 },
  { id: 4, classId: 4, level: 'B', name: 'B级-英语强化班', teacher: '陈老师', teacherName: '陈老师', studentCount: 30, memberCount: 30, totalTasks: 16, taskCount: 16 },
  { id: 5, classId: 5, level: 'C', name: 'C级-英语提高班', teacher: '王老师', teacherName: '王老师', studentCount: 40, memberCount: 40, totalTasks: 12, taskCount: 12 },
  { id: 6, classId: 6, level: 'C', name: 'C级-英语拓展班', teacher: '赵老师', teacherName: '赵老师', studentCount: 38, memberCount: 38, totalTasks: 14, taskCount: 14 },
  { id: 7, classId: 7, level: 'D', name: 'D级-英语基础班', teacher: '李老师', teacherName: '李老师', studentCount: 50, memberCount: 50, totalTasks: 10, taskCount: 10 },
  { id: 8, classId: 8, level: 'D', name: 'D级-英语入门班', teacher: '周老师', teacherName: '周老师', studentCount: 48, memberCount: 48, totalTasks: 8, taskCount: 8 }
];

// ==================== 学生当前班级信息（根据用户区分）====================
const mockCurrentClassData = {
  student: {
    id: 7,
    classId: 7,
    level: 'D',
    name: 'D级-英语基础班',
    teacher: '李老师',
    teacherName: '李老师',
    studentCount: 50,
    memberCount: 50,
    myRank: 5,
    taskCount: 10,
    totalTasks: 10,
    avgCompletionRate: 72,
    classTaskCompletionRate: 72,
    myCompletionRate: 80,
    myTaskCompletionRate: 80,
    completedTasks: 8,
    isFirstJoin: false
  },
  lisi: {
    id: 5,
    classId: 5,
    level: 'C',
    name: 'C级-英语提高班',
    teacher: '王老师',
    teacherName: '王老师',
    studentCount: 40,
    memberCount: 40,
    myRank: 3,
    taskCount: 12,
    totalTasks: 12,
    avgCompletionRate: 78,
    classTaskCompletionRate: 78,
    myCompletionRate: 92,
    myTaskCompletionRate: 92,
    completedTasks: 11,
    isFirstJoin: false
  },
  zhangsan: {
    id: 3,
    classId: 3,
    level: 'B',
    name: 'B级-英语进阶班',
    teacher: '张老师',
    teacherName: '张老师',
    studentCount: 35,
    memberCount: 35,
    myRank: 2,
    taskCount: 15,
    totalTasks: 15,
    avgCompletionRate: 85,
    classTaskCompletionRate: 85,
    myCompletionRate: 100,
    myTaskCompletionRate: 100,
    completedTasks: 15,
    isFirstJoin: false
  }
};

// ==================== 班级排行榜（根据用户区分）====================
const mockClassRankingData = {
  student: [
    { rank: 1, name: '王小明', userId: 101, taskCompletionRate: 100, questionCount: 520, isMe: false },
    { rank: 2, name: '李小红', userId: 102, taskCompletionRate: 98, questionCount: 490, isMe: false },
    { rank: 3, name: '张小刚', userId: 103, taskCompletionRate: 95, questionCount: 475, isMe: false },
    { rank: 4, name: '陈小丽', userId: 104, taskCompletionRate: 88, questionCount: 440, isMe: false },
    { rank: 5, name: '张三', userId: 1, taskCompletionRate: 80, questionCount: 400, isMe: true },
    { rank: 6, name: '赵小华', userId: 105, taskCompletionRate: 75, questionCount: 375, isMe: false },
    { rank: 7, name: '孙小芳', userId: 106, taskCompletionRate: 70, questionCount: 350, isMe: false },
    { rank: 8, name: '周小军', userId: 107, taskCompletionRate: 65, questionCount: 325, isMe: false },
    { rank: 9, name: '吴小敏', userId: 108, taskCompletionRate: 60, questionCount: 300, isMe: false },
    { rank: 10, name: '郑小强', userId: 109, taskCompletionRate: 55, questionCount: 275, isMe: false },
    { rank: 11, name: '冯小刚', userId: 110, taskCompletionRate: 50, questionCount: 250, isMe: false },
    { rank: 12, name: '蒋小丽', userId: 111, taskCompletionRate: 48, questionCount: 240, isMe: false },
    { rank: 13, name: '沈小华', userId: 112, taskCompletionRate: 45, questionCount: 225, isMe: false },
    { rank: 14, name: '韩小军', userId: 113, taskCompletionRate: 42, questionCount: 210, isMe: false },
    { rank: 15, name: '杨小敏', userId: 114, taskCompletionRate: 40, questionCount: 200, isMe: false }
  ],
  lisi: [
    { rank: 1, name: '刘小明', userId: 201, taskCompletionRate: 100, questionCount: 620, isMe: false },
    { rank: 2, name: '赵小红', userId: 202, taskCompletionRate: 98, questionCount: 590, isMe: false },
    { rank: 3, name: '李四', userId: 2, taskCompletionRate: 92, questionCount: 520, isMe: true },
    { rank: 4, name: '周小刚', userId: 203, taskCompletionRate: 88, questionCount: 480, isMe: false },
    { rank: 5, name: '陈小丽', userId: 204, taskCompletionRate: 85, questionCount: 460, isMe: false },
    { rank: 6, name: '孙小华', userId: 205, taskCompletionRate: 80, questionCount: 420, isMe: false },
    { rank: 7, name: '吴小芳', userId: 206, taskCompletionRate: 75, questionCount: 390, isMe: false },
    { rank: 8, name: '郑小军', userId: 207, taskCompletionRate: 70, questionCount: 360, isMe: false }
  ],
  zhangsan: [
    { rank: 1, name: '张三', userId: 3, taskCompletionRate: 100, questionCount: 720, isMe: true },
    { rank: 2, name: '钱小强', userId: 301, taskCompletionRate: 95, questionCount: 680, isMe: false },
    { rank: 3, name: '孙小明', userId: 302, taskCompletionRate: 90, questionCount: 620, isMe: false },
    { rank: 4, name: '李小红', userId: 303, taskCompletionRate: 85, questionCount: 580, isMe: false },
    { rank: 5, name: '周小刚', userId: 304, taskCompletionRate: 80, questionCount: 540, isMe: false },
    { rank: 6, name: '吴小丽', userId: 305, taskCompletionRate: 75, questionCount: 500, isMe: false },
    { rank: 7, name: '郑小华', userId: 306, taskCompletionRate: 70, questionCount: 460, isMe: false }
  ]
};

// ==================== 班级学习趋势数据（近8周）====================
const mockClassTrendData = {
  student: {
    weeks: ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周', '第7周', '第8周'],
    classAvg: [45, 52, 58, 63, 70, 75, 82, 88],
    myData: [50, 58, 65, 72, 80, 88, 95, 102],
    wrongCount: [12, 15, 18, 20, 22, 25, 28, 30]
  },
  lisi: {
    weeks: ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周', '第7周', '第8周'],
    classAvg: [55, 62, 68, 73, 78, 82, 88, 92],
    myData: [60, 70, 78, 85, 92, 98, 105, 112],
    wrongCount: [8, 10, 12, 14, 15, 16, 18, 20]
  },
  zhangsan: {
    weeks: ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周', '第7周', '第8周'],
    classAvg: [65, 72, 78, 82, 86, 90, 93, 95],
    myData: [75, 85, 92, 98, 105, 110, 115, 120],
    wrongCount: [5, 6, 7, 8, 8, 9, 10, 10]
  }
};

// ==================== 班级状态数据（根据用户区分）====================
const mockClassStatusData = {
  student: {
    status: 0,           // 未入班
    isFirstJoin: true,   // 首次入班
    currentClassId: null,
    currentClassName: null,
    pendingApplication: null,
    lastClassLevel: null
  },
  lisi: {
    status: 1,           // 已入班
    isFirstJoin: false,
    currentClassId: 5,
    currentClassName: 'C级-英语提高班',
    pendingApplication: null,
    lastClassLevel: null
  },
  zhangsan: {
    status: 1,           // 已入班
    isFirstJoin: false,
    currentClassId: 3,
    currentClassName: 'B级-英语进阶班',
    pendingApplication: null,
    lastClassLevel: null
  }
};

// ==================== 默认空班级数据（用于未入班用户）====================
const mockEmptyClassData = {
  level: '',
  name: '',
  teacher: '',
  teacherName: '',
  studentCount: 0,
  memberCount: 0,
  myRank: 0,
  taskCount: 0,
  totalTasks: 0,
  avgCompletionRate: 0,
  classTaskCompletionRate: 0,
  myCompletionRate: 0,
  myTaskCompletionRate: 0,
  completedTasks: 0,
  isFirstJoin: true
};

// ==================== 学生入班状态管理（内存存储）====================
let _studentClassStatus = { ...mockClassStatusData };

// 获取学生班级状态
const getStudentClassStatus = (username) => {
  return _studentClassStatus[username] || {
    status: 0,
    isFirstJoin: true,
    currentClassId: null,
    currentClassName: null,
    pendingApplication: null,
    lastClassLevel: null
  };
};

// 保存学生班级状态
const saveStudentClassStatus = (username, status) => {
  _studentClassStatus[username] = status;
};

// ==================== 待审核入班申请列表 ====================
let _pendingJoinApplications = [];

/**
 * GET /api/student-class/status
 * 获取班级状态
 */
router.get('/status', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const status = getStudentClassStatus(username);
  return res.json({ code: 200, data: status });
});

/**
 * GET /api/student-class/list
 * 获取班级列表（支持等级筛选）
 */
router.get('/list', authMiddleware, async (req, res) => {
  await delay(300);
  const { level } = req.query;
  
  let classes = [...mockAllClasses];
  
  // 按等级筛选
  if (level) {
    classes = classes.filter(c => c.level === level);
  }
  
  return res.json({ code: 200, rows: classes, total: classes.length });
});

/**
 * GET /api/student-class/my-class
 * 获取我的班级信息
 */
router.get('/my-class', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const status = getStudentClassStatus(username);
  
  if (status.status === ClassStatus.JOINED && status.currentClassId) {
    // 已入班，返回班级详情
    const classData = mockAllClasses.find(c => c.classId === status.currentClassId);
    if (classData) {
      const userData = mockCurrentClassData[username];
      return res.json({
        code: 200,
        data: {
          classId: classData.classId,
          className: classData.name,
          classLevel: classData.level,
          teacherName: classData.teacherName,
          memberCount: classData.studentCount,
          totalTasks: classData.totalTasks,
          myRank: userData?.myRank || Math.floor(Math.random() * 30) + 1,
          classTaskCompletionRate: userData?.classTaskCompletionRate || Math.floor(Math.random() * 30) + 60,
          myTaskCompletionRate: userData?.myTaskCompletionRate || Math.floor(Math.random() * 40) + 60,
          completedTasks: userData?.completedTasks || Math.floor(classData.totalTasks * 0.8),
          isFirstJoin: status.isFirstJoin
        }
      });
    }
  }
  
  // 未入班，返回空数据
  return res.json({ code: 200, data: mockEmptyClassData });
});

/**
 * GET /api/student-class/ranking
 * 获取班级排行榜
 */
router.get('/ranking', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const data = mockClassRankingData[username] || mockClassRankingData.student;
  return res.json({ code: 200, data: data.slice(0, 15) }); // 返回Top 15
});

/**
 * GET /api/student-class/trend
 * 获取班级学习趋势（近8周）
 */
router.get('/trend', authMiddleware, async (req, res) => {
  await delay(200);
  const username = getUsername(req);
  const data = mockClassTrendData[username] || mockClassTrendData.student;
  return res.json({ code: 200, data });
});

/**
 * POST /api/student-class/apply
 * 申请入班
 */
router.post('/apply', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const { classId } = req.body;
  
  if (!classId) {
    return res.json({ code: 400, msg: '请选择要加入的班级' });
  }
  
  const classData = mockAllClasses.find(c => c.classId === classId);
  if (!classData) {
    return res.json({ code: 404, msg: '班级不存在' });
  }
  
  const currentStatus = getStudentClassStatus(username);
  
  // 检查是否已在班级中
  if (currentStatus.status === ClassStatus.JOINED) {
    return res.json({ code: 400, msg: '您已在班级中，请先退出当前班级' });
  }
  
  // 检查是否有待审核的申请
  if (currentStatus.pendingApplication) {
    return res.json({ code: 400, msg: '您有待审核的入班申请，请等待审核' });
  }
  
  // 检查入班限制
  if (currentStatus.isFirstJoin) {
    // 首次入班只能选D级
    if (classData.level !== 'D') {
      return res.json({ code: 400, msg: '首次入班只能选择D级班级' });
    }
  } else if (currentStatus.lastClassLevel) {
    // 重新入班，只能选同级或更低等级
    const levelOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
    if (levelOrder[classData.level] < levelOrder[currentStatus.lastClassLevel]) {
      return res.json({ code: 400, msg: `您只能选择${currentStatus.lastClassLevel}级或更低等级的班级` });
    }
  }
  
  // 创建入班申请（模拟直接通过）
  const newStatus = {
    status: ClassStatus.JOINED,
    isFirstJoin: currentStatus.isFirstJoin,
    currentClassId: classData.classId,
    currentClassName: classData.name,
    pendingApplication: null,
    lastClassLevel: null
  };
  
  saveStudentClassStatus(username, newStatus);
  
  return res.json({
    code: 200,
    msg: '成功加入班级',
    data: {
      classId: classData.classId,
      className: classData.name
    }
  });
});

/**
 * POST /api/student-class/quit
 * 退出班级
 */
router.post('/quit', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const currentStatus = getStudentClassStatus(username);
  
  if (currentStatus.status !== ClassStatus.JOINED || !currentStatus.currentClassId) {
    return res.json({ code: 400, msg: '您当前不在任何班级中' });
  }
  
  // 获取当前班级等级
  const classData = mockAllClasses.find(c => c.classId === currentStatus.currentClassId);
  const lastLevel = classData ? classData.level : null;
  
  // 更新状态
  const newStatus = {
    status: ClassStatus.NO_CLASS,
    isFirstJoin: false,
    currentClassId: null,
    currentClassName: null,
    pendingApplication: null,
    lastClassLevel: lastLevel
  };
  
  saveStudentClassStatus(username, newStatus);
  
  return res.json({ code: 200, msg: '已成功退出班级' });
});

/**
 * POST /api/student-class/change
 * 申请换班
 */
router.post('/change', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const { classId } = req.body;
  
  if (!classId) {
    return res.json({ code: 400, msg: '请选择要换入的班级' });
  }
  
  const currentStatus = getStudentClassStatus(username);
  
  // 检查是否已在班级中
  if (currentStatus.status !== ClassStatus.JOINED) {
    return res.json({ code: 400, msg: '您当前不在班级中，无法换班' });
  }
  
  // 获取当前班级信息
  const currentClass = mockAllClasses.find(c => c.classId === currentStatus.currentClassId);
  const userData = mockCurrentClassData[username];
  
  // 检查任务完成率是否达到100%
  const completionRate = userData?.myTaskCompletionRate || 0;
  if (completionRate < 100) {
    return res.json({ code: 400, msg: `您当前的任务完成率为${completionRate}%，需要完成100%的班级任务才能申请换班` });
  }
  
  const targetClass = mockAllClasses.find(c => c.classId === classId);
  if (!targetClass) {
    return res.json({ code: 404, msg: '目标班级不存在' });
  }
  
  // 检查换班限制（只能换同级或更低等级）
  const levelOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
  if (currentClass && levelOrder[targetClass.level] < levelOrder[currentClass.level]) {
    return res.json({ code: 400, msg: '只能换到同级或更低等级的班级' });
  }
  
  // 模拟换班成功
  const newStatus = {
    status: ClassStatus.JOINED,
    isFirstJoin: false,
    currentClassId: targetClass.classId,
    currentClassName: targetClass.name,
    pendingApplication: null,
    lastClassLevel: null
  };
  
  saveStudentClassStatus(username, newStatus);
  
  return res.json({
    code: 200,
    msg: '换班成功',
    data: {
      classId: targetClass.classId,
      className: targetClass.name
    }
  });
});

/**
 * GET /api/student-class/check-apply
 * 检查是否可以申请入班
 */
router.get('/check-apply', authMiddleware, async (req, res) => {
  await delay(200);
  const username = getUsername(req);
  const { level } = req.query;
  
  const currentStatus = getStudentClassStatus(username);
  
  let canApply = true;
  let reason = '';
  
  if (currentStatus.status === ClassStatus.JOINED) {
    canApply = false;
    reason = '您已在班级中，请先退出当前班级';
  } else if (currentStatus.pendingApplication) {
    canApply = false;
    reason = '您有待审核的入班申请';
  } else if (currentStatus.isFirstJoin && level !== 'D') {
    canApply = false;
    reason = '首次入班只能选择D级班级';
  } else if (currentStatus.lastClassLevel) {
    const levelOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
    if (levelOrder[level] < levelOrder[currentStatus.lastClassLevel]) {
      canApply = false;
      reason = `您只能选择${currentStatus.lastClassLevel}级或更低等级的班级`;
    }
  }
  
  return res.json({
    code: 200,
    data: {
      canApply,
      reason,
      isFirstJoin: currentStatus.isFirstJoin,
      lastClassLevel: currentStatus.lastClassLevel
    }
  });
});

module.exports = router;
