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

module.exports = router;