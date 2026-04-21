const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
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

// 模拟延迟
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// 获取当前用户名
const getUsername = (req) => {
  return req.user?.username || 'student';
};

// 题目类型映射
const questionTypeMap = {
  '1': '选择题',
  '2': '单词拼写',
  '3': '填空题'
};

// ==================== 错题数据（根据用户区分）====================
const mockErrorListData = {
  student: [
    { wrongId: 1, questionContent: 'The teacher asked us to _______ the new words after class.', questionType: '1', questionTypeName: '选择题', correctAnswer: 'A. memorize', userAnswer: 'B. remember', taskName: '第三单元单词测试', taskId: 101, wrongDate: '2026-04-18', isMastered: '0', explanation: 'memorize强调有意识地记忆，remember强调回忆起某事。' },
    { wrongId: 2, questionContent: 'accommodation', questionType: '2', questionTypeName: '单词拼写', correctAnswer: 'accommodation', userAnswer: 'accomodation', taskName: '单词听写', taskId: 102, wrongDate: '2026-04-17', isMastered: '0', explanation: '注意双c和双m' },
    { wrongId: 3, questionContent: 'The book _______ on the desk belongs to Mary.', questionType: '3', questionTypeName: '填空题', correctAnswer: 'lying', userAnswer: 'laying', taskName: '语法练习', taskId: 103, wrongDate: '2026-04-16', isMastered: '1', explanation: 'lie(躺)的现在分词是lying，lay(放置)的现在分词是laying。' },
    { wrongId: 4, questionContent: 'She suggested that we _______ a meeting to discuss the problem.', questionType: '1', questionTypeName: '选择题', correctAnswer: 'C. should have', userAnswer: 'A. had', taskName: '虚拟语气练习', taskId: 104, wrongDate: '2026-04-15', isMastered: '0', explanation: 'suggest后的that从句用虚拟语气，谓语用(should)+动词原形。' },
    { wrongId: 5, questionContent: 'necessary', questionType: '2', questionTypeName: '单词拼写', correctAnswer: 'necessary', userAnswer: 'neccessary', taskName: '单词听写', taskId: 105, wrongDate: '2026-04-14', isMastered: '1', explanation: '注意是一个c和两个s' },
    { wrongId: 6, questionContent: 'By the time I got to the station, the train _______ already _______.', questionType: '3', questionTypeName: '填空题', correctAnswer: 'had; left', userAnswer: 'has; left', taskName: '时态练习', taskId: 106, wrongDate: '2026-04-13', isMastered: '0', explanation: 'by the time引导的时间状语从句，主句用过去完成时。' },
    { wrongId: 7, questionContent: 'The number of students in our school _______ increasing.', questionType: '1', questionTypeName: '选择题', correctAnswer: 'A. is', userAnswer: 'B. are', taskName: '主谓一致练习', taskId: 107, wrongDate: '2026-04-12', isMastered: '0', explanation: 'the number of表示"......的数量"，作主语时谓语用单数。' },
    { wrongId: 8, questionContent: 'environment', questionType: '2', questionTypeName: '单词拼写', correctAnswer: 'environment', userAnswer: 'enviroment', taskName: '单词听写', taskId: 108, wrongDate: '2026-04-11', isMastered: '1', explanation: '注意n在v后面' },
    { wrongId: 9, questionContent: 'Neither Tom nor his parents _______ at home yesterday.', questionType: '1', questionTypeName: '选择题', correctAnswer: 'B. were', userAnswer: 'A. was', taskName: '主谓一致练习', taskId: 109, wrongDate: '2026-04-10', isMastered: '0', explanation: 'neither...nor...连接两个主语时，谓语动词与最近的主语保持一致。' },
    { wrongId: 10, questionContent: 'occurrence', questionType: '2', questionTypeName: '单词拼写', correctAnswer: 'occurrence', userAnswer: 'occurance', taskName: '单词听写', taskId: 110, wrongDate: '2026-04-09', isMastered: '0', explanation: '注意双c和双r' },
    { wrongId: 11, questionContent: 'The book is worth _______.', questionType: '3', questionTypeName: '填空题', correctAnswer: 'reading', userAnswer: 'to read', taskName: '固定搭配练习', taskId: 111, wrongDate: '2026-04-08', isMastered: '1', explanation: 'be worth doing是固定搭配，表示"值得做"。' },
    { wrongId: 12, questionContent: 'independent', questionType: '2', questionTypeName: '单词拼写', correctAnswer: 'independent', userAnswer: 'independant', taskName: '单词听写', taskId: 112, wrongDate: '2026-04-07', isMastered: '0', explanation: '注意是ent结尾，不是ant' }
  ],
  lisi: [
    { wrongId: 101, questionContent: 'The _______ of the story is that honesty is the best policy.', questionType: '1', questionTypeName: '选择题', correctAnswer: 'B. moral', userAnswer: 'A. lesson', taskName: '阅读理解练习', taskId: 201, wrongDate: '2026-04-18', isMastered: '0', explanation: 'moral表示故事的寓意，lesson表示课程或教训。' },
    { wrongId: 102, questionContent: 'phenomenon', questionType: '2', questionTypeName: '单词拼写', correctAnswer: 'phenomenon', userAnswer: 'phenomena', taskName: '单词听写', taskId: 202, wrongDate: '2026-04-17', isMastered: '0', explanation: 'phenomenon是单数形式，phenomena是复数形式。' },
    { wrongId: 103, questionContent: 'I regret _______ you that your application has been rejected.', questionType: '3', questionTypeName: '填空题', correctAnswer: 'to tell', userAnswer: 'telling', taskName: '非谓语动词练习', taskId: 203, wrongDate: '2026-04-16', isMastered: '1', explanation: 'regret to do表示遗憾要做某事，regret doing表示后悔做了某事。' },
    { wrongId: 104, questionContent: 'conscience', questionType: '2', questionTypeName: '单词拼写', correctAnswer: 'conscience', userAnswer: 'concience', taskName: '单词听写', taskId: 204, wrongDate: '2026-04-15', isMastered: '0', explanation: '注意science中有sc' },
    { wrongId: 105, questionContent: 'maintenance', questionType: '2', questionTypeName: '单词拼写', correctAnswer: 'maintenance', userAnswer: 'maintainance', taskName: '单词听写', taskId: 205, wrongDate: '2026-04-14', isMastered: '0', explanation: '注意是maintenance，不是maintainance' }
  ],
  zhangsan: [
    { wrongId: 201, questionContent: 'The experiment requires that the temperature _______ constant.', questionType: '1', questionTypeName: '选择题', correctAnswer: 'C. be kept', userAnswer: 'A. keeps', taskName: '虚拟语气练习', taskId: 301, wrongDate: '2026-04-18', isMastered: '0', explanation: 'require后的that从句用虚拟语气，谓语用(should)+动词原形。' },
    { wrongId: 202, questionContent: 'surveillance', questionType: '2', questionTypeName: '单词拼写', correctAnswer: 'surveillance', userAnswer: 'surveilance', taskName: '单词听写', taskId: 302, wrongDate: '2026-04-17', isMastered: '0', explanation: '注意双l' },
    { wrongId: 203, questionContent: 'Had I known the truth, I _______ you immediately.', questionType: '3', questionTypeName: '填空题', correctAnswer: 'would have told', userAnswer: 'will tell', taskName: '虚拟语气练习', taskId: 303, wrongDate: '2026-04-16', isMastered: '1', explanation: '这是与过去事实相反的虚拟语气，省略if后，had提前。' }
  ]
};

