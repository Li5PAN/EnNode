const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// 获取当前用户ID
const getUserId = (req) => {
  return req.user?.id || 1;
};

// 任务状态映射
const getTaskStatusText = (status) => {
  const map = { '0': '未完成', '1': '进行中', '2': '已完成' };
  return map[status] || status;
};

const getTaskStatusColor = (status) => {
  const map = { '0': 'orange', '1': 'blue', '2': 'green' };
  return map[status] || 'default';
};

// 任务类型映射
const getTaskTypeText = (type) => {
  const map = { '1': '日常练习', '2': '单元测试', '3': '期中考试', '4': '期末考试', '5': '专项练习' };
  return map[type] || type;
};

const getTaskTypeColor = (type) => {
  const map = { '1': 'blue', '2': 'purple', '3': 'red', '4': 'magenta', '5': 'cyan' };
  return map[type] || 'default';
};

/**
 * GET /api/student-tasks/list
 * 获取学生任务列表（未完成/已完成）
 * query: status (pending/completed), pageNum, pageSize
 * 
 * 业务规则：
 * - 未完成任务：只能查看当前班级的任务（但排除已完成的任务）
 * - 已完成任务：可以查看当前班级和历史班级的任务
 * - 只能做当前班级的任务，历史班级任务只能查看
 */
