const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// 获取当前用户ID
const getUserId = (req) => {
  return req.user?.id || 1;
};

// 班级状态枚举
const ClassStatus = {
  NO_CLASS: 0,        // 未入班
  JOINED: 1,          // 已入班
  APPLYING_JOIN: 2,   // 申请入班中
  APPLYING_QUIT: 3,   // 申请退班中
  APPLYING_CHANGE: 4  // 申请换班中
};

/**
 * GET /api/student-class/status
 * 获取班级状态
 */
router.get('/status', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    // 查询用户当前班级
    const [memberRows] = await pool.query(
      `SELECT cm.*, c.class_name, c.class_level 
       FROM elia_class_member cm
       JOIN elia_class c ON cm.class_id = c.class_id
       WHERE cm.user_id = ? AND cm.member_status = '1'`,
      [userId]
    );

    // 查询待审核的申请
    const [applicationRows] = await pool.query(
      `SELECT a.*, c.class_name 
       FROM elia_class_application a
       JOIN elia_class c ON a.class_id = c.class_id
       WHERE a.applicant_id = ? AND a.application_status = '0'`,
      [userId]
    );

    // 查询用户是否首次入班
    const [historyRows] = await pool.query(
      'SELECT COUNT(*) as count FROM elia_class_member WHERE user_id = ?',
      [userId]
    );
    const isFirstJoin = historyRows[0].count === 0;

    // 查询用户上次班级等级
    const [lastClassRows] = await pool.query(
      `SELECT c.class_level 
       FROM elia_class_member cm
       JOIN elia_class c ON cm.class_id = c.class_id
       WHERE cm.user_id = ? AND cm.member_status = '0'
       ORDER BY cm.leave_time DESC LIMIT 1`,
      [userId]
    );

    let status = ClassStatus.NO_CLASS;
    let currentClassId = null;
    let currentClassName = null;

    if (memberRows.length > 0) {
      status = ClassStatus.JOINED;
      currentClassId = memberRows[0].class_id;
      currentClassName = memberRows[0].class_name;
    } else if (applicationRows.length > 0) {
      const app = applicationRows[0];
      if (app.application_type === '1') {
        status = ClassStatus.APPLYING_JOIN;
      } else if (app.application_type === '2') {
        status = ClassStatus.APPLYING_QUIT;
      } else if (app.application_type === '3') {
        status = ClassStatus.APPLYING_CHANGE;
      }
    }

    return res.json({
      code: 200,
      data: {
        status,
        isFirstJoin,
        currentClassId,
        currentClassName,
        pendingApplication: applicationRows.length > 0 ? applicationRows[0] : null,
        lastClassLevel: lastClassRows.length > 0 ? lastClassRows[0].class_level : null
      }
    });
  } catch (error) {
    console.error('获取班级状态错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-class/list
 * 获取班级列表（支持等级筛选）
 */
router.get('/list', authMiddleware, async (req, res) => {
  const { level } = req.query;

  try {
    let sql = `
      SELECT c.class_id, c.class_name, c.class_level, c.class_code, c.class_description,
             c.max_students, c.current_students, c.task_requirement, c.class_avatar,
             c.teacher_id, u.nick_name as teacher_name
      FROM elia_class c
      LEFT JOIN sys_user u ON c.teacher_id = u.user_id
      WHERE c.class_status = '1'
    `;
    const params = [];

    if (level) {
      sql += ' AND c.class_level = ?';
      params.push(level);
    }

    sql += ' ORDER BY c.class_level ASC, c.create_time DESC';

    const [rows] = await pool.query(sql, params);

    const classes = rows.map(c => ({
      classId: c.class_id,
      name: c.class_name,
      level: c.class_level,
      code: c.class_code,
      description: c.class_description,
      maxStudents: c.max_students,
      memberCount: c.current_students || 0,
      studentCount: c.current_students || 0,
      taskCount: c.task_requirement,
      totalTasks: c.task_requirement,
      teacherId: c.teacher_id,
      teacherName: c.teacher_name,
      avatar: c.class_avatar
    }));

    return res.json({ code: 200, rows: classes, total: classes.length });
  } catch (error) {
    console.error('获取班级列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-class/my-class
 * 获取我的班级信息
 */
router.get('/my-class', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [memberRows] = await pool.query(
      `SELECT cm.*, c.class_name, c.class_level, c.task_requirement, c.current_students, c.teacher_id
       FROM elia_class_member cm
       JOIN elia_class c ON cm.class_id = c.class_id
       WHERE cm.user_id = ? AND cm.member_status = '1'`,
      [userId]
    );

    if (memberRows.length === 0) {
      return res.json({
        code: 200,
        data: {
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
        }
      });
    }

    const member = memberRows[0];

    // 获取教师名字
    const [teacherRows] = await pool.query(
      'SELECT nick_name FROM sys_user WHERE user_id = ?',
      [member.teacher_id]
    );

    // 获取班级排名
    const [rankRows] = await pool.query(
      `SELECT user_id, class_rank FROM elia_class_member 
       WHERE class_id = ? AND member_status = '1' 
       ORDER BY class_rank ASC`,
      [member.class_id]
    );
    const myRank = rankRows.find(r => r.user_id === userId)?.class_rank || 0;

    // 获取任务完成情况
    const [taskRows] = await pool.query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN task_status = '2' THEN 1 ELSE 0 END) as completed
       FROM elia_student_task WHERE user_id = ? AND class_id = ?`,
      [userId, member.class_id]
    );

    const totalTasks = taskRows[0].total || 0;
    const completedTasks = taskRows[0].completed || 0;
    const myTaskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 获取班级平均完成率
    const [classTaskRows] = await pool.query(
      `SELECT AVG(CASE WHEN st.task_status = '2' THEN 100 ELSE 0 END) as avg_rate
       FROM elia_class_member cm
       LEFT JOIN elia_student_task st ON cm.user_id = st.user_id AND cm.class_id = st.class_id
       WHERE cm.class_id = ? AND cm.member_status = '1'`,
      [member.class_id]
    );
    const classTaskCompletionRate = Math.round(classTaskRows[0].avg_rate || 0);

    return res.json({
      code: 200,
      data: {
        classId: member.class_id,
        className: member.class_name,
        classLevel: member.class_level,
        teacherName: teacherRows[0]?.nick_name || '',
        memberCount: member.current_students || 0,
        totalTasks: member.task_requirement || 0,
        myRank,
        classTaskCompletionRate,
        myTaskCompletionRate,
        completedTasks,
        isFirstJoin: false
      }
    });
  } catch (error) {
    console.error('获取我的班级信息错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-class/ranking
 * 获取班级排行榜
 */
router.get('/ranking', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    // 获取用户当前班级
    const [memberRows] = await pool.query(
      'SELECT class_id FROM elia_class_member WHERE user_id = ? AND member_status = "1"',
      [userId]
    );

    if (memberRows.length === 0) {
      return res.json({ code: 200, data: [] });
    }

    const classId = memberRows[0].class_id;

    // 获取班级排行榜
    const [rankRows] = await pool.query(
      `SELECT cm.user_id, u.nick_name as name, cm.class_rank as rank,
              cm.completed_tasks, cm.total_study_time
       FROM elia_class_member cm
       JOIN sys_user u ON cm.user_id = u.user_id
       WHERE cm.class_id = ? AND cm.member_status = '1'
       ORDER BY cm.class_rank ASC
       LIMIT 15`,
      [classId]
    );

    const data = rankRows.map((r, index) => ({
      rank: r.rank || index + 1,
      name: r.name,
      userId: r.user_id,
      taskCompletionRate: r.completed_tasks || 0,
      questionCount: r.total_study_time || 0,
      isMe: r.user_id === userId
    }));

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取班级排行榜错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-class/trend
 * 获取班级学习趋势（近8周）
 */
router.get('/trend', authMiddleware, async (req, res) => {
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
          classAvg: [],
          myData: [],
          wrongCount: []
        }
      });
    }

    const classId = memberRows[0].class_id;

    // 获取近8周的学习记录
    const [recordRows] = await pool.query(
      `SELECT 
        YEARWEEK(record_date, 1) as week,
        AVG(study_duration) as class_avg,
        SUM(CASE WHEN user_id = ? THEN study_duration ELSE 0 END) as my_data
       FROM elia_learning_record
       WHERE class_id = ? AND record_date >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
       GROUP BY YEARWEEK(record_date, 1)
       ORDER BY week ASC`,
      [userId, classId]
    );

    const weeks = [];
    const classAvg = [];
    const myData = [];
    const wrongCount = [];

    recordRows.forEach((r, i) => {
      weeks.push(`第${i + 1}周`);
      classAvg.push(Math.round(r.class_avg || 0));
      myData.push(r.my_data || 0);
      wrongCount.push(0); // 暂无错题趋势数据
    });

    return res.json({
      code: 200,
      data: { weeks, classAvg, myData, wrongCount }
    });
  } catch (error) {
    console.error('获取班级学习趋势错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/student-class/apply
 * 申请入班
 */
router.post('/apply', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { classId } = req.body;

  if (!classId) {
    return res.json({ code: 400, msg: '请选择要加入的班级' });
  }

  try {
    // 检查班级是否存在
    const [classRows] = await pool.query(
      'SELECT * FROM elia_class WHERE class_id = ? AND class_status = "1"',
      [classId]
    );

    if (classRows.length === 0) {
      return res.json({ code: 404, msg: '班级不存在' });
    }

    const classData = classRows[0];

    // 检查是否已在班级中
    const [memberRows] = await pool.query(
      'SELECT * FROM elia_class_member WHERE user_id = ? AND member_status = "1"',
      [userId]
    );

    if (memberRows.length > 0) {
      return res.json({ code: 400, msg: '您已在班级中，请先退出当前班级' });
    }

    // 检查是否有待审核的申请
    const [applicationRows] = await pool.query(
      'SELECT * FROM elia_class_application WHERE applicant_id = ? AND application_status = "0"',
      [userId]
    );

    if (applicationRows.length > 0) {
      return res.json({ code: 400, msg: '您有待审核的入班申请，请等待审核' });
    }

    // 检查是否首次入班
    const [historyRows] = await pool.query(
      'SELECT COUNT(*) as count FROM elia_class_member WHERE user_id = ?',
      [userId]
    );
    const isFirstJoin = historyRows[0].count === 0;

    // 检查入班限制
    if (isFirstJoin && classData.class_level !== 'D') {
      return res.json({ code: 400, msg: '首次入班只能选择D级班级' });
    }

    // 检查上次班级等级
    const [lastClassRows] = await pool.query(
      `SELECT c.class_level 
       FROM elia_class_member cm
       JOIN elia_class c ON cm.class_id = c.class_id
       WHERE cm.user_id = ? AND cm.member_status = '0'
       ORDER BY cm.leave_time DESC LIMIT 1`,
      [userId]
    );

    if (lastClassRows.length > 0) {
      const levelOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
      if (levelOrder[classData.class_level] < levelOrder[lastClassRows[0].class_level]) {
        return res.json({ code: 400, msg: `您只能选择${lastClassRows[0].class_level}级或更低等级的班级` });
      }
    }

    // 创建入班申请（直接通过）
    await pool.query(
      `INSERT INTO elia_class_member (class_id, user_id, join_time, member_status, completed_tasks, total_study_time, create_time)
       VALUES (?, ?, NOW(), '1', 0, 0, NOW())`,
      [classId, userId]
    );

    // 更新班级人数
    await pool.query(
      'UPDATE elia_class SET current_students = current_students + 1 WHERE class_id = ?',
      [classId]
    );

    // 更新用户当前班级
    await pool.query(
      'UPDATE sys_user SET current_class_id = ?, join_class_time = NOW() WHERE user_id = ?',
      [classId, userId]
    );

    return res.json({
      code: 200,
      msg: '成功加入班级',
      data: {
        classId: classData.class_id,
        className: classData.class_name
      }
    });
  } catch (error) {
    console.error('申请入班错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/student-class/quit
 * 退出班级
 */
router.post('/quit', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    // 获取当前班级
    const [memberRows] = await pool.query(
      'SELECT * FROM elia_class_member WHERE user_id = ? AND member_status = "1"',
      [userId]
    );

    if (memberRows.length === 0) {
      return res.json({ code: 400, msg: '您当前不在任何班级中' });
    }

    const member = memberRows[0];

    // 更新成员状态
    await pool.query(
      'UPDATE elia_class_member SET member_status = "0", leave_time = NOW() WHERE member_id = ?',
      [member.member_id]
    );

    // 更新班级人数
    await pool.query(
      'UPDATE elia_class SET current_students = current_students - 1 WHERE class_id = ?',
      [member.class_id]
    );

    // 更新用户当前班级
    await pool.query(
      'UPDATE sys_user SET current_class_id = NULL WHERE user_id = ?',
      [userId]
    );

    return res.json({ code: 200, msg: '已成功退出班级' });
  } catch (error) {
    console.error('退出班级错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/student-class/change
 * 申请换班
 */
router.post('/change', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { classId } = req.body;

  if (!classId) {
    return res.json({ code: 400, msg: '请选择要换入的班级' });
  }

  try {
    // 获取当前班级
    const [memberRows] = await pool.query(
      `SELECT cm.*, c.class_level as current_level
       FROM elia_class_member cm
       JOIN elia_class c ON cm.class_id = c.class_id
       WHERE cm.user_id = ? AND cm.member_status = '1'`,
      [userId]
    );

    if (memberRows.length === 0) {
      return res.json({ code: 400, msg: '您当前不在班级中，无法换班' });
    }

    const currentMember = memberRows[0];

    // 检查任务完成率
    const [taskRows] = await pool.query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN task_status = '2' THEN 1 ELSE 0 END) as completed
       FROM elia_student_task WHERE user_id = ? AND class_id = ?`,
      [userId, currentMember.class_id]
    );

    const completionRate = taskRows[0].total > 0 ? Math.round((taskRows[0].completed / taskRows[0].total) * 100) : 0;
    if (completionRate < 100) {
      return res.json({ code: 400, msg: `您当前的任务完成率为${completionRate}%，需要完成100%的班级任务才能申请换班` });
    }

    // 获取目标班级
    const [targetClassRows] = await pool.query(
      'SELECT * FROM elia_class WHERE class_id = ? AND class_status = "1"',
      [classId]
    );

    if (targetClassRows.length === 0) {
      return res.json({ code: 404, msg: '目标班级不存在' });
    }

    const targetClass = targetClassRows[0];

    // 检查换班限制
    const levelOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
    if (levelOrder[targetClass.class_level] < levelOrder[currentMember.current_level]) {
      return res.json({ code: 400, msg: '只能换到同级或更低等级的班级' });
    }

    // 执行换班
    await pool.query(
      'UPDATE elia_class_member SET member_status = "0", leave_time = NOW() WHERE member_id = ?',
      [currentMember.member_id]
    );

    await pool.query(
      `INSERT INTO elia_class_member (class_id, user_id, join_time, member_status, completed_tasks, total_study_time, create_time)
       VALUES (?, ?, NOW(), '1', 0, 0, NOW())`,
      [classId, userId]
    );

    await pool.query(
      'UPDATE elia_class SET current_students = current_students - 1 WHERE class_id = ?',
      [currentMember.class_id]
    );

    await pool.query(
      'UPDATE elia_class SET current_students = current_students + 1 WHERE class_id = ?',
      [classId]
    );

    await pool.query(
      'UPDATE sys_user SET current_class_id = ? WHERE user_id = ?',
      [classId, userId]
    );

    return res.json({
      code: 200,
      msg: '换班成功',
      data: {
        classId: targetClass.class_id,
        className: targetClass.class_name
      }
    });
  } catch (error) {
    console.error('申请换班错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-class/check-apply
 * 检查是否可以申请入班
 */
router.get('/check-apply', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { level } = req.query;

  try {
    // 检查是否已在班级中
    const [memberRows] = await pool.query(
      'SELECT * FROM elia_class_member WHERE user_id = ? AND member_status = "1"',
      [userId]
    );

    if (memberRows.length > 0) {
      return res.json({
        code: 200,
        data: { canApply: false, reason: '您已在班级中，请先退出当前班级' }
      });
    }

    // 检查是否有待审核的申请
    const [applicationRows] = await pool.query(
      'SELECT * FROM elia_class_application WHERE applicant_id = ? AND application_status = "0"',
      [userId]
    );

    if (applicationRows.length > 0) {
      return res.json({
        code: 200,
        data: { canApply: false, reason: '您有待审核的入班申请' }
      });
    }

    // 检查是否首次入班
    const [historyRows] = await pool.query(
      'SELECT COUNT(*) as count FROM elia_class_member WHERE user_id = ?',
      [userId]
    );
    const isFirstJoin = historyRows[0].count === 0;

    if (isFirstJoin && level !== 'D') {
      return res.json({
        code: 200,
        data: { canApply: false, reason: '首次入班只能选择D级班级', isFirstJoin }
      });
    }

    // 检查上次班级等级
    const [lastClassRows] = await pool.query(
      `SELECT c.class_level 
       FROM elia_class_member cm
       JOIN elia_class c ON cm.class_id = c.class_id
       WHERE cm.user_id = ? AND cm.member_status = '0'
       ORDER BY cm.leave_time DESC LIMIT 1`,
      [userId]
    );

    if (lastClassRows.length > 0 && level) {
      const levelOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
      if (levelOrder[level] < levelOrder[lastClassRows[0].class_level]) {
        return res.json({
          code: 200,
          data: {
            canApply: false,
            reason: `您只能选择${lastClassRows[0].class_level}级或更低等级的班级`,
            isFirstJoin,
            lastClassLevel: lastClassRows[0].class_level
          }
        });
      }
    }

    return res.json({
      code: 200,
      data: {
        canApply: true,
        reason: '',
        isFirstJoin,
        lastClassLevel: lastClassRows[0]?.class_level || null
      }
    });
  } catch (error) {
    console.error('检查申请资格错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