// ==================== 错题统计概览 ====================
const mockErrorOverviewData = {
  student: { totalErrors: 12, masteredCount: 4, unmasteredCount: 8, typeDistribution: [{ type: '选择题', count: 4, percentage: 33.3 }, { type: '单词拼写', count: 5, percentage: 41.7 }, { type: '填空题', count: 3, percentage: 25.0 }], recentTrend: [{ date: '2026-04-14', count: 2 }, { date: '2026-04-15', count: 1 }, { date: '2026-04-16', count: 2 }, { date: '2026-04-17', count: 1 }, { date: '2026-04-18', count: 1 }] },
  lisi: { totalErrors: 5, masteredCount: 1, unmasteredCount: 4, typeDistribution: [{ type: '选择题', count: 1, percentage: 20.0 }, { type: '单词拼写', count: 3, percentage: 60.0 }, { type: '填空题', count: 1, percentage: 20.0 }], recentTrend: [{ date: '2026-04-14', count: 1 }, { date: '2026-04-15', count: 1 }, { date: '2026-04-16', count: 1 }, { date: '2026-04-17', count: 1 }, { date: '2026-04-18', count: 1 }] },
  zhangsan: { totalErrors: 3, masteredCount: 1, unmasteredCount: 2, typeDistribution: [{ type: '选择题', count: 1, percentage: 33.3 }, { type: '单词拼写', count: 1, percentage: 33.3 }, { type: '填空题', count: 1, percentage: 33.3 }], recentTrend: [{ date: '2026-04-16', count: 1 }, { date: '2026-04-17', count: 1 }, { date: '2026-04-18', count: 1 }] }
};

