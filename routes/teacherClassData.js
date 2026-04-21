const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// 获取当前用户ID
const getUserId = (req) => {
  return req.user?.id || 1;
};

/**
 * GET /api/teacher-class-data/class-list
 * 获取班级下拉列表
 */
router.get('/class-list', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      `SELECT class_id as id, class_name as name, class_level as level
       FROM elia_class
       WHERE teacher_id = ? AND class_status = '1'
       ORDER BY class_level ASC`,
      [userId]
    );

    return res.json({ code: 200, data: rows });
  } catch (error) {
    console.error('获取班级列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-class-data/task-completion-chart
 * 获取班级任务完成对比图数据
 */
router.get('/task-completion-chart', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { classId } = req.query;

  if (!classId) {
    return res.json({ code: 400, msg: '请选择班级' });
  }

  try {
    // 验证班级是否属于当前教师
    const [classRows] = await pool.query(
      'SELECT class_id FROM elia_class WHERE class_id = ? AND teacher_id = ? AND class_status = "1"',
      [classId, userId]
    );

    if (classRows.length === 0) {
      return res.json({ code: 404, msg: '班级不存在或无权限' });
    }

    // 获取任务完成情况
    const [taskRows] = await pool.query(
      `SELECT 
        t.task_id as taskId,
        t.task_name as taskName,
        COUNT(DISTINCT st.user_id) as totalStudents,
        SUM(CASE WHEN st.task_status = '2' THEN 1 ELSE 0 END) as completedCount
       FROM elia_task t
       LEFT JOIN elia_student_task st ON t.task_id = st.task_id
       WHERE t.class_id = ? AND t.teacher_id = ?
       GROUP BY t.task_id, t.task_name
       ORDER BY t.create_time DESC`,
      [classId, userId]
    );

    const taskList = taskRows.map(t => ({
      taskId: t.taskId,
      taskName: t.taskName,
      totalStudents: t.totalStudents || 0,
      completedCount: t.completedCount || 0,
      completionRate: t.totalStudents > 0 ? Math.round((t.completedCount / t.totalStudents) * 100) : 0
    }));

    // 计算汇总数据
    const totalTasks = taskList.length;
    const avgCompletionRate = taskList.length > 0 
      ? Math.round(taskList.reduce((sum, t) => sum + t.completionRate, 0) / taskList.length) 
      : 0;
    const highestRate = taskList.length > 0 ? Math.max(...taskList.map(t => t.completionRate)) : 0;
    const lowestRate = taskList.length > 0 ? Math.min(...taskList.map(t => t.completionRate)) : 0;

    return res.json({
      code: 200,
      data: {
        taskList,
        summary: {
          totalTasks,
          avgCompletionRate,
          highestRate,
          lowestRate
        }
      }
    });
  } catch (error) {
    console.error('获取任务完成数据错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-class-data/student-activity-chart
 * 获取学生学习活跃分析图数据
 */
router.get('/student-activity-chart', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { classId } = req.query;

  if (!classId) {
    return res.json({ code: 400, msg: '请选择班级' });
  }

  try {
    // 验证班级是否属于当前教师
    const [classRows] = await pool.query(
      'SELECT class_id FROM elia_class WHERE class_id = ? AND teacher_id = ? AND class_status = "1"',
      [classId, userId]
    );

    if (classRows.length === 0) {
      return res.json({ code: 404, msg: '班级不存在或无权限' });
    }

    // 获取近7天的学习数据
    const [rows] = await pool.query(
      `SELECT 
        DAYNAME(lr.record_date) as day_name,
        SUM(lr.tasks_completed) as completedTasks,
        SUM(lr.words_studied) as exercises,
        SUM(lr.study_duration) as studyDuration
       FROM elia_learning_record lr
       WHERE lr.class_id = ? AND lr.record_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY lr.record_date, DAYNAME(lr.record_date)
       ORDER BY lr.record_date ASC`,
      [classId]
    );

    const dayMap = {
      'Monday': '周一', 'Tuesday': '周二', 'Wednesday': '周三',
      'Thursday': '周四', 'Friday': '周五', 'Saturday': '周六', 'Sunday': '周日'
    };

    const dayOrder = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    // 填充缺失的日期
    const days = [];
    const completedTasks = [];
    const exercises = [];
    const studyDuration = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
      const chineseDay = dayMap[dayName];

      const record = rows.find(r => r.day_name === dayName);

      days.push(chineseDay);
      completedTasks.push(record?.completedTasks || 0);
      exercises.push(record?.exercises || 0);
      studyDuration.push(record?.studyDuration || 0);
    }

    // 计算汇总数据
    const totalCompletedTasks = completedTasks.reduce((a, b) => a + b, 0);
    const totalExercises = exercises.reduce((a, b) => a + b, 0);
    const totalStudyDuration = studyDuration.reduce((a, b) => a + b, 0);
    const avgDailyActive = Math.round(totalCompletedTasks / 7);

    return res.json({
      code: 200,
      data: {
        days,
        completedTasks,
        exercises,
        studyDuration,
        summary: {
          totalCompletedTasks,
          totalExercises,
          totalStudyDuration,
          avgDailyActive
        }
      }
    });
  } catch (error) {
    console.error('获取学生活跃数据错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-class-data/error-type-chart
 * 获取学生错题类型分析图数据
 */
router.get('/error-type-chart', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { classId } = req.query;

  if (!classId) {
    return res.json({ code: 400, msg: '请选择班级' });
  }

  try {
    // 验证班级是否属于当前教师
    const [classRows] = await pool.query(
      'SELECT class_id FROM elia_class WHERE class_id = ? AND teacher_id = ? AND class_status = "1"',
      [classId, userId]
    );

    if (classRows.length === 0) {
      return res.json({ code: 404, msg: '班级不存在或无权限' });
    }

    // 获取错题类型分布
    const [typeRows] = await pool.query(
      `SELECT 
        w.question_type,
        COUNT(*) as count
       FROM elia_wrong_question w
       WHERE w.class_id = ?
       GROUP BY w.question_type
       ORDER BY count DESC`,
      [classId]
    );

    const typeMap = { '1': '选择题', '2': '单词拼写', '3': '填空题' };
    const total = typeRows.reduce((sum, r) => sum + r.count, 0);

    const errorTypes = typeRows.map(r => ({
      type: typeMap[r.question_type] || r.question_type,
      count: r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0
    }));

    // 获取近4周错题趋势
    const [trendRows] = await pool.query(
      `SELECT 
        YEARWEEK(create_time, 1) as week,
        COUNT(*) as count
       FROM elia_wrong_question
       WHERE class_id = ? AND create_time >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)
       GROUP BY YEARWEEK(create_time, 1)
       ORDER BY week ASC`,
      [classId]
    );

    const weeks = [];
    const errorCounts = [];

    trendRows.forEach((r, i) => {
      weeks.push(`第${i + 1}周`);
      errorCounts.push(r.count);
    });

    // 如果没有数据，填充默认值
    if (weeks.length === 0) {
      for (let i = 1; i <= 4; i++) {
        weeks.push(`第${i}周`);
        errorCounts.push(0);
      }
    }

    // 汇总数据
    const mostErrorType = errorTypes.length > 0 ? errorTypes[0].type : '';
    const mostErrorCount = errorTypes.length > 0 ? errorTypes[0].count : 0;

    return res.json({
      code: 200,
      data: {
        errorTypes,
        summary: {
          totalErrors: total,
          mostErrorType,
          mostErrorCount
        },
        trend: {
          weeks,
          errorCounts
        }
      }
    });
  } catch (error) {
    console.error('获取错题类型数据错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
