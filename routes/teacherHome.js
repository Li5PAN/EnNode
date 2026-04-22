const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// 配置 multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// 获取当前用户ID
const getUserId = (req) => {
  return req.user?.id || 1;
};

/**
 * GET /api/teacher-home/dashboard
 * 获取教师仪表盘数据（顶部概览）
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    // 获取教师班级数
    const [classRows] = await pool.query(
      'SELECT COUNT(*) as total FROM elia_class WHERE teacher_id = ? AND class_status = "1"',
      [userId]
    );

    // 获取班级学生总数
    const [studentRows] = await pool.query(
      `SELECT COUNT(DISTINCT cm.user_id) as total
       FROM elia_class_member cm
       JOIN elia_class c ON cm.class_id = c.class_id
       WHERE c.teacher_id = ? AND cm.member_status = '1'`,
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

    // 获取待处理任务数
    const [taskRows] = await pool.query(
      `SELECT COUNT(*) as total
       FROM elia_task t
       JOIN elia_student_task st ON t.task_id = st.task_id
       WHERE t.teacher_id = ? AND st.task_status = '0' AND t.end_time > NOW()`,
      [userId]
    );

    return res.json({
      code: 200,
      data: {
        totalStudents: studentRows[0].total || 0,
        totalClasses: classRows[0].total || 0,
        pendingApplications: applicationRows[0].total || 0,
        pendingTasks: taskRows[0].total || 0
      }
    });
  } catch (error) {
    console.error('获取教师仪表盘数据错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-home/level-distribution
 * 获取班级等级分布
 */
router.get('/level-distribution', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      `SELECT class_level, COUNT(*) as classCount
       FROM elia_class
       WHERE teacher_id = ? AND class_status = '1'
       GROUP BY class_level
       ORDER BY class_level ASC`,
      [userId]
    );

    const data = rows.map(r => ({
      classLevel: r.class_level,
      classCount: r.classCount
    }));

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取班级等级分布错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-home/task-completion
 * 获取各班级任务完成率对比
 */