// 内存存储（用于模拟增删改）
let _errorListData = JSON.parse(JSON.stringify(mockErrorListData));

/**
 * GET /api/student-errors/overview
 * 获取错题统计概览
 */
router.get('/overview', authMiddleware, async (req, res) => {
  await delay(200);
  const username = getUsername(req);
  const data = mockErrorOverviewData[username] || mockErrorOverviewData.student;
  return res.json({ code: 200, data });
});

/**
 * GET /api/student-errors/list
 * 获取错题列表（支持筛选）
 */
router.get('/list', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const { questionType, startDate, endDate, pageNum = 1, pageSize = 10 } = req.query;
  
  let errorList = [...(_errorListData[username] || _errorListData.student)];
  
  if (questionType) errorList = errorList.filter(e => e.questionType === questionType);
  if (startDate) errorList = errorList.filter(e => e.wrongDate >= startDate);
  if (endDate) errorList = errorList.filter(e => e.wrongDate <= endDate);
  
  errorList.sort((a, b) => new Date(b.wrongDate) - new Date(a.wrongDate));
  
  const total = errorList.length;
  const start = (parseInt(pageNum) - 1) * parseInt(pageSize);
  const end = start + parseInt(pageSize);
  
  return res.json({ code: 200, rows: errorList.slice(start, end), total });
});

// ==================== 固定路径路由（必须在参数路由之前）====================

/**
 * GET /api/student-errors/type-stats
 * 获取错题类型统计
 */
router.get('/type-stats', authMiddleware, async (req, res) => {
  await delay(200);
  const username = getUsername(req);
  const errorList = _errorListData[username] || _errorListData.student;
  
  const stats = { '1': { type: '选择题', count: 0 }, '2': { type: '单词拼写', count: 0 }, '3': { type: '填空题', count: 0 } };
  errorList.forEach(e => { if (stats[e.questionType]) stats[e.questionType].count++; });
  
  return res.json({ code: 200, data: Object.values(stats) });
});

/**
 * GET /api/student-errors/template
 * 下载导入模板（无需认证）
 */
