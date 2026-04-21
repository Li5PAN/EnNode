const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// 模拟延迟
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// 获取当前用户名
const getUsername = (req) => {
  return req.user?.username || 'teacher';
};

// ==================== 班级列表数据 ====================
const mockClassList = [
  { id: 1, name: 'A级-英语精英班', level: 'A' },
  { id: 2, name: 'B级-英语进阶班', level: 'B' },
  { id: 3, name: 'C级-英语提高班', level: 'C' },
  { id: 4, name: 'D级-英语基础班', level: 'D' }
];

// ==================== 任务完成对比数据（按班级ID） ====================
const mockTaskCompletionData = {
  1: {
    taskList: [
      { taskId: 1, taskName: '第三单元单词测试', totalStudents: 25, completedCount: 20, completionRate: 80 },
      { taskId: 2, taskName: '第四单元单词测试', totalStudents: 25, completedCount: 22, completionRate: 88 },
      { taskId: 3, taskName: '基础词汇练习', totalStudents: 25, completedCount: 18, completionRate: 72 },
      { taskId: 4, taskName: '入门测试', totalStudents: 25, completedCount: 25, completionRate: 100 },
      { taskId: 5, taskName: '综合练习', totalStudents: 25, completedCount: 15, completionRate: 60 }
    ],
    summary: { totalTasks: 5, avgCompletionRate: 80, highestRate: 100, lowestRate: 60 }
  },
  2: {
    taskList: [
      { taskId: 1, taskName: '第三单元单词测试', totalStudents: 35, completedCount: 28, completionRate: 80 },
      { taskId: 2, taskName: '第四单元单词测试', totalStudents: 35, completedCount: 30, completionRate: 86 },
      { taskId: 3, taskName: '基础词汇练习', totalStudents: 35, completedCount: 25, completionRate: 71 },
      { taskId: 4, taskName: '综合练习', totalStudents: 35, completedCount: 20, completionRate: 57 }
    ],
    summary: { totalTasks: 4, avgCompletionRate: 73.5, highestRate: 86, lowestRate: 57 }
  },
  3: {
    taskList: [
      { taskId: 1, taskName: '第三单元单词测试', totalStudents: 48, completedCount: 40, completionRate: 83 },
      { taskId: 2, taskName: '基础词汇练习', totalStudents: 48, completedCount: 35, completionRate: 73 },
      { taskId: 3, taskName: '入门测试', totalStudents: 48, completedCount: 45, completionRate: 94 }
    ],
    summary: { totalTasks: 3, avgCompletionRate: 83.3, highestRate: 94, lowestRate: 73 }
  },
  4: {
    taskList: [
      { taskId: 1, taskName: '入门测试', totalStudents: 48, completedCount: 40, completionRate: 83 },
      { taskId: 2, taskName: '基础词汇练习', totalStudents: 48, completedCount: 38, completionRate: 79 }
    ],
    summary: { totalTasks: 2, avgCompletionRate: 81, highestRate: 83, lowestRate: 79 }
  }
};

// ==================== 学生活跃分析数据（按班级ID） ====================
const mockStudentActivityData = {
  1: {
    days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    completedTasks: [45, 52, 38, 61, 55, 72, 68],
    exercises: [32, 41, 28, 45, 38, 58, 52],
    studyDuration: [120, 145, 98, 168, 142, 195, 180],
    summary: { totalCompletedTasks: 391, totalExercises: 294, totalStudyDuration: 1048, avgDailyActive: 22 }
  },
  2: {
    days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    completedTasks: [62, 58, 45, 72, 68, 85, 78],
    exercises: [48, 52, 38, 58, 55, 72, 65],
    studyDuration: [150, 138, 112, 180, 165, 220, 195],
    summary: { totalCompletedTasks: 468, totalExercises: 388, totalStudyDuration: 1160, avgDailyActive: 30 }
  },
  3: {
    days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    completedTasks: [85, 78, 65, 92, 88, 105, 98],
    exercises: [65, 72, 55, 78, 70, 92, 85],
    studyDuration: [180, 165, 140, 210, 195, 250, 225],
    summary: { totalCompletedTasks: 611, totalExercises: 517, totalStudyDuration: 1365, avgDailyActive: 42 }
  },
  4: {
    days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    completedTasks: [72, 68, 58, 82, 78, 95, 88],
    exercises: [55, 62, 48, 68, 60, 82, 75],
    studyDuration: [160, 148, 125, 185, 172, 225, 200],
    summary: { totalCompletedTasks: 541, totalExercises: 450, totalStudyDuration: 1215, avgDailyActive: 40 }
  }
};