router.get('/task-completion', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      `SELECT c.class_name, 
              AVG(CASE WHEN st.task_status = '2' THEN 100 ELSE 0 END) as completion_rate
       FROM elia_class c
       LEFT JOIN elia_class_member cm ON c.class_id = cm.class_id AND cm.member_status = '1'
       LEFT JOIN elia_student_task st ON cm.user_id = st.user_id AND cm.class_id = st.class_id
       WHERE c.teacher_id = ? AND c.class_status = '1'
       GROUP BY c.class_id, c.class_name
       ORDER BY c.class_level ASC`,
      [userId]
    );

    return res.json({
      code: 200,
      data: {
        classNames: rows.map(r => r.class_name),
        completionRates: rows.map(r => Math.round(r.completion_rate || 0))
      }
    });
  } catch (error) {
    console.error('获取任务完成率对比错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-home/activity-trend
 * 获取学生活跃度趋势（最近7天）
 */
router.get('/activity-trend', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      `SELECT DAYNAME(lr.record_date) as day_name,
              SUM(lr.tasks_completed) as completedTasks,
              SUM(lr.words_studied) as exercises
       FROM elia_learning_record lr
       JOIN elia_class_member cm ON lr.user_id = cm.user_id
       JOIN elia_class c ON cm.class_id = c.class_id
       WHERE c.teacher_id = ? AND lr.record_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY lr.record_date, DAYNAME(lr.record_date)
       ORDER BY lr.record_date ASC`,
      [userId]
    );

    const dayMap = {
      'Monday': '周一', 'Tuesday': '周二', 'Wednesday': '周三',
      'Thursday': '周四', 'Friday': '周五', 'Saturday': '周六', 'Sunday': '周日'
    };

    return res.json({
      code: 200,
      data: {
        days: rows.map(r => dayMap[r.day_name] || r.day_name),
        completedTasks: rows.map(r => r.completedTasks || 0),
        exercises: rows.map(r => r.exercises || 0)
      }
    });
  } catch (error) {
    console.error('获取学生活跃度趋势错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-home/error-type-distribution
 * 获取错题类型分布
 */
router.get('/error-type-distribution', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      `SELECT w.question_type, COUNT(*) as count
       FROM elia_wrong_question w
       JOIN elia_class_member cm ON w.user_id = cm.user_id
       JOIN elia_class c ON cm.class_id = c.class_id
       WHERE c.teacher_id = ?
       GROUP BY w.question_type`,
      [userId]
    );

    const typeMap = { '1': '选择题', '2': '单词拼写', '3': '填空题' };
    const data = rows.map(r => ({
      type: typeMap[r.question_type] || r.question_type,
      count: r.count
    }));

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取错题类型分布错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-home/task/list
 * 获取任务列表（支持班级等级筛选）
 */
router.get('/task/list', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { classLevel, pageNum = 1, pageSize = 10 } = req.query;

  try {
    let sql = `
      SELECT t.*, c.class_name, c.class_level,
             (SELECT COUNT(*) FROM elia_student_task WHERE task_id = t.task_id) as total_students,
             (SELECT COUNT(*) FROM elia_student_task WHERE task_id = t.task_id AND task_status = '2') as completed_count
      FROM elia_task t
      JOIN elia_class c ON t.class_id = c.class_id
      WHERE t.teacher_id = ?
    `;
    let countSql = 'SELECT COUNT(*) as total FROM elia_task t JOIN elia_class c ON t.class_id = c.class_id WHERE t.teacher_id = ?';
    const params = [userId];
    const countParams = [userId];

    if (classLevel) {
      sql += ' AND c.class_level = ?';
      countSql += ' AND c.class_level = ?';
      params.push(classLevel);
      countParams.push(classLevel);
    }

    // 获取总数
    const [countRows] = await pool.query(countSql, countParams);
    const total = countRows[0].total;

    // 分页
    const offset = (parseInt(pageNum) - 1) * parseInt(pageSize);
    sql += ' ORDER BY t.create_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [rows] = await pool.query(sql, params);

    const list = rows.map(t => ({
      id: t.task_id,
      taskName: t.task_name,
      classLevel: t.class_level,
      className: t.class_name,
      questionCount: t.question_count,
      startTime: t.start_time,
      deadline: t.end_time,
      completedCount: t.completed_count || 0,
      totalStudents: t.total_students || 0,
      createTime: t.create_time
    }));

    return res.json({ code: 200, rows: list, total });
  } catch (error) {
    console.error('获取任务列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-home/task/:taskId
 * 获取任务详情（包含题目列表）
 */
router.get('/task/:taskId', authMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);

  try {
    const [taskRows] = await pool.query(
      `SELECT t.*, c.class_name, c.class_level
       FROM elia_task t
       JOIN elia_class c ON t.class_id = c.class_id
       WHERE t.task_id = ?`,
      [taskId]
    );

    if (taskRows.length === 0) {
      return res.json({ code: 404, msg: '任务不存在' });
    }

    const task = taskRows[0];

    // 获取题目列表
    const [questionRows] = await pool.query(
      'SELECT * FROM elia_task_question WHERE task_id = ? ORDER BY sort_order ASC',
      [taskId]
    );

    const questions = questionRows.map(q => {
      const question = {
        questionId: q.question_id,
        type: q.question_type === '1' ? 'choice' : (q.question_type === '2' ? 'spell' : 'fill-blank'),
        content: q.question_content,
        score: q.score
      };

      if (q.question_type === '1') {
        // 选择题：解析选项对象 {"A":"选项内容","B":"选项内容"}
        try {
          question.options = q.options ? JSON.parse(q.options) : {};
        } catch (e) {
          question.options = {};
        }
        // 解析正确答案数组 ["A","B"]
        try {
          const correctArr = q.correct_answer ? JSON.parse(q.correct_answer) : [];
          question.correctIndexes = correctArr;
          // 同时返回正确答案内容
          question.correctAnswer = correctArr.map(idx => question.options[idx] || idx).join(',');
        } catch (e) {
          question.correctIndexes = [];
          question.correctAnswer = '';
        }
      } else {
        question.answer = q.correct_answer;
      }

      return question;
    });

    return res.json({
      code: 200,
      data: {
        id: task.task_id,
        taskName: task.task_name,
        classLevel: task.class_level,
        className: task.class_name,
        questionCount: task.question_count,
        startTime: task.start_time,
        deadline: task.end_time,
        createTime: task.create_time,
        questions
      }
    });
  } catch (error) {
    console.error('获取任务详情错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/teacher-home/task/:taskId/remind
 * 督促学生完成任务
 */
router.post('/task/:taskId/remind', authMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const userId = getUserId(req);

  try {
    // 获取任务信息
    const [taskRows] = await pool.query(
      `SELECT t.*, c.class_name
       FROM elia_task t
       JOIN elia_class c ON t.class_id = c.class_id
       WHERE t.task_id = ? AND t.teacher_id = ?`,
      [taskId, userId]
    );

    if (taskRows.length === 0) {
      return res.json({ code: 404, msg: '任务不存在' });
    }

    // 获取未完成学生数
    const [studentRows] = await pool.query(
      `SELECT COUNT(*) as count FROM elia_student_task WHERE task_id = ? AND task_status != '2'`,
      [taskId]
    );

    const notCompletedCount = studentRows[0].count;

    // 记录督促日志
    await pool.query(
      `INSERT INTO elia_task_reminder (task_id, reminder_type, reminder_time, reminded_by, reminder_content, create_time)
       VALUES (?, '1', NOW(), ?, '请尽快完成任务', NOW())`,
      [taskId, userId]
    );

    return res.json({
      code: 200,
      msg: `督促提醒已发送至 ${notCompletedCount} 位未完成作业的学生`
    });
  } catch (error) {
    console.error('督促学生错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-home/error/list
 * 获取错题列表（支持搜索筛选）
 */
router.get('/error/list', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { startDate, endDate, questionType, classLevel, pageNum = 1, pageSize = 10 } = req.query;

  try {
    // 获取教师创建的所有班级ID
    const [classRows] = await pool.query(
      'SELECT class_id FROM elia_class WHERE teacher_id = ? AND class_status = "1"',
      [userId]
    );
    const teacherClassIds = classRows.map(r => r.class_id);

    let sql = '';
    let countSql = '';
    const params = [];
    const countParams = [];

    if (teacherClassIds.length > 0) {
      const classPlaceholders = teacherClassIds.map(() => '?').join(',');
      
      // 查询学生在自己班级的错题 + 教师自己上传的错题
      sql = `
        SELECT w.*, t.task_name, c.class_level, q.question_content as q_content
        FROM elia_wrong_question w
        LEFT JOIN elia_task t ON w.task_id = t.task_id
        LEFT JOIN elia_class c ON w.class_id = c.class_id AND c.class_id > 0
        LEFT JOIN elia_task_question q ON w.question_id = q.question_id
        WHERE (w.class_id IN (${classPlaceholders}) OR w.user_id = ?)
      `;
      countSql = `
        SELECT COUNT(*) as total
        FROM elia_wrong_question w
        WHERE (w.class_id IN (${classPlaceholders}) OR w.user_id = ?)
      `;
      
      // 添加班级ID参数
      params.push(...teacherClassIds);
      params.push(userId);
      countParams.push(...teacherClassIds);
      countParams.push(userId);
    } else {
      // 没有班级，只显示教师自己上传的错题
      sql = `
        SELECT w.*, t.task_name, c.class_level, q.question_content as q_content
        FROM elia_wrong_question w
        LEFT JOIN elia_task t ON w.task_id = t.task_id
        LEFT JOIN elia_class c ON w.class_id = c.class_id AND c.class_id > 0
        LEFT JOIN elia_task_question q ON w.question_id = q.question_id
        WHERE w.user_id = ?
      `;
      countSql = `
        SELECT COUNT(*) as total
        FROM elia_wrong_question w
        WHERE w.user_id = ?
      `;
      params.push(userId);
      countParams.push(userId);
    }

    if (startDate) {
      sql += ' AND DATE(w.create_time) >= ?';
      countSql += ' AND DATE(w.create_time) >= ?';
      params.push(startDate);
      countParams.push(startDate);
    }
    if (endDate) {
      sql += ' AND DATE(w.create_time) <= ?';
      countSql += ' AND DATE(w.create_time) <= ?';
      params.push(endDate);
      countParams.push(endDate);
    }
    if (questionType) {
      sql += ' AND w.question_type = ?';
      countSql += ' AND w.question_type = ?';
      params.push(questionType);
      countParams.push(questionType);
    }
    if (classLevel) {
      sql += ' AND c.class_level = ?';
      countSql += ' AND c.class_level = ?';
      params.push(classLevel);
      countParams.push(classLevel);
    }

    // 获取总数
    const [countRows] = await pool.query(countSql, countParams);
    const total = countRows[0].total;

    // 分页
    const offset = (parseInt(pageNum) - 1) * parseInt(pageSize);
    sql += ' ORDER BY w.create_time DESC LIMIT ? OFFSET ?';
    const listParams = [...params, parseInt(pageSize), offset];

    const [rows] = await pool.query(sql, listParams);

    const typeMap = { '1': '选择题', '2': '单词拼写', '3': '填空题' };
    const list = rows.map(r => ({
      questionId: r.wrong_id,
      questionType: r.question_type,
      questionContent: r.q_content || r.question_content || '',
      correctAnswer: r.correct_answer,
      wrongAnswer: r.student_answer,
      classLevel: r.class_level,
      wrongCount: r.wrong_count,
      taskName: r.task_name,
      createTime: r.create_time,
      mastered: r.is_mastered === '1'
    }));

    return res.json({ code: 200, rows: list, total });
  } catch (error) {
    console.error('获取错题列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-home/error/template
 * 下载错题导入模板
 */
router.get('/error/template', authMiddleware, async (req, res) => {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('错题导入模板');

  worksheet.columns = [
    { header: '题目类型(1选择题 2单词拼写 3填空题)', key: 'questionType', width: 20 },
    { header: '任务名称', key: 'taskName', width: 20 },
    { header: '错误日期', key: 'errorDate', width: 20 },
    { header: '题目内容', key: 'questionContent', width: 40 },
    { header: '正确答案', key: 'correctAnswer', width: 20 },
    { header: '学生答案', key: 'wrongAnswer', width: 20 },
    { header: '错误次数', key: 'wrongCount', width: 12 },
    { header: '是否已掌握(0未掌握 1已掌握)', key: 'mastered', width: 18 }
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.addRows([
    { questionType: 3, taskName: '定语从句专项练习', errorDate: '2026-03-11 17:28', questionContent: 'I still remember the days _____ we spent together.', correctAnswer: 'which', wrongAnswer: 'ex sed', wrongCount: 1, mastered: 0 },
    { questionType: 1, taskName: '词汇测试', errorDate: '2026-03-10 15:20', questionContent: "What is the antonym of 'beautiful'?", correctAnswer: 'C', wrongAnswer: 'A', wrongCount: 1, mastered: 0 },
    { questionType: 2, taskName: '单词拼写练习', errorDate: '2026-03-09 10:00', questionContent: '拼写单词：苹果', correctAnswer: 'apple', wrongAnswer: 'appple', wrongCount: 1, mastered: 0 }
  ]);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="error_template.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * GET /api/teacher-home/error/export
 * 导出错题（Excel/PDF）
 */
router.get('/error/export', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { format, questionIds, startDate, endDate, questionType, classLevel } = req.query;

  if (!format || !['excel', 'pdf'].includes(format)) {
    return res.json({ code: 400, msg: '请指定导出格式（excel/pdf）' });
  }

  try {
    // 获取教师创建的所有班级ID
    const [classRows] = await pool.query(
      'SELECT class_id FROM elia_class WHERE teacher_id = ? AND class_status = "1"',
      [userId]
    );
    const teacherClassIds = classRows.map(r => r.class_id);

    let sql = '';
    let params = [];

    // 如果指定了questionIds，优先使用
    if (questionIds) {
      const ids = questionIds.split(',').map(id => parseInt(id));
      sql = `
        SELECT w.*, t.task_name, c.class_level, q.question_content as q_content
        FROM elia_wrong_question w
        LEFT JOIN elia_task t ON w.task_id = t.task_id
        LEFT JOIN elia_class c ON w.class_id = c.class_id
        LEFT JOIN elia_task_question q ON w.question_id = q.question_id
        WHERE w.wrong_id IN (?)
      `;
      params = [ids];
    } else if (teacherClassIds.length > 0) {
      // 导出教师班级学生的错题 + 教师自己上传的错题
      const classPlaceholders = teacherClassIds.map(() => '?').join(',');
      sql = `
        SELECT w.*, t.task_name, c.class_level, q.question_content as q_content
        FROM elia_wrong_question w
        LEFT JOIN elia_task t ON w.task_id = t.task_id
        LEFT JOIN elia_class c ON w.class_id = c.class_id
        LEFT JOIN elia_task_question q ON w.question_id = q.question_id
        WHERE (w.class_id IN (${classPlaceholders}) OR w.user_id = ?)
      `;
      params = [...teacherClassIds, userId];

      if (startDate) {
        sql += ' AND DATE(w.create_time) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND DATE(w.create_time) <= ?';
        params.push(endDate);
      }
      if (questionType) {
        sql += ' AND w.question_type = ?';
        params.push(questionType);
      }
      if (classLevel) {
        sql += ' AND c.class_level = ?';
        params.push(classLevel);
      }
    } else {
      // 没有班级，只导出教师自己上传的错题
      sql = `
        SELECT w.*, t.task_name, c.class_level, q.question_content as q_content
        FROM elia_wrong_question w
        LEFT JOIN elia_task t ON w.task_id = t.task_id
        LEFT JOIN elia_class c ON w.class_id = c.class_id
        LEFT JOIN elia_task_question q ON w.question_id = q.question_id
        WHERE w.user_id = ?
      `;
      params = [userId];

      if (startDate) {
        sql += ' AND DATE(w.create_time) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND DATE(w.create_time) <= ?';
        params.push(endDate);
      }
      if (questionType) {
        sql += ' AND w.question_type = ?';
        params.push(questionType);
      }
    }

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res.json({ code: 400, msg: '暂无错题可导出' });
    }

    const typeMap = { '1': '选择题', '2': '单词拼写', '3': '填空题' };

    if (format === 'excel') {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('错题记录');

      worksheet.columns = [
        { header: '题目ID', key: 'questionId', width: 10 },
        { header: '题目类型', key: 'questionTypeName', width: 12 },
        { header: '题目内容', key: 'questionContent', width: 40 },
        { header: '正确答案', key: 'correctAnswer', width: 20 },
        { header: '学生答案', key: 'wrongAnswer', width: 20 },
        { header: '班级等级', key: 'classLevel', width: 12 },
        { header: '错误次数', key: 'wrongCount', width: 10 },
        { header: '任务名称', key: 'taskName', width: 20 },
        { header: '创建时间', key: 'createTime', width: 20 },
        { header: '是否已掌握', key: 'masteredName', width: 12 }
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      rows.forEach(r => {
        worksheet.addRow({
          questionId: r.wrong_id,
          questionTypeName: typeMap[r.question_type] || r.question_type,
          questionContent: r.q_content || r.question_content || '',
          correctAnswer: r.correct_answer,
          wrongAnswer: r.student_answer,
          classLevel: r.class_level,
          wrongCount: r.wrong_count,
          taskName: r.task_name,
          createTime: r.create_time,
          masteredName: r.is_mastered === '1' ? '已掌握' : '未掌握'
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="error_export.xlsx"');

      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

      const fontPath = path.join(__dirname, '../fonts/NotoSansSC-Regular.otf');
      doc.registerFont('Chinese', fontPath);
      doc.font('Chinese');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="error_export.pdf"');

      doc.pipe(res);

      doc.fontSize(18).text('错题记录', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
      doc.moveDown();

      const headers = ['ID', '类型', '题目内容', '正确答案', '学生答案', '班级', '错误次数', '任务名称', '创建时间', '掌握'];
      const colWidths = [30, 50, 100, 50, 50, 40, 40, 60, 60, 40];
      let y = doc.y;
      let x = 30;

      doc.fontSize(9);
      headers.forEach((header, i) => {
        doc.text(header, x, y, { width: colWidths[i], align: 'center' });
        x += colWidths[i];
      });

      doc.moveDown();
      y = doc.y;
      doc.fontSize(8);

      rows.forEach(item => {
        x = 30;
        const row = [
          String(item.wrong_id),
          typeMap[item.question_type] || item.question_type,
          (item.q_content || item.question_content || '').substring(0, 20),
          item.correct_answer || '',
          item.student_answer || '',
          item.class_level || '',
          String(item.wrong_count),
          (item.task_name || '').substring(0, 10),
          (item.create_time || '').substring(0, 10),
          item.is_mastered === '1' ? '已掌握' : '未掌握'
        ];

        row.forEach((cell, i) => {
          doc.text(cell, x, y, { width: colWidths[i] });
          x += colWidths[i];
        });
        y += 15;
        if (y > 550) { doc.addPage(); y = 30; }
      });

      doc.end();
    }
  } catch (error) {
    console.error('导出错题错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/teacher-home/error/import
 * 导入错题（Excel文件）
 */
router.post('/error/import', authMiddleware, upload.single('file'), async (req, res) => {
  const { file } = req;
  const userId = getUserId(req);

  if (!file) {
    return res.json({ code: 400, msg: '请上传文件' });
  }

  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);

    const importedData = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const values = row.values;
      const questionType = values[1];
      const questionContent = values[4];
      if (!questionType || !questionContent) return;

      importedData.push({
        questionType: String(questionType),
        questionContent,
        correctAnswer: values[5] || '',
        wrongAnswer: values[6] || '',
        wrongCount: values[7] || 1,
        mastered: values[8] === 1,
        taskName: values[2] || '',
        classLevel: values[3] || ''
      });
    });

    // 插入到数据库
    let successCount = 0;
    for (const item of importedData) {
      // 查找任务ID
      let taskId = null;
      if (item.taskName) {
        const [taskRows] = await pool.query(
          'SELECT task_id FROM elia_task WHERE task_name = ? LIMIT 1',
          [item.taskName]
        );
        if (taskRows.length > 0) {
          taskId = taskRows[0].task_id;
        }
      }

      // 查找班级ID
      let classId = 0;
      if (item.classLevel) {
        const [classRows] = await pool.query(
          'SELECT class_id FROM elia_class WHERE class_level = ? AND teacher_id = ? LIMIT 1',
          [item.classLevel, userId]
        );
        if (classRows.length > 0) {
          classId = classRows[0].class_id;
        }
      }

      // 插入错题记录
      // 生成唯一的 question_id 和 task_id（使用时间戳+随机数）
      const questionId = Date.now() + Math.floor(Math.random() * 1000);
      const insertTaskId = taskId || (Date.now() + Math.floor(Math.random() * 1000));
      await pool.query(
        `INSERT INTO elia_wrong_question 
         (user_id, task_id, question_id, class_id, question_type, question_content, correct_answer, student_answer, wrong_count, is_mastered, create_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [userId, insertTaskId, questionId, classId || 0, item.questionType, item.questionContent, item.correctAnswer, item.wrongAnswer, item.wrongCount, item.mastered ? '1' : '0']
      );
      successCount++;
    }

    return res.json({
      code: 200,
      msg: `成功导入 ${successCount} 条错题记录`,
      data: { importCount: successCount }
    });
  } catch (error) {
    console.error('导入错误:', error);
    return res.json({ code: 500, msg: '文件解析失败，请检查文件格式' });
  }
});

/**
 * POST /api/teacher-home/error/batch-delete
 * 批量删除错题
 */
router.post('/error/batch-delete', authMiddleware, async (req, res) => {
  const { questionIds } = req.body;

  if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
    return res.json({ code: 400, msg: '请选择要删除的错题' });
  }

  try {
    const [result] = await pool.query(
      'DELETE FROM elia_wrong_question WHERE wrong_id IN (?)',
      [questionIds]
    );

    return res.json({
      code: 200,
      msg: `成功删除 ${result.affectedRows} 条错题记录`
    });
  } catch (error) {
    console.error('批量删除错题错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/teacher-home/error/:questionId
 * 获取错题详情
 */
router.get('/error/:questionId', authMiddleware, async (req, res) => {
  const questionId = parseInt(req.params.questionId);

  try {
    const [rows] = await pool.query(
      `SELECT w.*, t.task_name, c.class_level, q.question_content as q_content, q.options as q_options
       FROM elia_wrong_question w
       LEFT JOIN elia_task t ON w.task_id = t.task_id
       LEFT JOIN elia_class c ON w.class_id = c.class_id
       LEFT JOIN elia_task_question q ON w.question_id = q.question_id
       WHERE w.wrong_id = ?`,
      [questionId]
    );

    if (rows.length === 0) {
      return res.json({ code: 404, msg: '错题记录不存在' });
    }

    const r = rows[0];
    const typeMap = { '1': '选择题', '2': '单词拼写', '3': '填空题' };

    // 解析选项
    let options = [];
    if (r.q_options) {
      try {
        const optionsObj = JSON.parse(r.q_options);
        options = Object.entries(optionsObj).map(([key, value]) => ({
          key,
          value
        }));
      } catch (e) {
        options = [];
      }
    }

    return res.json({
      code: 200,
      data: {
        questionId: r.wrong_id,
        questionType: r.question_type,
        questionTypeName: typeMap[r.question_type] || r.question_type,
        questionContent: r.q_content || r.question_content || '',
        options: options,
        correctAnswer: r.correct_answer,
        wrongAnswer: r.student_answer,
        classLevel: r.class_level,
        wrongCount: r.wrong_count,
        taskName: r.task_name,
        createTime: r.create_time,
        errorDate: r.create_time ? r.create_time.toISOString().split('T')[0] : '',
        mastered: r.is_mastered === '1'
      }
    });
  } catch (error) {
    console.error('获取错题详情错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * DELETE /api/teacher-home/error/:questionId
 * 删除单条错题
 */
router.delete('/error/:questionId', authMiddleware, async (req, res) => {
  const questionId = parseInt(req.params.questionId);

  try {
    const [result] = await pool.query(
      'DELETE FROM elia_wrong_question WHERE wrong_id = ?',
      [questionId]
    );

    if (result.affectedRows === 0) {
      return res.json({ code: 404, msg: '错题记录不存在' });
    }

    return res.json({ code: 200, msg: '删除成功' });
  } catch (error) {
    console.error('删除错题错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