router.get('/template', async (req, res) => {
  await delay(300);
  
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('错题导入模板');
  
  worksheet.columns = [
    { header: '题目类型(1选择题 2单词拼写 3填空题)', key: 'questionType', width: 25 },
    { header: '题目内容', key: 'questionContent', width: 50 },
    { header: '正确答案', key: 'correctAnswer', width: 25 },
    { header: '您的答案', key: 'userAnswer', width: 25 },
    { header: '所属任务', key: 'taskName', width: 20 },
    { header: '错误日期(YYYY-MM-DD)', key: 'wrongDate', width: 20 },
    { header: '解析', key: 'explanation', width: 40 }
  ];
  
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
  
  worksheet.addRows([
    { questionType: 1, questionContent: 'The teacher asked us to _______ the new words after class.', correctAnswer: 'A. memorize', userAnswer: 'B. remember', taskName: '第三单元单词测试', wrongDate: '2026-04-18', explanation: 'memorize强调有意识地记忆，remember强调回忆起某事。' },
    { questionType: 2, questionContent: '拼写单词：住宿', correctAnswer: 'accommodation', userAnswer: 'accomodation', taskName: '单词听写', wrongDate: '2026-04-17', explanation: '注意双c和双m' },
    { questionType: 3, questionContent: 'The book _______ on the desk belongs to Mary.', correctAnswer: 'lying', userAnswer: 'laying', taskName: '语法练习', wrongDate: '2026-04-16', explanation: 'lie(躺)的现在分词是lying，lay(放置)的现在分词是laying。' }
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
  await delay(500);
  const username = getUsername(req);
  const { format, wrongIds, questionType, startDate, endDate } = req.query;
  
  if (!format || !['excel', 'pdf'].includes(format)) {
    return res.json({ code: 400, msg: '请指定导出格式（excel/pdf）' });
  }
  
  let exportData = [...(_errorListData[username] || mockErrorListData.student)];
  
  if (wrongIds) {
    const ids = wrongIds.split(',').map(id => parseInt(id));
    exportData = exportData.filter(e => ids.includes(e.wrongId));
  } else {
    if (questionType) exportData = exportData.filter(e => e.questionType === questionType);
    if (startDate) exportData = exportData.filter(e => e.wrongDate >= startDate);
    if (endDate) exportData = exportData.filter(e => e.wrongDate <= endDate);
  }
  
  if (exportData.length === 0) {
    return res.json({ code: 400, msg: '暂无错题可导出' });
  }
  
  if (format === 'excel') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('我的错题');
    
    worksheet.columns = [
      { header: '错题ID', key: 'wrongId', width: 10 },
      { header: '题目类型(1选择题 2单词拼写 3填空题)', key: 'questionType', width: 25 },
      { header: '题目内容', key: 'questionContent', width: 50 },
      { header: '正确答案', key: 'correctAnswer', width: 25 },
      { header: '您的答案', key: 'userAnswer', width: 25 },
      { header: '所属任务', key: 'taskName', width: 20 },
      { header: '错误日期', key: 'wrongDate', width: 15 },
      { header: '是否已掌握(0未掌握 1已掌握)', key: 'isMastered', width: 20 },
      { header: '解析', key: 'explanation', width: 40 }
    ];
    
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    
    exportData.forEach(item => worksheet.addRow(item));
    
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
    doc.fontSize(10).text(`错题数量: ${exportData.length} 条`);
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
    
    const typeMap = { '1': '选择题', '2': '单词拼写', '3': '填空题' };
    
    exportData.forEach(item => {
      x = 30;
      const row = [
        String(item.wrongId), 
        typeMap[item.questionType] || item.questionType, 
        String(item.questionContent || '').substring(0, 30), 
        String(item.correctAnswer || '').substring(0, 15), 
        String(item.userAnswer || '').substring(0, 15), 
        String(item.taskName || '').substring(0, 10), 
        item.wrongDate || '', 
        item.isMastered === '1' ? '已掌握' : '未掌握'
      ];
      row.forEach((cell, i) => { doc.text(cell, x, y, { width: colWidths[i] }); x += colWidths[i]; });
      y += 15;
      if (y > 550) { doc.addPage(); y = 30; }
    });
    
    doc.end();
  }
});

/**
 * POST /api/student-errors/import
 * 导入错题（Excel文件）
 */
router.post('/import', authMiddleware, upload.single('file'), async (req, res) => {
  await delay(500);
  const username = getUsername(req);
  const { file } = req;
  
  if (!file) return res.json({ code: 400, msg: '请上传文件' });
  
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);
    
    const importedData = [];
    const errorList = _errorListData[username] || [...mockErrorListData.student];
    let maxWrongId = errorList.length > 0 ? Math.max(...errorList.map(e => e.wrongId)) : 0;
    
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values;
      const questionType = values[1];
      const questionContent = values[2];
      if (!questionType || !questionContent) return;
      
      maxWrongId++;
      importedData.push({
        wrongId: maxWrongId,
        questionType: String(questionType),
        questionTypeName: questionTypeMap[String(questionType)] || '未知类型',
        questionContent: questionContent,
        correctAnswer: values[3] || '',
        userAnswer: values[4] || '',
        taskName: values[5] || '导入错题',
        taskId: null,
        wrongDate: values[6] || new Date().toISOString().split('T')[0],
        isMastered: '0',
        explanation: values[7] || ''
      });
    });
    
    _errorListData[username] = [...importedData, ...errorList];
    
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
  await delay(300);
  const username = getUsername(req);
  const { wrongIds } = req.body;
  
  if (!wrongIds || !Array.isArray(wrongIds) || wrongIds.length === 0) {
    return res.json({ code: 400, msg: '请选择要删除的错题' });
  }
  
  const errorList = _errorListData[username] || _errorListData.student;
  const newErrorList = errorList.filter(e => !wrongIds.includes(e.wrongId));
  const deletedCount = errorList.length - newErrorList.length;
  _errorListData[username] = newErrorList;
  
  return res.json({ code: 200, msg: `成功删除 ${deletedCount} 条错题`, data: { deletedCount } });
});