// ==================== 错题类型分析数据（按班级ID） ====================
const mockErrorTypeData = {
  1: {
    errorTypes: [
      { type: '选择题', count: 85, percentage: 34.0 },
      { type: '填空题', count: 68, percentage: 27.2 },
      { type: '单词拼写', count: 52, percentage: 20.8 },
      { type: '阅读理解', count: 28, percentage: 11.2 },
      { type: '听力', count: 17, percentage: 6.8 }
    ],
    summary: { totalErrors: 250, mostErrorType: '选择题', mostErrorCount: 85 },
    trend: { weeks: ['第1周', '第2周', '第3周', '第4周'], errorCounts: [72, 68, 62, 48] }
  },
  2: {
    errorTypes: [
      { type: '选择题', count: 105, percentage: 35.0 },
      { type: '填空题', count: 82, percentage: 27.3 },
      { type: '单词拼写', count: 65, percentage: 21.7 },
      { type: '阅读理解', count: 32, percentage: 10.7 },
      { type: '听力', count: 16, percentage: 5.3 }
    ],
    summary: { totalErrors: 300, mostErrorType: '选择题', mostErrorCount: 105 },
    trend: { weeks: ['第1周', '第2周', '第3周', '第4周'], errorCounts: [85, 78, 75, 62] }
  },
  3: {
    errorTypes: [
      { type: '选择题', count: 125, percentage: 35.7 },
      { type: '填空题', count: 98, percentage: 28.0 },
      { type: '单词拼写', count: 78, percentage: 22.3 },
      { type: '阅读理解', count: 32, percentage: 9.1 },
      { type: '听力', count: 17, percentage: 4.9 }
    ],
    summary: { totalErrors: 350, mostErrorType: '选择题', mostErrorCount: 125 },
    trend: { weeks: ['第1周', '第2周', '第3周', '第4周'], errorCounts: [95, 88, 92, 75] }
  },
  4: {
    errorTypes: [
      { type: '选择题', count: 95, percentage: 36.5 },
      { type: '填空题', count: 72, percentage: 27.7 },
      { type: '单词拼写', count: 58, percentage: 22.3 },
      { type: '阅读理解', count: 22, percentage: 8.5 },
      { type: '听力', count: 13, percentage: 5.0 }
    ],
    summary: { totalErrors: 260, mostErrorType: '选择题', mostErrorCount: 95 },
    trend: { weeks: ['第1周', '第2周', '第3周', '第4周'], errorCounts: [78, 72, 65, 45] }
  }
};

/**
 * GET /api/teacher-class-data/class-list
 * 获取班级下拉列表
 */
router.get('/class-list', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({ code: 200, data: mockClassList });
});

/**
 * GET /api/teacher-class-data/task-completion-chart
 * 获取班级任务完成对比图数据
 */
router.get('/task-completion-chart', authMiddleware, async (req, res) => {
  await delay(300);
  const { classId } = req.query;
  
  if (!classId) {
    return res.json({ code: 400, msg: '请选择班级' });
  }
  
  const data = mockTaskCompletionData[classId];
  if (!data) {
    return res.json({ code: 404, msg: '班级不存在' });
  }
  
  return res.json({ code: 200, data });
});

/**
 * GET /api/teacher-class-data/student-activity-chart
 * 获取学生学习活跃分析图数据
 */
router.get('/student-activity-chart', authMiddleware, async (req, res) => {
  await delay(300);
  const { classId } = req.query;
  
  if (!classId) {
    return res.json({ code: 400, msg: '请选择班级' });
  }
  
  const data = mockStudentActivityData[classId];
  if (!data) {
    return res.json({ code: 404, msg: '班级不存在' });
  }
  
  return res.json({ code: 200, data });
});

/**
 * GET /api/teacher-class-data/error-type-chart
 * 获取学生错题类型分析图数据
 */
router.get('/error-type-chart', authMiddleware, async (req, res) => {
  await delay(300);
  const { classId } = req.query;
  
  if (!classId) {
    return res.json({ code: 400, msg: '请选择班级' });
  }
  
  const data = mockErrorTypeData[classId];
  if (!data) {
    return res.json({ code: 404, msg: '班级不存在' });
  }
  
  return res.json({ code: 200, data });
});

module.exports = router;
