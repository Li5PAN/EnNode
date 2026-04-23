const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// 获取当前用户ID
const getUserId = (req) => {
  return req.user?.id || 1;
};

/**
 * GET /api/student-home/overview
 * 获取学生概览数据
 */
router.get('/overview', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    // 获取今日学习记录
    const today = new Date().toISOString().split('T')[0];
    const [todayRows] = await pool.query(
      `SELECT study_duration, words_studied, words_mastered, tasks_completed, words_searched
       FROM elia_learning_record 
       WHERE user_id = ? AND record_date = ?`,
      [userId, today]
    );

    const todayData = todayRows[0] || {
      study_duration: 0,
      words_studied: 0,
      words_mastered: 0,
      tasks_completed: 0,
      words_searched: 0
    };

    // 获取总错题数
    const [wrongRows] = await pool.query(
      'SELECT COUNT(*) as total FROM elia_wrong_question WHERE user_id = ?',
      [userId]
    );

    // 获取班级排名
    const [rankRows] = await pool.query(
      `SELECT class_rank FROM elia_class_member WHERE user_id = ? AND member_status = '1'`,
      [userId]
    );

    // 获取待完成任务数
    const [taskRows] = await pool.query(
      `SELECT COUNT(*) as pending 
       FROM elia_student_task st
       JOIN elia_task t ON st.task_id = t.task_id
       WHERE st.user_id = ? AND st.task_status = '0' AND t.end_time > NOW()`,
      [userId]
    );

    // 获取用户总学习数据
    const [userRows] = await pool.query(
      'SELECT total_study_time, total_words_searched, total_tasks_completed FROM sys_user WHERE user_id = ?',
      [userId]
    );

    // 获取已掌握单词数
    const [masteredRows] = await pool.query(
      "SELECT COUNT(*) as mastered FROM elia_user_word_record WHERE user_id = ? AND is_mastered = '1'",
      [userId]
    );

    return res.json({
      code: 200,
      data: {
        todayWordsLearned: todayData.words_studied || 0,
        totalWrongQuestions: wrongRows[0].total || 0,
        classRank: rankRows[0]?.class_rank || 0,
        pendingTasks: taskRows[0].pending || 0,
        todayStudyMinutes: todayData.study_duration || 0,
        todayTasksCompleted: todayData.tasks_completed || 0,
        totalStudyMinutes: userRows[0]?.total_study_time || 0,
        masteredWords: masteredRows[0].mastered || 0,
        tasksCompleted: userRows[0]?.total_tasks_completed || 0,
        totalWordsSearched: userRows[0]?.total_words_searched || 0
      }
    });
  } catch (error) {
    console.error('获取学生概览错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/student-home/clock-in
 * 打卡
 */
router.post('/clock-in', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const today = new Date().toISOString().split('T')[0];

  try {
    // 检查今日是否已打卡
    const [recordRows] = await pool.query(
      'SELECT record_id FROM elia_learning_record WHERE user_id = ? AND record_date = ?',
      [userId, today]
    );

    if (recordRows.length > 0) {
      // 已有记录，更新打卡状态
      return res.json({
        code: 200,
        data: {
          clockedIn: true,
          clockInDate: today,
          message: '今日已打卡'
        }
      });
    }

    // 创建今日学习记录
    await pool.query(
      `INSERT INTO elia_learning_record (user_id, record_date, study_duration, words_studied, words_mastered, tasks_completed, create_time)
       VALUES (?, ?, 0, 0, 0, 0, NOW())`,
      [userId, today]
    );

    // 计算连续打卡天数
    const [streakRows] = await pool.query(
      `SELECT record_date FROM elia_learning_record 
       WHERE user_id = ? AND record_date <= ?
       ORDER BY record_date DESC
       LIMIT 30`,
      [userId, today]
    );

    let consecutiveDays = 0;
    let prevDate = null;
    for (const row of streakRows) {
      if (prevDate === null) {
        consecutiveDays = 1;
      } else {
        const diffDays = Math.floor((new Date(prevDate) - new Date(row.record_date)) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          consecutiveDays++;
        } else {
          break;
        }
      }
      prevDate = row.record_date;
    }

    // 获取总打卡天数
    const [totalRows] = await pool.query(
      'SELECT COUNT(*) as total FROM elia_learning_record WHERE user_id = ?',
      [userId]
    );

    return res.json({
      code: 200,
      data: {
        clockedIn: true,
        clockInDate: today,
        consecutiveDays,
        totalDays: totalRows[0].total
      }
    });
  } catch (error) {
    console.error('打卡错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-home/clock-in-status
 * 获取打卡状态
 */
router.get('/clock-in-status', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const today = new Date().toISOString().split('T')[0];

  try {
    // 检查今日是否已打卡
    const [todayRows] = await pool.query(
      'SELECT record_id FROM elia_learning_record WHERE user_id = ? AND record_date = ?',
      [userId, today]
    );

    // 获取总打卡天数
    const [totalRows] = await pool.query(
      'SELECT COUNT(*) as total FROM elia_learning_record WHERE user_id = ?',
      [userId]
    );

    // 计算连续打卡天数
    const [streakRows] = await pool.query(
      `SELECT record_date FROM elia_learning_record 
       WHERE user_id = ?
       ORDER BY record_date DESC
       LIMIT 30`,
      [userId]
    );

    let consecutiveDays = 0;
    let prevDate = null;
    for (const row of streakRows) {
      if (prevDate === null) {
        consecutiveDays = 1;
      } else {
        const diffDays = Math.floor((new Date(prevDate) - new Date(row.record_date)) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          consecutiveDays++;
        } else {
          break;
        }
      }
      prevDate = row.record_date;
    }

    // 获取打卡日期列表
    const [dateRows] = await pool.query(
      'SELECT record_date FROM elia_learning_record WHERE user_id = ? ORDER BY record_date DESC LIMIT 30',
      [userId]
    );
    const clockInDates = dateRows.map(r => r.record_date.toISOString().split('T')[0]);

    return res.json({
      code: 200,
      data: {
        clockedIn: todayRows.length > 0,
        clockInDate: todayRows.length > 0 ? today : null,
        consecutiveDays,
        totalDays: totalRows[0].total,
        clockInDates
      }
    });
  } catch (error) {
    console.error('获取打卡状态错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-home/weekly-tasks
 * 获取近7天任务完成情况
 */
router.get('/weekly-tasks', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      `SELECT record_date, tasks_completed
       FROM elia_learning_record 
       WHERE user_id = ? AND record_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       ORDER BY record_date ASC`,
      [userId]
    );

    // 填充缺失的日期
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const record = rows.find(r => r.record_date.toISOString().split('T')[0] === dateStr);
      data.push({
        date: dateStr,
        completedCount: record?.tasks_completed || 0
      });
    }

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取近7天任务完成情况错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-home/weekly-words
 * 获取近7天单词学习情况（单词学习趋势）
 */
router.get('/weekly-words', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      `SELECT record_date, words_mastered
       FROM elia_learning_record 
       WHERE user_id = ? AND record_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       ORDER BY record_date ASC`,
      [userId]
    );

    // 填充缺失的日期
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const record = rows.find(r => r.record_date.toISOString().split('T')[0] === dateStr);
      data.push({
        date: dateStr,
        masteredCount: record?.words_mastered || 0
      });
    }

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取近7天单词学习情况错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-home/pending-tasks
 * 获取首页未完成任务列表
 */
router.get('/pending-tasks', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      `SELECT t.task_id, t.task_name, t.end_time, t.question_count,
        CASE 
          WHEN t.end_time < DATE_ADD(NOW(), INTERVAL 3 DAY) THEN 'urgent'
          WHEN t.end_time < DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 'normal'
          ELSE 'comfortable'
        END as urgency
       FROM elia_student_task st
       JOIN elia_task t ON st.task_id = t.task_id
       WHERE st.user_id = ? AND st.task_status = '0' AND t.end_time > NOW()
       ORDER BY t.end_time ASC
       LIMIT 10`,
      [userId]
    );

    const data = rows.map(r => ({
      id: r.task_id,
      title: r.task_name,
      deadline: r.end_time.toISOString().split('T')[0],
      questionCount: r.question_count,
      urgency: r.urgency
    }));

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取未完成任务列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-home/class-notifications
 * 获取班级申请审核通知
 */
router.get('/class-notifications', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    // 查询该学生的所有班级申请记录（已审核的）
    // 换班申请中 class_id 是目标班级，需要通过 source_teacher_id 关联源班级
    const [rows] = await pool.query(
      `SELECT 
        a.application_id,
        a.application_type,
        a.application_status,
        a.application_reason,
        a.audit_remark,
        a.create_time,
        a.update_time,
        a.source_approved,
        a.target_approved,
        a.source_teacher_id,
        c.class_name,
        c.class_level
       FROM elia_class_application a
       JOIN elia_class c ON a.class_id = c.class_id
       WHERE a.applicant_id = ? AND a.application_status IN ('1', '2')
       ORDER BY a.update_time DESC
       LIMIT 20`,
      [userId]
    );

    // 对于换班申请，需要额外查询源班级名称
    const data = await Promise.all(rows.map(async r => {
      let sourceClassName = null;
      if (r.application_type === '3' && r.source_teacher_id) {
        // 通过源班级老师ID查询源班级名称
        const [sourceClassRows] = await pool.query(
          'SELECT class_name FROM elia_class WHERE teacher_id = ? AND class_status = "1" LIMIT 1',
          [r.source_teacher_id]
        );
        sourceClassName = sourceClassRows[0]?.class_name || null;
      }

      let content = '';
      const typeMap = { '1': '入班', '2': '退班', '3': '换班' };
      const typeText = typeMap[r.application_type] || '未知';
      
      if (r.application_type === '1') {
        content = `您申请加入【${r.class_name}】班级的${typeText}申请`;
      } else if (r.application_type === '2') {
        content = `您申请退出【${r.class_name}】班级的${typeText}申请`;
      } else if (r.application_type === '3') {
        content = `您申请从【${sourceClassName || '原班级'}】换到【${r.class_name}】的${typeText}申请`;
      }

      // 根据审核结果补充内容
      if (r.application_status === '1') {
        content += '已通过';
      } else if (r.application_status === '2') {
        content += '被拒绝';
      }

      const statusMap = { '0': 'pending', '1': 'approved', '2': 'rejected' };

      return {
        id: r.application_id,
        type: r.application_type,
        typeText: typeText,
        status: statusMap[r.application_status] || 'pending',
        content: content,
        className: r.class_name,
        classLevel: r.class_level,
        sourceClassName: sourceClassName,
        reason: r.audit_remark || null,
        myReason: r.application_reason,
        createTime: r.create_time,
        updateTime: r.update_time
      };
    }));

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取班级申请审核通知错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-home/class-progress
 * 获取班级任务完成进度
 */
router.get('/class-progress', authMiddleware, async (req, res) => {
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
        data: { completed: 0, total: 0, rate: 0, ranking: 0, totalClasses: 0 }
      });
    }

    const classId = memberRows[0].class_id;

    // 获取用户任务完成情况
    const [taskRows] = await pool.query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN task_status = '2' THEN 1 ELSE 0 END) as completed
       FROM elia_student_task WHERE user_id = ? AND class_id = ?`,
      [userId, classId]
    );

    const completed = taskRows[0].completed || 0;
    const total = taskRows[0].total || 0;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 获取班级排名
    const [rankRows] = await pool.query(
      `SELECT user_id, class_rank FROM elia_class_member 
       WHERE class_id = ? AND member_status = '1' 
       ORDER BY class_rank ASC`,
      [classId]
    );
    const ranking = rankRows.findIndex(r => r.user_id === userId) + 1;

    // 获取班级总数
    const [classRows] = await pool.query('SELECT COUNT(*) as total FROM elia_class WHERE class_status = "1"');

    return res.json({
      code: 200,
      data: {
        completed,
        total,
        rate,
        ranking,
        totalClasses: classRows[0].total
      }
    });
  } catch (error) {
    console.error('获取班级任务完成进度错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
