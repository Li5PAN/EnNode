const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// 模拟延迟
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// 获取当前用户名
const getUsername = (req) => {
  return req.user?.username || 'student';
};

// ==================== 顶部统计数据（根据用户区分）====================
const mockStatisticsData = {
  student: {
    totalWords: 256,        // 累计查词量
    completedTasks: 8,      // 任务完成数
    totalErrors: 15         // 总错题数
  },
  lisi: {
    totalWords: 320,
    completedTasks: 12,
    totalErrors: 8
  },
  zhangsan: {
    totalWords: 450,
    completedTasks: 18,
    totalErrors: 5
  }
};

// ==================== 每日学习数据（近7天）====================
const mockDailyStudyData = {
  student: {
    dates: ['04-15', '04-16', '04-17', '04-18', '04-19', '04-20', '04-21'],
    wordCounts: [12, 18, 15, 22, 16, 20, 14],      // 每日查词量
    taskCounts: [2, 3, 2, 4, 3, 2, 3],             // 每日完成任务数
    errorCounts: [3, 2, 4, 2, 3, 1, 2],            // 每日错题数
    studyMinutes: [45, 60, 50, 75, 55, 65, 48]     // 每日学习时长（分钟）
  },
  lisi: {
    dates: ['04-15', '04-16', '04-17', '04-18', '04-19', '04-20', '04-21'],
    wordCounts: [18, 22, 20, 25, 18, 24, 20],
    taskCounts: [3, 4, 3, 5, 4, 3, 4],
    errorCounts: [2, 1, 2, 1, 2, 1, 1],
    studyMinutes: [60, 75, 65, 90, 70, 80, 68]
  },
  zhangsan: {
    dates: ['04-15', '04-16', '04-17', '04-18', '04-19', '04-20', '04-21'],
    wordCounts: [25, 30, 28, 35, 26, 32, 28],
    taskCounts: [4, 5, 4, 6, 5, 4, 5],
    errorCounts: [1, 1, 0, 1, 1, 0, 1],
    studyMinutes: [80, 95, 85, 110, 88, 100, 82]
  }
};

// ==================== 班级 vs 个人完成率走势（近8周）====================
const mockCompareData = {
  student: {
    weeks: ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周', '第7周', '第8周'],
    classRate: [45, 52, 58, 63, 70, 75, 82, 88],    // 班级平均完成率
    myRate: [50, 58, 65, 72, 80, 88, 95, 102]       // 个人完成率
  },
  lisi: {
    weeks: ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周', '第7周', '第8周'],
    classRate: [55, 62, 68, 73, 78, 82, 88, 92],
    myRate: [60, 70, 78, 85, 92, 98, 105, 112]
  },
  zhangsan: {
    weeks: ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周', '第7周', '第8周'],
    classRate: [65, 72, 78, 82, 86, 90, 93, 95],
    myRate: [75, 85, 92, 98, 105, 110, 115, 120]
  }
};

// ==================== 班级排名数据（按学习时长）====================
const mockRankByTimeData = {
  student: [
    { rank: 1, name: '王小明', userId: 101, studyTime: 120, masteredWords: 520, isMe: false },
    { rank: 2, name: '李小红', userId: 102, studyTime: 115, masteredWords: 490, isMe: false },
    { rank: 3, name: '张小刚', userId: 103, studyTime: 108, masteredWords: 475, isMe: false },
    { rank: 4, name: '陈小丽', userId: 104, studyTime: 95, masteredWords: 440, isMe: false },
    { rank: 5, name: '张三', userId: 1, studyTime: 85, masteredWords: 400, isMe: true },
    { rank: 6, name: '赵小华', userId: 105, studyTime: 78, masteredWords: 375, isMe: false },
    { rank: 7, name: '孙小芳', userId: 106, studyTime: 72, masteredWords: 350, isMe: false },
    { rank: 8, name: '周小军', userId: 107, studyTime: 65, masteredWords: 325, isMe: false },
    { rank: 9, name: '吴小敏', userId: 108, studyTime: 58, masteredWords: 300, isMe: false },
    { rank: 10, name: '郑小强', userId: 109, studyTime: 52, masteredWords: 275, isMe: false },
    { rank: 11, name: '冯小刚', userId: 110, studyTime: 48, masteredWords: 250, isMe: false },
    { rank: 12, name: '蒋小丽', userId: 111, studyTime: 42, masteredWords: 240, isMe: false },
    { rank: 13, name: '沈小华', userId: 112, studyTime: 38, masteredWords: 225, isMe: false },
    { rank: 14, name: '韩小军', userId: 113, studyTime: 32, masteredWords: 210, isMe: false },
    { rank: 15, name: '杨小敏', userId: 114, studyTime: 28, masteredWords: 200, isMe: false }
  ],
  lisi: [
    { rank: 1, name: '刘小明', userId: 201, studyTime: 135, masteredWords: 620, isMe: false },
    { rank: 2, name: '赵小红', userId: 202, studyTime: 128, masteredWords: 590, isMe: false },
    { rank: 3, name: '李四', userId: 2, studyTime: 95, masteredWords: 520, isMe: true },
    { rank: 4, name: '周小刚', userId: 203, studyTime: 88, masteredWords: 480, isMe: false },
    { rank: 5, name: '陈小丽', userId: 204, studyTime: 82, masteredWords: 460, isMe: false },
    { rank: 6, name: '孙小华', userId: 205, studyTime: 75, masteredWords: 420, isMe: false },
    { rank: 7, name: '吴小芳', userId: 206, studyTime: 68, masteredWords: 390, isMe: false },
    { rank: 8, name: '郑小军', userId: 207, studyTime: 62, masteredWords: 360, isMe: false }
  ],
  zhangsan: [
    { rank: 1, name: '张三', userId: 3, studyTime: 150, masteredWords: 720, isMe: true },
    { rank: 2, name: '钱小强', userId: 301, studyTime: 142, masteredWords: 680, isMe: false },
    { rank: 3, name: '孙小明', userId: 302, studyTime: 135, masteredWords: 620, isMe: false },
    { rank: 4, name: '李小红', userId: 303, studyTime: 128, masteredWords: 580, isMe: false },
    { rank: 5, name: '周小刚', userId: 304, studyTime: 120, masteredWords: 540, isMe: false },
    { rank: 6, name: '吴小丽', userId: 305, studyTime: 112, masteredWords: 500, isMe: false },
    { rank: 7, name: '郑小华', userId: 306, studyTime: 105, masteredWords: 460, isMe: false }
  ]
};