/**
 * POST /api/student-errors/add
 * 手动添加错题
 */
router.post('/add', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const { questionContent, questionType, correctAnswer, userAnswer, explanation } = req.body;
  
  if (!questionContent || !questionType || !correctAnswer) {
    return res.json({ code: 400, msg: '请填写完整的错题信息' });
  }
  
  const newError = {
    wrongId: Date.now(),
    questionContent,
    questionType,
    questionTypeName: questionTypeMap[questionType] || questionType,
    correctAnswer,
    userAnswer: userAnswer || '',
    taskName: '手动添加',
    taskId: null,
    wrongDate: new Date().toISOString().split('T')[0],
    isMastered: '0',
    explanation: explanation || ''
  };
  
  const errorList = _errorListData[username] || _errorListData.student;
  errorList.unshift(newError);
  _errorListData[username] = errorList;
  
  return res.json({ code: 200, msg: '添加成功', data: newError });
});

// ==================== 参数路由（放在最后）====================

/**
 * GET /api/student-errors/:wrongId
 * 获取错题详情
 */
router.get('/:wrongId', authMiddleware, async (req, res) => {
  await delay(200);
  const username = getUsername(req);
  const wrongId = parseInt(req.params.wrongId);
  
  const errorList = _errorListData[username] || _errorListData.student;
  const error = errorList.find(e => e.wrongId === wrongId);
  
  if (!error) return res.json({ code: 404, msg: '错题不存在' });
  return res.json({ code: 200, data: error });
});

/**
 * DELETE /api/student-errors/:wrongId
 * 删除单条错题
 */
router.delete('/:wrongId', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const wrongId = parseInt(req.params.wrongId);
  
  const errorList = _errorListData[username] || _errorListData.student;
  const index = errorList.findIndex(e => e.wrongId === wrongId);
  
  if (index === -1) return res.json({ code: 404, msg: '错题不存在' });
  
  errorList.splice(index, 1);
  _errorListData[username] = errorList;
  
  return res.json({ code: 200, msg: '删除成功' });
});

/**
 * PUT /api/student-errors/:wrongId/master
 * 标记错题为已掌握/未掌握
 */
router.put('/:wrongId/master', authMiddleware, async (req, res) => {
  await delay(200);
  const username = getUsername(req);
  const wrongId = parseInt(req.params.wrongId);
  const { isMastered } = req.body;
  
  const errorList = _errorListData[username] || _errorListData.student;
  const error = errorList.find(e => e.wrongId === wrongId);
  
  if (!error) return res.json({ code: 404, msg: '错题不存在' });
  
  error.isMastered = isMastered ? '1' : '0';
  _errorListData[username] = errorList;
  
  return res.json({ code: 200, msg: isMastered ? '已标记为掌握' : '已标记为未掌握', data: { isMastered: error.isMastered } });
});

/**
 * PUT /api/student-errors/:wrongId
 * 编辑错题
 */
router.put('/:wrongId', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const wrongId = parseInt(req.params.wrongId);
  const { questionContent, questionType, correctAnswer, explanation } = req.body;
  
  const errorList = _errorListData[username] || _errorListData.student;
  const error = errorList.find(e => e.wrongId === wrongId);
  
  if (!error) return res.json({ code: 404, msg: '错题不存在' });
  
  if (questionContent) error.questionContent = questionContent;
  if (questionType) { error.questionType = questionType; error.questionTypeName = questionTypeMap[questionType] || questionType; }
  if (correctAnswer) error.correctAnswer = correctAnswer;
  if (explanation) error.explanation = explanation;
  
  _errorListData[username] = errorList;
  
  return res.json({ code: 200, msg: '编辑成功', data: error });
});

module.exports = router;
