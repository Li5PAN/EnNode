const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// ==================== 教师仪表盘数据（根据用户区分）====================
const mockTeacherDashboardData = {
  teacher: {
    totalStudents: 45,
    totalClasses: 2,
    pendingApplications: 0,
    pendingTasks: 0
  },
  teacherLi: {
    totalStudents: 25,
    totalClasses: 1,
    pendingApplications: 0,
    pendingTasks: 0
  },
  teacherWang: {
    totalStudents: 20,
    totalClasses: 1,
    pendingApplications: 0,
    pendingTasks: 0
  }
};

// ==================== 班级等级分布数据 ====================
const mockLevelDistributionData = [
  { classLevel: 'A', classCount: 1 },
  { classLevel: 'B', classCount: 1 },
  { classLevel: 'C', classCount: 1 },
  { classLevel: 'D', classCount: 1 }
];

// ==================== 各班级任务完成率数据 ====================
const mockTaskCompletionData = {
  classNames: ['A级-英语精英班', 'B级-英语进阶班', 'C级-英语提高班', 'D级-英语基础班'],
  completionRates: [85, 78, 92, 65]
};

// ==================== 学生活跃度趋势数据 ====================
const mockActivityTrendData = {
  days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  completedTasks: [220, 182, 191, 234, 290, 330, 310],
  exercises: [150, 232, 201, 154, 190, 330, 410]
};

// ==================== 错题类型分布数据 ====================
const mockErrorTypeDistributionData = [
  { type: '选择题', count: 335 },
  { type: '填空题', count: 234 },
  { type: '单词拼写', count: 148 }
];

// 模拟延迟
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// 获取当前用户名
const getUsername = (req) => {
  return req.user?.username || 'teacher';
};

/**
 * GET /api/teacher-home/dashboard
 * 获取教师仪表盘数据（顶部概览）
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const dashboard = mockTeacherDashboardData[username] || mockTeacherDashboardData.teacher;
  return res.json({ code: 200, data: dashboard });
});

/**
 * GET /api/teacher-home/level-distribution
 * 获取班级等级分布
 */
router.get('/level-distribution', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({ code: 200, data: mockLevelDistributionData });
});

/**
 * GET /api/teacher-home/task-completion
 * 获取各班级任务完成率对比
 */
router.get('/task-completion', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({ code: 200, data: mockTaskCompletionData });
});

/**
 * GET /api/teacher-home/activity-trend
 * 获取学生活跃度趋势（最近7天）
 */
router.get('/activity-trend', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({ code: 200, data: mockActivityTrendData });
});

/**
 * GET /api/teacher-home/error-type-distribution
 * 获取错题类型分布
 */
router.get('/error-type-distribution', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({ code: 200, data: mockErrorTypeDistributionData });
});

module.exports = router;