// ==================== 班级排名数据（按掌握单词量）====================
const mockRankByWordsData = {
  student: [
    { rank: 1, name: '王小明', userId: 101, studyTime: 120, masteredWords: 520, isMe: false },
    { rank: 2, name: '李小红', userId: 102, studyTime: 115, masteredWords: 490, isMe: false },
    { rank: 3, name: '张小刚', userId: 103, studyTime: 108, masteredWords: 475, isMe: false },
    { rank: 4, name: '陈小丽', userId: 104, studyTime: 95, masteredWords: 440, isMe: false },
    { rank: 5, name: '张三', userId: 1, studyTime: 85, masteredWords: 400, isMe: true },
    { rank: 6, name: '赵小华', userId: 105, studyTime: 78, masteredWords: 375, isMe: false },
    { rank: 7, name: '孙小芳', userId: 106, studyTime: 72, masteredWords: 350, isMe: false },
    { rank: 8, name: '周小军', userId: 107, studyTime: 65, masteredWords: 325, isMe: false },
    { rank: 9, name: '吴小敏', userId: 108, studyTime: 58, masteredWords: 300, isMe: false },
    { rank: 10, name: '郑小强', userId: 109, studyTime: 52, masteredWords: 275, isMe: false }
  ],
  lisi: [
    { rank: 1, name: '刘小明', userId: 201, studyTime: 135, masteredWords: 620, isMe: false },
    { rank: 2, name: '赵小红', userId: 202, studyTime: 128, masteredWords: 590, isMe: false },
    { rank: 3, name: '李四', userId: 2, studyTime: 95, masteredWords: 520, isMe: true },
    { rank: 4, name: '周小刚', userId: 203, studyTime: 88, masteredWords: 480, isMe: false },
    { rank: 5, name: '陈小丽', userId: 204, studyTime: 82, masteredWords: 460, isMe: false },
    { rank: 6, name: '孙小华', userId: 205, studyTime: 75, masteredWords: 420, isMe: false },
    { rank: 7, name: '吴小芳', userId: 206, studyTime: 68, masteredWords: 390, isMe: false },
    { rank: 8, name: '郑小军', userId: 207, studyTime: 62, masteredWords: 360, isMe: false }
  ],
  zhangsan: [
    { rank: 1, name: '张三', userId: 3, studyTime: 150, masteredWords: 720, isMe: true },
    { rank: 2, name: '钱小强', userId: 301, studyTime: 142, masteredWords: 680, isMe: false },
    { rank: 3, name: '孙小明', userId: 302, studyTime: 135, masteredWords: 620, isMe: false },
    { rank: 4, name: '李小红', userId: 303, studyTime: 128, masteredWords: 580, isMe: false },
    { rank: 5, name: '周小刚', userId: 304, studyTime: 120, masteredWords: 540, isMe: false },
    { rank: 6, name: '吴小丽', userId: 305, studyTime: 112, masteredWords: 500, isMe: false },
    { rank: 7, name: '郑小华', userId: 306, studyTime: 105, masteredWords: 460, isMe: false }
  ]
};

/**
 * GET /api/student-class-data/statistics
 * 获取顶部统计数据
 */
router.get('/statistics', authMiddleware, async (req, res) => {
  await delay(200);
  const username = getUsername(req);
  const data = mockStatisticsData[username] || mockStatisticsData.student;
  return res.json({ code: 200, data });
});

/**
 * GET /api/student-class-data/daily-study
 * 获取每日学习数据（近7天）
 */
router.get('/daily-study', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const data = mockDailyStudyData[username] || mockDailyStudyData.student;
  return res.json({ code: 200, data });
});

/**
 * GET /api/student-class-data/compare
 * 获取班级 vs 个人完成率走势（近8周）
 */
router.get('/compare', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const data = mockCompareData[username] || mockCompareData.student;
  return res.json({ code: 200, data });
});

/**
 * GET /api/student-class-data/ranking
 * 获取班级排名
 */
router.get('/ranking', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const { type = 'time' } = req.query;
  
  const rankData = type === 'words' 
    ? (mockRankByWordsData[username] || mockRankByWordsData.student)
    : (mockRankByTimeData[username] || mockRankByTimeData.student);
  
  // 计算最大值用于进度条
  const maxStudyTime = Math.max(...rankData.map(r => r.studyTime));
  const maxWords = Math.max(...rankData.map(r => r.masteredWords));
  
  return res.json({
    code: 200,
    data: {
      list: rankData,
      maxStudyTime,
      maxWords,
      total: rankData.length
    }
  });
});

module.exports = router;
