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

// 题目类型映射
const questionTypeMap = {
  '1': '选择题',
  '2': '单词拼写',
  '3': '填空题'
};

/**
 * GET /api/student-errors/overview
 * 获取错题统计概览
 */
router.get('/overview', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    // 获取总错题数和掌握情况
    const [statRows] = await pool.query(
      `SELECT 
        COUNT(*) as totalErrors,
        SUM(CASE WHEN is_mastered = '1' THEN 1 ELSE 0 END) as masteredCount,
        SUM(CASE WHEN is_mastered = '0' THEN 1 ELSE 0 END) as unmasteredCount
       FROM elia_wrong_question 
       WHERE user_id = ?`,
      [userId]
    );

    // 获取错题类型分布
    const [typeRows] = await pool.query(
      `SELECT 
        question_type,
        COUNT(*) as count
       FROM elia_wrong_question 
       WHERE user_id = ?
       GROUP BY question_type`,
      [userId]
    );

    const total = statRows[0].totalErrors || 0;
    const typeDistribution = typeRows.map(t => ({
      type: questionTypeMap[t.question_type] || t.question_type,
      count: t.count,
      percentage: total > 0 ? Math.round((t.count / total) * 100 * 10) / 10 : 0
    }));

    // 获取最近5天的错题趋势
    const [trendRows] = await pool.query(
      `SELECT 
        DATE(create_time) as date,
        COUNT(*) as count
       FROM elia_wrong_question 
       WHERE user_id = ? AND create_time >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
       GROUP BY DATE(create_time)
       ORDER BY date DESC`,
      [userId]
    );

    return res.json({
      code: 200,
      data: {
        totalErrors: statRows[0].totalErrors || 0,
        masteredCount: statRows[0].masteredCount || 0,
        unmasteredCount: statRows[0].unmasteredCount || 0,
        typeDistribution,
        recentTrend: trendRows
      }
    });
  } catch (error) {
    console.error('获取错题概览错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-errors/list
 * 获取错题列表（支持筛选）
 */
router.get('/list', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { questionType, startDate, endDate, pageNum = 1, pageSize = 10 } = req.query;

  try {
    let sql = `
      SELECT w.*, t.task_name
      FROM elia_wrong_question w
      LEFT JOIN elia_task t ON w.task_id = t.task_id
      WHERE w.user_id = ?
    `;
    let countSql = 'SELECT COUNT(*) as total FROM elia_wrong_question WHERE user_id = ?';
    const params = [userId];
    const countParams = [userId];

    if (questionType) {
      sql += ' AND w.question_type = ?';
      countSql += ' AND question_type = ?';
      params.push(questionType);
      countParams.push(questionType);
    }
    if (startDate) {
      sql += ' AND DATE(w.create_time) >= ?';
      countSql += ' AND DATE(create_time) >= ?';
      params.push(startDate);
      countParams.push(startDate);
    }
    if (endDate) {
      sql += ' AND DATE(w.create_time) <= ?';
      countSql += ' AND DATE(create_time) <= ?';
      params.push(endDate);
      countParams.push(endDate);
    }

    // 获取总数
    const [countRows] = await pool.query(countSql, countParams);
    const total = countRows[0].total;

    // 分页
    const offset = (parseInt(pageNum) - 1) * parseInt(pageSize);
    sql += ' ORDER BY w.create_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [rows] = await pool.query(sql, params);

    const list = rows.map(r => ({
      wrongId: r.wrong_id,
      questionContent: r.question_content,
      questionType: r.question_type,
      questionTypeName: questionTypeMap[r.question_type] || r.question_type,
      correctAnswer: r.correct_answer,
      userAnswer: r.student_answer,
      taskName: r.task_name,
      taskId: r.task_id,
      wrongDate: r.create_time ? r.create_time.toISOString().split('T')[0] : null,
      isMastered: r.is_mastered,
      explanation: r.notes,
      wrongCount: r.wrong_count
    }));

    return res.json({ code: 200, rows: list, total });
  } catch (error) {
    console.error('获取错题列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-errors/type-stats
 * 获取错题类型统计
 */
router.get('/type-stats', authMiddleware, async (req, res) => {
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      `SELECT 
        question_type,
        COUNT(*) as count
       FROM elia_wrong_question 
       WHERE user_id = ?
       GROUP BY question_type`,
      [userId]
    );

    const stats = {
      '1': { type: '选择题', count: 0 },
      '2': { type: '单词拼写', count: 0 },
      '3': { type: '填空题', count: 0 }
    };

    rows.forEach(r => {
      if (stats[r.question_type]) {
        stats[r.question_type].count = r.count;
      }
    });

    return res.json({ code: 200, data: Object.values(stats) });
  } catch (error) {
    console.error('获取错题类型统计错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-errors/template
 * 下载导入模板（无需认证）
 */
router.get('/template', async (req, res) => {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('错题导入模板');

  worksheet.columns = [
    { header: '题目类型(1选择题 2单词拼写 3填空题)', key: 'questionType', width: 25 },
    { header: '题目内容', key: 'questionContent', width: 50 },
    { header: '正确答案', key: 'correctAnswer', width: 25 },
    { header: '您的答案', key: 'userAnswer', width: 25 },
    { header: '所属任务ID', key: 'taskId', width: 15 },
    { header: '错误日期(YYYY-MM-DD)', key: 'wrongDate', width: 20 },
    { header: '解析', key: 'explanation', width: 40 }
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.addRows([
    { questionType: 1, questionContent: 'The teacher asked us to _______ the new words after class.', correctAnswer: 'A. memorize', userAnswer: 'B. remember', taskId: '', wrongDate: '2026-04-18', explanation: 'memorize强调有意识地记忆，remember强调回忆起某事。' },
    { questionType: 2, questionContent: '拼写单词：住宿', correctAnswer: 'accommodation', userAnswer: 'accomodation', taskId: '', wrongDate: '2026-04-17', explanation: '注意双c和双m' },
    { questionType: 3, questionContent: 'The book _______ on the desk belongs to Mary.', correctAnswer: 'lying', userAnswer: 'laying', taskId: '', wrongDate: '2026-04-16', explanation: 'lie(躺)的现在分词是lying，lay(放置)的现在分词是laying。' }
  ]);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="student_error_template.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * GET /api/student-errors/export
 * 导出错题（Excel/PDF）
 */
router.get('/export', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { format, wrongIds, questionType, startDate, endDate } = req.query;

  if (!format || !['excel', 'pdf'].includes(format)) {
    return res.json({ code: 400, msg: '请指定导出格式（excel/pdf）' });
  }

  try {
    let sql = `
      SELECT w.*, t.task_name
      FROM elia_wrong_question w
      LEFT JOIN elia_task t ON w.task_id = t.task_id
      WHERE w.user_id = ?
    `;
    const params = [userId];

    if (wrongIds) {
      const ids = wrongIds.split(',').map(id => parseInt(id));
      sql += ' AND w.wrong_id IN (?)';
      params.push(ids);
    } else {
      if (questionType) {
        sql += ' AND w.question_type = ?';
        params.push(questionType);
      }
      if (startDate) {
        sql += ' AND DATE(w.create_time) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND DATE(w.create_time) <= ?';
        params.push(endDate);
      }
    }

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res.json({ code: 400, msg: '暂无错题可导出' });
    }

    if (format === 'excel') {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('我的错题');

      worksheet.columns = [
        { header: '错题ID', key: 'wrongId', width: 10 },
        { header: '题目类型', key: 'questionTypeName', width: 12 },
        { header: '题目内容', key: 'questionContent', width: 50 },
        { header: '正确答案', key: 'correctAnswer', width: 25 },
        { header: '您的答案', key: 'userAnswer', width: 25 },
        { header: '所属任务', key: 'taskName', width: 20 },
        { header: '错误日期', key: 'wrongDate', width: 15 },
        { header: '是否已掌握', key: 'isMasteredName', width: 12 },
        { header: '解析', key: 'explanation', width: 40 }
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      rows.forEach(r => {
        worksheet.addRow({
          wrongId: r.wrong_id,
          questionTypeName: questionTypeMap[r.question_type] || r.question_type,
          questionContent: r.question_content,
          correctAnswer: r.correct_answer,
          userAnswer: r.student_answer,
          taskName: r.task_name,
          wrongDate: r.create_time ? r.create_time.toISOString().split('T')[0] : '',
          isMasteredName: r.is_mastered === '1' ? '已掌握' : '未掌握',
          explanation: r.notes
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="student_errors_export.xlsx"');

      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

      const fontPath = path.join(__dirname, '../fonts/NotoSansSC-Regular.otf');
      doc.registerFont('Chinese', fontPath);
      doc.font('Chinese');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="student_errors_export.pdf"');

      doc.pipe(res);

      doc.fontSize(18).text('我的错题', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
      doc.fontSize(10).text(`错题数量: ${rows.length} 条`);
      doc.moveDown();

      const headers = ['ID', '类型', '题目内容', '正确答案', '您的答案', '任务', '日期', '掌握'];
      const colWidths = [30, 60, 120, 60, 60, 60, 50, 40];
      let y = doc.y;
      let x = 30;

      doc.fontSize(9);
      headers.forEach((header, i) => { doc.text(header, x, y, { width: colWidths[i], align: 'center' }); x += colWidths[i]; });

      doc.moveDown();
      y = doc.y;
      doc.fontSize(8);

      rows.forEach(item => {
        x = 30;
        const row = [
          String(item.wrong_id),
          questionTypeMap[item.question_type] || item.question_type,
          String(item.question_content || '').substring(0, 30),
          String(item.correct_answer || '').substring(0, 15),
          String(item.student_answer || '').substring(0, 15),
          String(item.task_name || '').substring(0, 10),
          item.create_time ? item.create_time.toISOString().split('T')[0] : '',
          item.is_mastered === '1' ? '已掌握' : '未掌握'
        ];
        row.forEach((cell, i) => { doc.text(cell, x, y, { width: colWidths[i] }); x += colWidths[i]; });
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
 * POST /api/student-errors/import
 * 导入错题（Excel文件）
 */
router.post('/import', authMiddleware, upload.single('file'), async (req, res) => {
  const userId = getUserId(req);
  const { file } = req;

  if (!file) return res.json({ code: 400, msg: '请上传文件' });

  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);

    const importedData = [];
    let rowNum = 0;

    worksheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      rowNum++;

      const values = row.values;
      const questionType = values[1];
      const questionContent = values[2];
      if (!questionType || !questionContent) return;

      importedData.push([
        userId,                                    // user_id
        values[5] || null,                         // task_id
        null,                                      // question_id
        null,                                      // class_id
        String(questionType),                      // question_type
        questionContent,                           // question_content
        values[3] || '',                           // correct_answer
        values[4] || '',                           // student_answer
        null,                                      // wrong_reason
        1,                                         // wrong_count
        values[6] || new Date().toISOString().split('T')[0], // last_wrong_time
        '0',                                       // is_mastered
        null,                                      // mastery_time
        null,                                      // tags
        values[7] || ''                            // notes
      ]);
    });

    if (importedData.length > 0) {
      await pool.query(
        `INSERT INTO elia_wrong_question 
         (user_id, task_id, question_id, class_id, question_type, question_content, 
          correct_answer, student_answer, wrong_reason, wrong_count, last_wrong_time, 
          is_mastered, mastery_time, tags, notes, create_time)
         VALUES ?`,
        [importedData]
      );
    }

    return res.json({ code: 200, msg: `成功导入 ${importedData.length} 条错题记录`, data: { importCount: importedData.length } });
  } catch (error) {
    console.error('导入错误:', error);
    return res.json({ code: 500, msg: '文件解析失败，请检查文件格式' });
  }
});

/**
 * POST /api/student-errors/batch-delete
 * 批量删除错题
 */
router.post('/batch-delete', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { wrongIds } = req.body;

  if (!wrongIds || !Array.isArray(wrongIds) || wrongIds.length === 0) {
    return res.json({ code: 400, msg: '请选择要删除的错题' });
  }

  try {
    const [result] = await pool.query(
      'DELETE FROM elia_wrong_question WHERE user_id = ? AND wrong_id IN (?)',
      [userId, wrongIds]
    );

    return res.json({ code: 200, msg: `成功删除 ${result.affectedRows} 条错题`, data: { deletedCount: result.affectedRows } });
  } catch (error) {
    console.error('批量删除错题错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/student-errors/add
 * 手动添加错题
 */
router.post('/add', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const { questionContent, questionType, correctAnswer, userAnswer, explanation, taskId, classId } = req.body;

  if (!questionContent || !questionType || !correctAnswer) {
    return res.json({ code: 400, msg: '请填写完整的错题信息' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO elia_wrong_question 
       (user_id, task_id, question_id, class_id, question_type, question_content, 
        correct_answer, student_answer, wrong_count, last_wrong_time, is_mastered, notes, create_time)
       VALUES (?, ?, null, ?, ?, ?, ?, ?, 1, NOW(), '0', ?, NOW())`,
      [userId, taskId || null, classId || null, questionType, questionContent, correctAnswer, userAnswer || '', explanation || '']
    );

    return res.json({
      code: 200,
      msg: '添加成功',
      data: { wrongId: result.insertId }
    });
  } catch (error) {
    console.error('添加错题错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-errors/:wrongId
 * 获取错题详情
 */
router.get('/:wrongId', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const wrongId = parseInt(req.params.wrongId);

  try {
    const [rows] = await pool.query(
      `SELECT w.*, t.task_name
       FROM elia_wrong_question w
       LEFT JOIN elia_task t ON w.task_id = t.task_id
       WHERE w.wrong_id = ? AND w.user_id = ?`,
      [wrongId, userId]
    );

    if (rows.length === 0) {
      return res.json({ code: 404, msg: '错题不存在' });
    }

    const r = rows[0];
    return res.json({
      code: 200,
      data: {
        wrongId: r.wrong_id,
        questionContent: r.question_content,
        questionType: r.question_type,
        questionTypeName: questionTypeMap[r.question_type] || r.question_type,
        correctAnswer: r.correct_answer,
        userAnswer: r.student_answer,
        taskName: r.task_name,
        taskId: r.task_id,
        wrongDate: r.create_time ? r.create_time.toISOString().split('T')[0] : null,
        isMastered: r.is_mastered,
        explanation: r.notes,
        wrongCount: r.wrong_count
      }
    });
  } catch (error) {
    console.error('获取错题详情错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * DELETE /api/student-errors/:wrongId
 * 删除单条错题
 */
router.delete('/:wrongId', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const wrongId = parseInt(req.params.wrongId);

  try {
    const [result] = await pool.query(
      'DELETE FROM elia_wrong_question WHERE wrong_id = ? AND user_id = ?',
      [wrongId, userId]
    );

    if (result.affectedRows === 0) {
      return res.json({ code: 404, msg: '错题不存在' });
    }

    return res.json({ code: 200, msg: '删除成功' });
  } catch (error) {
    console.error('删除错题错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * PUT /api/student-errors/:wrongId/master
 * 标记错题为已掌握/未掌握
 */
router.put('/:wrongId/master', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const wrongId = parseInt(req.params.wrongId);
  const { isMastered } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE elia_wrong_question SET is_mastered = ?, mastery_time = ? WHERE wrong_id = ? AND user_id = ?',
      [isMastered ? '1' : '0', isMastered ? new Date() : null, wrongId, userId]
    );

    if (result.affectedRows === 0) {
      return res.json({ code: 404, msg: '错题不存在' });
    }

    return res.json({ code: 200, msg: isMastered ? '已标记为掌握' : '已标记为未掌握', data: { isMastered: isMastered ? '1' : '0' } });
  } catch (error) {
    console.error('标记掌握错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * PUT /api/student-errors/:wrongId
 * 编辑错题
 */
router.put('/:wrongId', authMiddleware, async (req, res) => {
  const userId = getUserId(req);
  const wrongId = parseInt(req.params.wrongId);
  const { questionContent, questionType, correctAnswer, explanation } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE elia_wrong_question 
       SET question_content = ?, question_type = ?, correct_answer = ?, notes = ?
       WHERE wrong_id = ? AND user_id = ?`,
      [questionContent, questionType, correctAnswer, explanation, wrongId, userId]
    );

    if (result.affectedRows === 0) {
      return res.json({ code: 404, msg: '错题不存在' });
    }

    return res.json({ code: 200, msg: '编辑成功' });
  } catch (error) {
    console.error('编辑错题错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
