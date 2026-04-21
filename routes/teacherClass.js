const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// 获取当前用户ID
const getUserId = (req) => {
  return req.user?.id || 1;
};

/**
 * GET /api/teacher-class/overview
 * 获取班级概览数据
 */
router.get('/overview', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    // 获取教师班级数
    const [classRows] = await pool.query(
      'SELECT COUNT(*) as total FROM elia_class WHERE teacher_id = ? AND class_status = "1"',
      [userId]
    );

    // 获取待审核申请数
    const [applicationRows] = await pool.query(
      `SELECT COUNT(*) as total
       FROM elia_class_application a
       JOIN elia_class c ON a.class_id = c.class_id
       WHERE c.teacher_id = ? AND a.application_status = '0'`,
      [userId]
    );

    // 获取平均完成率
    const [completionRows] = await pool.query(
      `SELECT AVG(CASE WHEN st.task_status = '2' THEN 100 ELSE 0 END) as avg_rate
       FROM elia_class c
       LEFT JOIN elia_class_member cm ON c.class_id = cm.class_id AND cm.member_status = '1'
       LEFT JOIN elia_student_task st ON cm.user_id = st.user_id AND cm.class_id = st.class_id
       WHERE c.teacher_id = ? AND c.class_status = '1'`,
      [userId]
    );

    return res.json({
      code: 200,
      data: {
        totalClasses: classRows[0].total || 0,
        avgCompletionRate: Math.round(completionRows[0].avg_rate || 0),
        pendingApplications: applicationRows[0].total || 0
      }
    });
  } catch (error) {
    console.error('获取班级概览错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-class/list
 * 获取班级列表（当前老师）
 */
router.get('/list', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { classLevel, pageNum = 1, pageSize = 100 } = req.query;

  try {
    let sql = `
      SELECT c.*, 
             (SELECT COUNT(*) FROM elia_class_application a WHERE a.class_id = c.class_id AND a.application_status = '0') as pending_application_count
      FROM elia_class c
      WHERE c.teacher_id = ? AND c.class_status = '1'
    `;
    let countSql = 'SELECT COUNT(*) as total FROM elia_class WHERE teacher_id = ? AND class_status = "1"';
    const params = [userId];
    const countParams = [userId];

    if (classLevel) {
      sql += ' AND c.class_level = ?';
      countSql += ' AND class_level = ?';
      params.push(classLevel);
      countParams.push(classLevel);
    }

    // 获取总数
    const [countRows] = await pool.query(countSql, countParams);
    const total = countRows[0].total;

    // 分页
    const offset = (parseInt(pageNum) - 1) * parseInt(pageSize);
    sql += ' ORDER BY c.create_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [rows] = await pool.query(sql, params);

    const list = rows.map(c => ({
      classId: c.class_id,
      className: c.class_name,
      classLevel: c.class_level,
      currentStudents: c.current_students || 0,
      maxStudents: c.max_students,
      taskCount: c.task_requirement || 0,
      createTime: c.create_time,
      pendingApplicationCount: c.pending_application_count || 0,
      teacherId: c.teacher_id
    }));

    return res.json({ code: 200, rows: list, total });
  } catch (error) {
    console.error('获取班级列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-class/all
 * 获取所有班级列表（管理员用）
 */
router.get('/all', authMiddleware, async (req, res) => {
  const { classLevel, teacherId, pageNum = 1, pageSize = 100 } = req.query;

  try {
    let sql = `
      SELECT c.*, u.nick_name as teacher_name
      FROM elia_class c
      LEFT JOIN sys_user u ON c.teacher_id = u.user_id
      WHERE c.class_status = '1'
    `;
    let countSql = 'SELECT COUNT(*) as total FROM elia_class WHERE class_status = "1"';
    const params = [];
    const countParams = [];

    if (classLevel) {
      sql += ' AND c.class_level = ?';
      countSql += ' AND class_level = ?';
      params.push(classLevel);
      countParams.push(classLevel);
    }

    if (teacherId) {
      sql += ' AND c.teacher_id = ?';
      countSql += ' AND teacher_id = ?';
      params.push(teacherId);
      countParams.push(teacherId);
    }

    // 获取总数
    const [countRows] = await pool.query(countSql, countParams);
    const total = countRows[0].total;

    // 分页
    const offset = (parseInt(pageNum) - 1) * parseInt(pageSize);
    sql += ' ORDER BY c.create_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [rows] = await pool.query(sql, params);

    const list = rows.map(c => ({
      classId: c.class_id,
      className: c.class_name,
      classLevel: c.class_level,
      currentStudents: c.current_students || 0,
      maxStudents: c.max_students,
      taskCount: c.task_requirement || 0,
      createTime: c.create_time,
      teacherId: c.teacher_id,
      teacherName: c.teacher_name
    }));

    return res.json({ code: 200, rows: list, total });
  } catch (error) {
    console.error('获取所有班级列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/teacher-class/create
 * 创建班级（需管理员审核）
 */
router.post('/create', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { className, classLevel, maxStudents, taskRequirement, classDescription } = req.body;

  if (!className || !classLevel || !maxStudents) {
    return res.json({ code: 400, msg: '缺少必要参数' });
  }

  try {
    // 生成班级编码
    const classCode = `${classLevel}${Date.now().toString().slice(-6)}`;

    const [result] = await pool.query(
      `INSERT INTO elia_class 
       (class_name, class_code, class_level, teacher_id, class_description, max_students, current_students, task_requirement, class_status, create_time)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, '0', NOW())`,
      [className, classCode, classLevel, userId, classDescription || '', maxStudents, taskRequirement || 0]
    );

    return res.json({
      code: 200,
      msg: '班级创建成功，等待管理员审核',
      data: {
        classId: result.insertId,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('创建班级错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-class/pending
 * 获取待审核班级列表（管理员用）
 */
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.nick_name as teacher_name
       FROM elia_class c
       LEFT JOIN sys_user u ON c.teacher_id = u.user_id
       WHERE c.class_status = '0'
       ORDER BY c.create_time DESC`
    );

    const list = rows.map(c => ({
      classId: c.class_id,
      className: c.class_name,
      classLevel: c.class_level,
      maxStudents: c.max_students,
      taskCount: c.task_requirement || 0,
      createTime: c.create_time,
      teacherId: c.teacher_id,
      teacherName: c.teacher_name
    }));

    return res.json({ code: 200, data: list });
  } catch (error) {
    console.error('获取待审核班级列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/teacher-class/approve/:classId
 * 审核通过班级
 */
router.post('/approve/:classId', authMiddleware, async (req, res) => {
  const classId = parseInt(req.params.classId);

  try {
    const [result] = await pool.query(
      'UPDATE elia_class SET class_status = "1" WHERE class_id = ? AND class_status = "0"',
      [classId]
    );

    if (result.affectedRows === 0) {
      return res.json({ code: 404, msg: '待审核班级不存在' });
    }

    return res.json({ code: 200, msg: '班级审核通过' });
  } catch (error) {
    console.error('审核班级错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/teacher-class/reject/:classId
 * 拒绝班级
 */
router.post('/reject/:classId', authMiddleware, async (req, res) => {
  const classId = parseInt(req.params.classId);

  try {
    const [result] = await pool.query(
      'DELETE FROM elia_class WHERE class_id = ? AND class_status = "0"',
      [classId]
    );

    if (result.affectedRows === 0) {
      return res.json({ code: 404, msg: '待审核班级不存在' });
    }

    return res.json({ code: 200, msg: '班级已拒绝' });
  } catch (error) {
    console.error('拒绝班级错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-class/applications
 * 获取待审核的入班申请列表
 */
router.get('/applications', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { status = '0', pageNum = 1, pageSize = 20 } = req.query;

  try {
    const [rows] = await pool.query(
      `SELECT a.*, c.class_name, u.nick_name as applicant_name, u.user_name as applicant_username
       FROM elia_class_application a
       JOIN elia_class c ON a.class_id = c.class_id
       JOIN sys_user u ON a.applicant_id = u.user_id
       WHERE c.teacher_id = ? AND a.application_type = '1' AND a.application_status = ?
       ORDER BY a.create_time DESC
       LIMIT ? OFFSET ?`,
      [userId, status, parseInt(pageSize), (parseInt(pageNum) - 1) * parseInt(pageSize)]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM elia_class_application a
       JOIN elia_class c ON a.class_id = c.class_id
       WHERE c.teacher_id = ? AND a.application_type = '1' AND a.application_status = ?`,
      [userId, status]
    );

    return res.json({
      code: 200,
      data: {
        list: rows,
        total: countResult[0].total,
        pageNum: parseInt(pageNum),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取入班申请列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/teacher-class/applications/:applicationId/approve
 * 审核通过入班申请
 */
router.post('/applications/:applicationId/approve', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const applicationId = parseInt(req.params.applicationId);

  try {
    // 查找申请并验证权限
    const [appRows] = await pool.query(
      `SELECT a.*, c.class_name, c.teacher_id
       FROM elia_class_application a
       JOIN elia_class c ON a.class_id = c.class_id
       WHERE a.application_id = ? AND a.application_type = '1' AND a.application_status = '0'`,
      [applicationId]
    );

    if (appRows.length === 0) {
      return res.json({ code: 404, msg: '入班申请不存在或已处理' });
    }

    if (appRows[0].teacher_id !== userId) {
      return res.json({ code: 403, msg: '无权操作此申请' });
    }

    const application = appRows[0];
    const { class_id: classId, applicant_id: applicantId } = application;

    // 检查学生是否已在该班级（任何状态）
    const [memberRows] = await pool.query(
      'SELECT * FROM elia_class_member WHERE class_id = ? AND user_id = ?',
      [classId, applicantId]
    );

    if (memberRows.length > 0) {
      if (memberRows[0].member_status === '1') {
        // 拒绝申请
        await pool.query(
          'UPDATE elia_class_application SET application_status = "2", update_time = NOW() WHERE application_id = ?',
          [applicationId]
        );
        return res.json({ code: 400, msg: '该学生已在班级中' });
      }
      // 如果是已离开的成员，重新激活
      await pool.query(
        'UPDATE elia_class_member SET member_status = "1", join_time = NOW() WHERE class_id = ? AND user_id = ?',
        [classId, applicantId]
      );
    } else {
      // 添加学生到班级
      await pool.query(
        `INSERT INTO elia_class_member (class_id, user_id, join_time, member_status, completed_tasks, total_study_time, create_time)
         VALUES (?, ?, NOW(), '1', 0, 0, NOW())`,
        [classId, applicantId]
      );
    }

    // 更新班级人数
    await pool.query(
      'UPDATE elia_class SET current_students = current_students + 1 WHERE class_id = ?',
      [classId]
    );

    // 更新用户当前班级
    await pool.query(
      'UPDATE sys_user SET current_class_id = ?, join_class_time = NOW() WHERE user_id = ?',
      [classId, applicantId]
    );

    // 更新申请状态为通过
    await pool.query(
      'UPDATE elia_class_application SET application_status = "1", update_time = NOW() WHERE application_id = ?',
      [applicationId]
    );

    return res.json({ code: 200, msg: '已通过入班申请' });
  } catch (error) {
    console.error('审核通过入班申请错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/teacher-class/applications/:applicationId/reject
 * 拒绝入班申请
 */
router.post('/applications/:applicationId/reject', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const applicationId = parseInt(req.params.applicationId);
  const { reason } = req.body;

  try {
    // 查找申请并验证权限
    const [appRows] = await pool.query(
      `SELECT a.*, c.teacher_id
       FROM elia_class_application a
       JOIN elia_class c ON a.class_id = c.class_id
       WHERE a.application_id = ? AND a.application_type = '1' AND a.application_status = '0'`,
      [applicationId]
    );

    if (appRows.length === 0) {
      return res.json({ code: 404, msg: '入班申请不存在或已处理' });
    }

    if (appRows[0].teacher_id !== userId) {
      return res.json({ code: 403, msg: '无权操作此申请' });
    }

    // 更新申请状态为拒绝
    await pool.query(
      'UPDATE elia_class_application SET application_status = "2", update_time = NOW() WHERE application_id = ?',
      [applicationId]
    );

    return res.json({ code: 200, msg: '已拒绝入班申请' });
  } catch (error) {
    console.error('拒绝入班申请错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * DELETE /api/teacher-class/delete/:classId
 * 删除班级
 */
router.delete('/delete/:classId', authMiddleware, async (req, res) => {
  const classId = parseInt(req.params.classId);

  try {
    // 检查班级是否有学生
    const [memberRows] = await pool.query(
      'SELECT COUNT(*) as count FROM elia_class_member WHERE class_id = ? AND member_status = "1"',
      [classId]
    );

    if (memberRows[0].count > 0) {
      return res.json({ code: 400, msg: '班级中还有学生，无法删除' });
    }

    const [result] = await pool.query(
      'DELETE FROM elia_class WHERE class_id = ?',
      [classId]
    );

    if (result.affectedRows === 0) {
      return res.json({ code: 404, msg: '班级不存在' });
    }

    return res.json({ code: 200, msg: '班级删除成功' });
  } catch (error) {
    console.error('删除班级错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/teacher-class/publish-task
 * 发布任务
 */
router.post('/publish-task', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { classId, taskName, taskType, startTime, deadline, questions, taskDescription } = req.body;

  if (!classId || !taskName || !taskType || !startTime || !deadline || !questions) {
    return res.json({ code: 400, msg: '缺少必要参数' });
  }

  try {
    // 验证班级是否存在且属于当前教师
    const [classRows] = await pool.query(
      'SELECT * FROM elia_class WHERE class_id = ? AND teacher_id = ? AND class_status = "1"',
      [classId, userId]
    );

    if (classRows.length === 0) {
      return res.json({ code: 404, msg: '班级不存在或无权限' });
    }

    const classInfo = classRows[0];

    // 创建任务
    const [taskResult] = await pool.query(
      `INSERT INTO elia_task 
       (task_name, task_type, class_id, class_level, teacher_id, task_description, question_count, start_time, end_time, task_status, is_published, publish_time, create_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '1', '1', NOW(), NOW())`,
      [taskName, taskType, classId, classInfo.class_level, userId, taskDescription || '', questions.length, startTime, deadline]
    );

    const taskId = taskResult.insertId;

    // 插入题目
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      // 支持多种字段名
      const questionType = q.type || q.questionType;
      const questionContent = q.content || q.questionContent || q.text || q.stem;
      const questionOptions = q.options || q.questionOptions;
      const correctAnswer = q.correctAnswer || q.answer;
      const correctIndexes = q.correctIndexes || q.correctAnswer;
      
      // 验证题目必填字段
      if (!questionContent) {
        return res.json({ code: 400, msg: `第${i + 1}题题目内容不能为空` });
      }
      if (!correctAnswer) {
        return res.json({ code: 400, msg: `第${i + 1}题答案不能为空` });
      }
      
      // 处理选项：可能是字符串或对象
      let optionsValue = null;
      if (questionOptions) {
        if (typeof questionOptions === 'string') {
          optionsValue = questionOptions; // 已经是JSON字符串
        } else {
          optionsValue = JSON.stringify(questionOptions);
        }
      }
      
      // 处理答案：选择题用correctIndexes，其他用correctAnswer
      let answerValue;
      const isChoice = questionType === '1' || questionType === 'choice' || questionType === 1;
      if (isChoice) {
        // 选择题：支持数组 ["A","B"]、逗号分隔字符串 "A,B"、或单个值 "A"
        let answerArray = [];
        if (typeof correctIndexes === 'string') {
          // 逗号分隔如 "A,C" 转为数组 ["A","C"]
          if (correctIndexes.includes(',')) {
            answerArray = correctIndexes.split(',').map(s => s.trim());
          } else {
            answerArray = [correctIndexes];
          }
        } else if (Array.isArray(correctIndexes)) {
          answerArray = correctIndexes;
        }
        answerValue = JSON.stringify(answerArray);
      } else {
        answerValue = correctAnswer;
      }
      
      // 转换题目类型
      let dbQuestionType;
      if (questionType === '1' || questionType === 1 || questionType === 'choice') {
        dbQuestionType = '1';
      } else if (questionType === '2' || questionType === 2 || questionType === 'spell') {
        dbQuestionType = '2';
      } else {
        dbQuestionType = '3';
      }
      
      await pool.query(
        `INSERT INTO elia_task_question 
         (task_id, question_type, question_content, correct_answer, options, score, difficulty_level, sort_order, create_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          taskId,
          dbQuestionType,
          questionContent,
          answerValue,
          optionsValue,
          q.score || 10,
          q.difficultyLevel || 1,
          i + 1
        ]
      );
    }

    // 为班级所有学生创建任务记录
    const [memberRows] = await pool.query(
      'SELECT user_id FROM elia_class_member WHERE class_id = ? AND member_status = "1"',
      [classId]
    );

    if (memberRows.length > 0) {
      const now = new Date();
      const taskRecords = memberRows.map(m => [m.user_id, taskId, classId, '0', now]);
      await pool.query(
        `INSERT INTO elia_student_task (user_id, task_id, class_id, task_status, create_time) VALUES ?`,
        [taskRecords]
      );
    }

    return res.json({
      code: 200,
      msg: '任务发布成功',
      data: { taskId }
    });
  } catch (error) {
    console.error('发布任务错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
