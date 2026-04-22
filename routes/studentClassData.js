const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// 获取当前用户ID
const getUserId = (req) => {
  return req.user?.id || 1;
};

/**
 * GET /api/student-class-data/statistics
 * 获取顶部统计数据
 */
router.get('/statistics', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    // 获取累计查词量
    const [wordRows] = await pool.query(
      'SELECT total_words_searched FROM sys_user WHERE user_id = ?',
      [userId]
    );

    // 获取任务完成数
    const [taskRows] = await pool.query(
      "SELECT COUNT(*) as completed FROM elia_student_task WHERE user_id = ? AND task_status = '2'",
      [userId]
    );

    // 获取总错题数
    const [errorRows] = await pool.query(
      'SELECT COUNT(*) as total FROM elia_wrong_question WHERE user_id = ?',
      [userId]
    );

    return res.json({
      code: 200,
      data: {
        totalWords: wordRows[0]?.total_words_searched || 0,
        completedTasks: taskRows[0]?.completed || 0,
        totalErrors: errorRows[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('获取统计数据错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-class-data/daily-study
 * 获取每日学习数据（近7天）
 */
router.get('/daily-study', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      `SELECT 
        DATE_FORMAT(record_date, '%m-%d') as date,
        words_searched as wordCount,
        tasks_completed as taskCount,
        study_duration as studyMinutes
       FROM elia_learning_record 
       WHERE user_id = ? AND record_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       ORDER BY record_date ASC`,
      [userId]
    );

    // 获取每日错题数
    const [errorRows] = await pool.query(
      `SELECT 
        DATE_FORMAT(create_time, '%m-%d') as date,
        COUNT(*) as errorCount
       FROM elia_wrong_question 
       WHERE user_id = ? AND create_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(create_time)
       ORDER BY DATE(create_time) ASC`,
      [userId]
    );

    // 填充缺失的日期
    const dates = [];
    const wordCounts = [];
    const taskCounts = [];
    const errorCounts = [];
    const studyMinutes = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(5, 10).replace('-', '-');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const formattedDate = `${month}-${day}`;

      const record = rows.find(r => r.date === formattedDate);
      const errorRecord = errorRows.find(r => r.date === formattedDate);

      dates.push(formattedDate);
      wordCounts.push(record?.wordCount || 0);
      taskCounts.push(record?.taskCount || 0);
      errorCounts.push(errorRecord?.errorCount || 0);
      studyMinutes.push(record?.studyMinutes || 0);
    }

    return res.json({
      code: 200,
      data: {
        dates,
        wordCounts,
        taskCounts,
        errorCounts,
        studyMinutes
      }
    });
  } catch (error) {
    console.error('获取每日学习数据错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-class-data/compare
 * 获取班级 vs 个人完成率走势（近8周）
 */
router.get('/compare', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    // 获取用户当前班级
    const [memberRows] = await pool.query(
      'SELECT class_id FROM elia_class_member WHERE user_id = ? AND member_status = "1"',
      [userId]
    );

    if (memberRows.length === 0) {
      return res.json({
        code: 200,
        data: {
          weeks: [],
          classRate: [],
          myRate: []
        }
      });
    }

    const classId = memberRows[0].class_id;

    // 获取近8周的数据
    const [rows] = await pool.query(
      `SELECT 
        YEARWEEK(record_date, 1) as week,
        AVG(CASE WHEN st.task_status = '2' THEN 100 ELSE 0 END) as class_rate,
        MAX(CASE WHEN lr.user_id = ? THEN (SELECT COUNT(*) FROM elia_student_task WHERE user_id = ? AND task_status = '2') ELSE 0 END) as my_rate
       FROM elia_learning_record lr
       LEFT JOIN elia_class_member cm ON lr.user_id = cm.user_id AND lr.class_id = cm.class_id
       LEFT JOIN elia_student_task st ON cm.user_id = st.user_id
       WHERE lr.class_id = ? AND lr.record_date >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
       GROUP BY YEARWEEK(record_date, 1)
       ORDER BY week ASC`,
      [userId, userId, classId]
    );

    const weeks = [];
    const classRate = [];
    const myRate = [];

    rows.forEach((r, i) => {
      weeks.push(`第${i + 1}周`);
      classRate.push(Math.round(r.class_rate || 0));
      myRate.push(Math.round(r.my_rate || 0));
    });

    return res.json({
      code: 200,
      data: { weeks, classRate, myRate }
    });
  } catch (error) {
    console.error('获取对比数据错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-class-data/ranking
 * 获取班级排名
 */
router.get('/ranking', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { type = 'time' } = req.query;

  try {
    // 获取用户当前班级
    const [memberRows] = await pool.query(
      'SELECT class_id FROM elia_class_member WHERE user_id = ? AND member_status = "1"',
      [userId]
    );

    if (memberRows.length === 0) {
      return res.json({
        code: 200,
        data: { list: [], maxStudyTime: 0, maxWords: 0, total: 0 }
      });
    }

    const classId = memberRows[0].class_id;

    // 获取班级成员排名
    let orderBy = 'cm.total_study_time DESC';
    if (type === 'words') {
      orderBy = 'cm.mastery_words DESC';
    }

    const [rows] = await pool.query(
      `SELECT 
        cm.user_id,
        u.nick_name as name,
        cm.total_study_time as studyTime,
        cm.mastery_words as masteredWords,
        cm.class_rank as \`rank\`
       FROM elia_class_member cm
       JOIN sys_user u ON cm.user_id = u.user_id
       WHERE cm.class_id = ? AND cm.member_status = '1'
       ORDER BY ${orderBy}
       LIMIT 15`,
      [classId]
    );

    const list = rows.map((r, index) => ({
      rank: index + 1,
      name: r.name,
      userId: r.user_id,
      studyTime: r.studyTime || 0,
      masteredWords: r.masteredWords || 0,
      isMe: r.user_id === userId
    }));

    const maxStudyTime = Math.max(...list.map(r => r.studyTime), 1);
    const maxWords = Math.max(...list.map(r => r.masteredWords), 1);

    return res.json({
      code: 200,
      data: {
        list,
        maxStudyTime,
        maxWords,
        total: list.length
      }
    });
  } catch (error) {
    console.error('获取班级排名错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