router.get('/list', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { status = 'pending', pageNum = 1, pageSize = 10 } = req.query;

  try {
    // 获取用户当前班级
    const [memberRows] = await pool.query(
      'SELECT class_id FROM elia_class_member WHERE user_id = ? AND member_status = "1"',
      [userId]
    );

    const currentClassId = memberRows.length > 0 ? memberRows[0].class_id : null;

    // 获取用户所有加入过的班级（包括当前班级和历史班级）
    const [allClassRows] = await pool.query(
      'SELECT class_id FROM elia_class_member WHERE user_id = ?',
      [userId]
    );
    const allClassIds = allClassRows.map(r => r.class_id);

    let sql = '';
    let countSql = '';
    let params = [];

    if (status === 'pending') {
      // 未完成任务：只显示当前班级的未完成任务
      if (!currentClassId) {
        // 没有加入班级，返回空列表
        return res.json({ code: 200, rows: [], total: 0 });
      }

      sql = `
        SELECT t.task_id, t.task_name, t.task_type, t.start_time, t.end_time, t.question_count,
               st.task_status,
               c.class_name, c.class_level,
               (SELECT COUNT(*) FROM elia_student_task WHERE task_id = t.task_id AND task_status = '2') as completed_count,
               (SELECT COUNT(*) FROM elia_student_task WHERE task_id = t.task_id) as total_count
        FROM elia_task t
        JOIN elia_class c ON t.class_id = c.class_id
        LEFT JOIN elia_student_task st ON t.task_id = st.task_id AND st.user_id = ?
        WHERE t.end_time > NOW()
        AND t.class_id = ?
      `;
      countSql = `
        SELECT COUNT(*) as total
        FROM elia_task t
        JOIN elia_class c ON t.class_id = c.class_id
        LEFT JOIN elia_student_task st ON t.task_id = st.task_id AND st.user_id = ?
        WHERE t.end_time > NOW()
        AND t.class_id = ?
      `;
      // count查询只需要2个参数
      countParams = [userId, currentClassId];
      // list查询需要2个参数 + 分页2个
      listParams = [userId, currentClassId];

      // 排除已完成的任务
      sql += ' AND (st.task_status IS NULL OR st.task_status != "2")';
      countSql += ' AND (st.task_status IS NULL OR st.task_status != "2")';

      sql += ' ORDER BY t.end_time ASC';
    } else {
      // 已完成任务：可以查看当前班级和历史班级的任务
      if (allClassIds.length === 0) {
        return res.json({ code: 200, rows: [], total: 0 });
      }

      const placeholders = allClassIds.map(() => '?').join(',');

      sql = `
        SELECT t.task_id, t.task_name, t.task_type, t.start_time, t.end_time, t.question_count,
               st.task_status,
               c.class_name, c.class_level,
               (SELECT COUNT(*) FROM elia_student_task WHERE task_id = t.task_id AND task_status = '2') as completed_count,
               (SELECT COUNT(*) FROM elia_student_task WHERE task_id = t.task_id) as total_count
        FROM elia_task t
        JOIN elia_class c ON t.class_id = c.class_id
        JOIN elia_student_task st ON t.task_id = st.task_id AND st.user_id = ?
        WHERE st.task_status = '2'
        AND t.class_id IN (${placeholders})
      `;
      countSql = `
        SELECT COUNT(*) as total
        FROM elia_task t
        JOIN elia_student_task st ON t.task_id = st.task_id AND st.user_id = ?
        WHERE st.task_status = '2'
        AND t.class_id IN (${placeholders})
      `;
      // count查询只需要 userId + classIds
      countParams = [userId, ...allClassIds];
      // list查询需要 userId + classIds
      listParams = [userId, ...allClassIds];

      sql += ' ORDER BY t.end_time DESC';
    }

    // 获取总数
    const [countRows] = await pool.query(countSql, countParams);
    const total = countRows[0].total;

    // 分页
    const offset = (parseInt(pageNum) - 1) * parseInt(pageSize);
    sql += ' LIMIT ? OFFSET ?';
    const finalParams = [...listParams, parseInt(pageSize), offset];

    const [rows] = await pool.query(sql, finalParams);

    const list = rows.map(r => ({
      taskId: r.task_id,
      taskName: r.task_name,
      taskType: r.task_type,
      taskTypeText: getTaskTypeText(r.task_type),
      taskStatus: r.task_status || '0',
      startTime: r.start_time ? r.start_time.toISOString().slice(0, 16).replace('T', ' ') : '',
      endTime: r.end_time ? r.end_time.toISOString().slice(0, 16).replace('T', ' ') : '',
      questionCount: r.question_count,
      score: 0,
      isPassed: false,
      submitTime: '',
      className: r.class_name,
      classLevel: r.class_level,
      completedCount: r.completed_count || 0,
      totalStudents: r.total_count || 0,
      isCurrentClass: true,
      isExpired: new Date(r.end_time) < new Date()
    }));

    return res.json({ code: 200, rows: list, total });
  } catch (error) {
    console.error('获取任务列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-tasks/:taskId
 * 获取任务详情（包含题目列表，用于做题）
 * 
 * 业务规则：
 * - 只能获取当前班级任务详情（用于做题）
 * - 历史班级任务只能查看结果，不能再做
 */
router.get('/:taskId', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const taskId = parseInt(req.params.taskId);

  try {
    // 获取任务信息
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

    // 获取用户当前班级
    const [memberRows] = await pool.query(
      'SELECT class_id FROM elia_class_member WHERE user_id = ? AND member_status = "1"',
      [userId]
    );

    const currentClassId = memberRows.length > 0 ? memberRows[0].class_id : null;

    // 检查是否是当前班级任务
    const isCurrentClass = currentClassId === task.class_id;

    // 检查是否已完成
    const [studentTaskRows] = await pool.query(
      'SELECT task_status FROM elia_student_task WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    );

    // 非当前班级任务，只能查看已完成的结果
    if (!isCurrentClass) {
      if (studentTaskRows.length === 0 || studentTaskRows[0].task_status !== '2') {
        return res.json({ code: 403, msg: '该任务属于历史班级，只能查看结果' });
      }
      // 跳转到详情接口
      return res.json({ code: 302, msg: '请使用详情接口查看', detailUrl: `/api/student-tasks/${taskId}/detail` });
    }

    // 当前班级任务：检查过期
    if (new Date(task.end_time) < new Date()) {
      return res.json({ code: 400, msg: '任务已过期，无法再做' });
    }

    // 检查是否已完成
    if (studentTaskRows.length > 0 && studentTaskRows[0].task_status === '2') {
      return res.json({ code: 400, msg: '任务已完成，无法重复做' });
    }

    // 获取题目列表
    const [questionRows] = await pool.query(
      'SELECT * FROM elia_task_question WHERE task_id = ? ORDER BY sort_order ASC',
      [taskId]
    );

    const questions = questionRows.map(q => {
      const question = {
        questionId: q.question_id,
        type: q.question_type === '1' ? 'single' : (q.question_type === '2' ? 'multiple' : 'input'),
        questionContent: q.question_content,
        score: q.score
      };

      if (q.question_type === '1' || q.question_type === '2') {
        // 选择题/多选题：解析选项
        try {
          const optionsObj = q.options ? JSON.parse(q.options) : [];
          // 转换为数组格式
          question.options = Object.entries(optionsObj).map(([key, value]) => ({
            key,
            value
          }));
        } catch (e) {
          question.options = [];
        }
      }

      question.userAnswer = null;

      return question;
    });

    // 更新任务状态为进行中
    if (studentTaskRows.length === 0 || studentTaskRows[0].task_status !== '1') {
      await pool.query(
        `INSERT INTO elia_student_task (task_id, user_id, class_id, task_status, create_time)
         VALUES (?, ?, ?, '1', NOW())
         ON DUPLICATE KEY UPDATE task_status = '1'`,
        [taskId, userId, task.class_id]
      );
    }

    return res.json({
      code: 200,
      data: {
        taskId: task.task_id,
        taskName: task.task_name,
        taskType: task.task_type,
        taskTypeText: getTaskTypeText(task.task_type),
        totalQuestions: task.question_count,
        questionCount: task.question_count,
        startTime: task.start_time ? task.start_time.toISOString().slice(0, 16).replace('T', ' ') : '',
        endTime: task.end_time ? task.end_time.toISOString().slice(0, 16).replace('T', ' ') : '',
        className: task.class_name,
        classLevel: task.class_level,
        canDo: true, // 当前班级任务可以做
        questions
      }
    });
  } catch (error) {
    console.error('获取任务详情错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/student-tasks/:taskId/submit
 * 提交任务答案
 * 
 * 业务规则：只能提交当前班级的任务
 */
router.post('/:taskId/submit', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const taskId = parseInt(req.params.taskId);
  const { answers } = req.body; // { questionId: userAnswer }

  if (!answers || typeof answers !== 'object') {
    return res.json({ code: 400, msg: '请提供答案' });
  }

  try {
    // 获取任务信息
    const [taskRows] = await pool.query(
      `SELECT t.*, c.class_name
       FROM elia_task t
       JOIN elia_class c ON t.class_id = c.class_id
       WHERE t.task_id = ?`,
      [taskId]
    );

    if (taskRows.length === 0) {
      return res.json({ code: 404, msg: '任务不存在' });
    }

    const task = taskRows[0];

    // 获取用户当前班级
    const [memberRows] = await pool.query(
      'SELECT class_id FROM elia_class_member WHERE user_id = ? AND member_status = "1"',
      [userId]
    );

    const currentClassId = memberRows.length > 0 ? memberRows[0].class_id : null;

    // 检查是否是当前班级任务
    if (currentClassId !== task.class_id) {
      return res.json({ code: 403, msg: '只能提交当前班级的任务' });
    }

    // 检查任务是否过期
    if (new Date(task.end_time) < new Date()) {
      return res.json({ code: 400, msg: '任务已过期，无法提交' });
    }

    // 获取题目列表
    const [questionRows] = await pool.query(
      'SELECT * FROM elia_task_question WHERE task_id = ?',
      [taskId]
    );

    // 批改答案
    let correctCount = 0;
    let totalScore = 0;
    let answeredCount = 0;
    const wrongQuestions = [];

    for (const question of questionRows) {
      const userAnswer = answers[question.question_id];
      
      // 跳过未作答的题目
      if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
        continue;
      }
      
      answeredCount++;
      let isCorrect = false;

      if (question.question_type === '1') {
        // 单选题
        try {
          const correctArr = question.correct_answer ? JSON.parse(question.correct_answer) : [];
          isCorrect = correctArr.includes(userAnswer);
        } catch (e) {
          isCorrect = false;
        }
      } else if (question.question_type === '2') {
        // 多选题
        try {
          const correctArr = question.correct_answer ? JSON.parse(question.correct_answer) : [];
          const userArr = Array.isArray(userAnswer) ? userAnswer : [];
          // 排序后比较
          isCorrect = correctArr.sort().join(',') === userArr.sort().join(',');
        } catch (e) {
          isCorrect = false;
        }
      } else {
        // 填空题
        isCorrect = userAnswer && userAnswer.trim().toLowerCase() === (question.correct_answer || '').trim().toLowerCase();
      }

      if (isCorrect) {
        correctCount++;
        totalScore += parseInt(question.score) || 0;
      } else {
        // 记录错题
        wrongQuestions.push({
          questionId: question.question_id,
          questionType: question.question_type,
          questionContent: question.question_content,
          correctAnswer: question.correct_answer,
          userAnswer: userAnswer || '',
          taskId: taskId,
          classId: task.class_id
        });
      }
    }

    const totalQuestions = questionRows.length;
    const score = totalScore;
    // 只有已作答的题目才计入成绩，60%及格
    const isPassed = answeredCount > 0 && (correctCount / answeredCount) >= 0.6;

    // 更新任务状态
    await pool.query(
      `UPDATE elia_student_task 
       SET task_status = '2'
       WHERE task_id = ? AND user_id = ?`,
      [taskId, userId]
    );

    // 记录错题到错题表
    if (wrongQuestions.length > 0) {
      for (const wrong of wrongQuestions) {
        // 检查是否已存在
        const [existRows] = await pool.query(
          'SELECT wrong_id FROM elia_wrong_question WHERE user_id = ? AND question_id = ?',
          [userId, wrong.questionId]
        );

        if (existRows.length === 0) {
          await pool.query(
            `INSERT INTO elia_wrong_question 
             (user_id, task_id, class_id, question_id, question_type, question_content, correct_answer, student_answer, wrong_count, is_mastered, create_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '0', NOW())`,
            [userId, taskId, wrong.classId, wrong.questionId, wrong.questionType, wrong.questionContent, wrong.correctAnswer, wrong.userAnswer]
          );
        } else {
          // 更新错题次数
          await pool.query(
            'UPDATE elia_wrong_question SET wrong_count = wrong_count + 1, student_answer = ?, create_time = NOW() WHERE user_id = ? AND question_id = ?',
            [wrong.userAnswer, userId, wrong.questionId]
          );
        }
      }
    }

    // 更新用户学习统计
    await pool.query(
      'UPDATE sys_user SET total_tasks_completed = total_tasks_completed + 1 WHERE user_id = ?',
      [userId]
    );

    // 更新今日学习记录
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO elia_learning_record (user_id, record_date, tasks_completed, create_time)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE tasks_completed = tasks_completed + 1`,
      [userId, today]
    );

    return res.json({
      code: 200,
      data: {
        correctCount,
        wrongCount: wrongQuestions.length,
        totalQuestions,
        answeredCount,
        score,
        isPassed
      },
      msg: isPassed ? '恭喜通过！' : '未通过，请继续努力！'
    });
  } catch (error) {
    console.error('提交任务错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-tasks/:taskId/detail
 * 获取任务结果详情（查看已完成任务的详情）
 */
router.get('/:taskId/detail', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const taskId = parseInt(req.params.taskId);

  try {
    // 获取任务信息
    const [taskRows] = await pool.query(
      `SELECT t.*, c.class_name, c.class_level,
              st.task_status
       FROM elia_task t
       JOIN elia_class c ON t.class_id = c.class_id
       LEFT JOIN elia_student_task st ON t.task_id = st.task_id AND st.user_id = ?
       WHERE t.task_id = ?`,
      [userId, taskId]
    );

    if (taskRows.length === 0) {
      return res.json({ code: 404, msg: '任务不存在' });
    }

    const task = taskRows[0];

    // 检查是否完成
    if (!task.task_status || task.task_status !== '2') {
      return res.json({ code: 400, msg: '任务未完成，无法查看���情' });
    }

    // 获取题目列表和用户答案
    const [questionRows] = await pool.query(
      'SELECT * FROM elia_task_question WHERE task_id = ? ORDER BY sort_order ASC',
      [taskId]
    );

    // 用户答案从错题表获取
    const answerMap = {};
    const [wrongRows] = await pool.query(
      'SELECT question_id, student_answer FROM elia_wrong_question WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    );
    wrongRows.forEach(r => {
      answerMap[r.question_id] = r.student_answer;
    });

    const questions = questionRows.map(q => {
      const userAnswer = answerMap[q.question_id];
      let isCorrect = false;

      if (q.question_type === '1') {
        // 单选题
        try {
          const correctArr = q.correct_answer ? JSON.parse(q.correct_answer) : [];
          isCorrect = Array.isArray(userAnswer) ? correctArr.includes(userAnswer[0]) : correctArr.includes(userAnswer);
        } catch (e) {
          isCorrect = false;
        }
      } else if (q.question_type === '2') {
        // 多选题
        try {
          const correctArr = q.correct_answer ? JSON.parse(q.correct_answer) : [];
          const userArr = Array.isArray(userAnswer) ? userAnswer : [];
          isCorrect = correctArr.sort().join(',') === userArr.sort().join(',');
        } catch (e) {
          isCorrect = false;
        }
      } else {
        // 填空题
        isCorrect = userAnswer && userAnswer.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase();
      }

      const question = {
        questionId: q.question_id,
        type: q.question_type === '1' ? 'single' : (q.question_type === '2' ? 'multiple' : 'input'),
        questionContent: q.question_content,
        score: q.score,
        isCorrect,
        userAnswer: userAnswer || '',
        correctAnswer: q.correct_answer || '',
        explanation: q.explanation || ''
      };

      // 添加选项信息（选择题）
      if (q.question_type === '1' || q.question_type === '2') {
        try {
          const optionsObj = q.options ? JSON.parse(q.options) : [];
          question.options = Object.entries(optionsObj).map(([key, value]) => ({
            key,
            value
          }));
        } catch (e) {
          question.options = [];
        }
      }

      return question;
    });

    const correctCount = questions.filter(q => q.isCorrect).length;
    const wrongCount = questions.filter(q => !q.isCorrect).length;

    // 获取教师信息
    const [teacherRows] = await pool.query(
      'SELECT user_name FROM sys_user WHERE user_id = ?',
      [task.teacher_id]
    );
    const teacherName = teacherRows.length > 0 ? teacherRows[0].user_name : '';

    // 计算得分
    let totalScore = 0;
    questions.forEach(q => {
      if (q.isCorrect) {
        totalScore += parseInt(q.score) || 0;
      }
    });
    const isPassed = (correctCount / questions.length) >= 0.6;

    return res.json({
      code: 200,
      data: {
        taskId: task.task_id,
        taskName: task.task_name,
        taskType: task.task_type,
        taskTypeText: getTaskTypeText(task.task_type),
        totalQuestions: task.question_count,
        questionCount: task.question_count,
        score: totalScore,
        isPassed,
        submitTime: '',
        className: task.class_name,
        classLevel: task.class_level,
        teacherName,
        questions
      },
      correctCount,
      wrongCount
    });
  } catch (error) {
    console.error('获取任务详情错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;