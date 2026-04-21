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

// ==================== 教师仪表盘数据（根据用户区分）====================
const mockTeacherDashboardData = {
  teacher: {
    totalStudents: 45,
    totalClasses: 2,
    pendingApplications: 0,
    pendingTasks: 0
  },
  teacherLi: {
    totalStudents: 25,
    totalClasses: 1,
    pendingApplications: 0,
    pendingTasks: 0
  },
  teacherWang: {
    totalStudents: 20,
    totalClasses: 1,
    pendingApplications: 0,
    pendingTasks: 0
  }
};

// ==================== 班级等级分布数据 ====================
const mockLevelDistributionData = [
  { classLevel: 'A', classCount: 1 },
  { classLevel: 'B', classCount: 1 },
  { classLevel: 'C', classCount: 1 },
  { classLevel: 'D', classCount: 1 }
];

// ==================== 各班级任务完成率数据 ====================
const mockTaskCompletionData = {
  classNames: ['A级-英语精英班', 'B级-英语进阶班', 'C级-英语提高班', 'D级-英语基础班'],
  completionRates: [85, 78, 92, 65]
};

// ==================== 学生活跃度趋势数据 ====================
const mockActivityTrendData = {
  days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  completedTasks: [220, 182, 191, 234, 290, 330, 310],
  exercises: [150, 232, 201, 154, 190, 330, 410]
};

// ==================== 错题类型分布数据 ====================
const mockErrorTypeDistributionData = [
  { type: '选择题', count: 335 },
  { type: '填空题', count: 234 },
  { type: '单词拼写', count: 148 }
];

// 模拟延迟
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// 获取当前用户名
const getUsername = (req) => {
  return req.user?.username || 'teacher';
};

/**
 * GET /api/teacher-home/dashboard
 * 获取教师仪表盘数据（顶部概览）
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
  await delay(300);
  const username = getUsername(req);
  const dashboard = mockTeacherDashboardData[username] || mockTeacherDashboardData.teacher;
  return res.json({ code: 200, data: dashboard });
});

/**
 * GET /api/teacher-home/level-distribution
 * 获取班级等级分布
 */
router.get('/level-distribution', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({ code: 200, data: mockLevelDistributionData });
});

/**
 * GET /api/teacher-home/task-completion
 * 获取各班级任务完成率对比
 */
router.get('/task-completion', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({ code: 200, data: mockTaskCompletionData });
});

/**
 * GET /api/teacher-home/activity-trend
 * 获取学生活跃度趋势（最近7天）
 */
router.get('/activity-trend', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({ code: 200, data: mockActivityTrendData });
});

/**
 * GET /api/teacher-home/error-type-distribution
 * 获取错题类型分布
 */
router.get('/error-type-distribution', authMiddleware, async (req, res) => {
  await delay(300);
  return res.json({ code: 200, data: mockErrorTypeDistributionData });
});

// ==================== 任务管理相关接口 ====================

// 任务列表数据
const mockTaskListData = [
  {
    id: 1,
    taskName: '第三单元单词测试',
    classLevel: 'A',
    className: 'A级-英语精英班',
    questionCount: 50,
    startTime: '2026-04-15 08:00:00',
    deadline: '2026-04-25 23:59:59',
    completedCount: 20,
    totalStudents: 25,
    createTime: '2026-04-14 10:00:00',
    questions: [
      { type: 'choice', content: 'What is the meaning of "beautiful"?', options: ['美丽的', '丑陋的', '普通的', '奇怪的'], correctIndexes: [0] },
      { type: 'choice', content: 'What is the meaning of "happy"?', options: ['悲伤的', '开心的', '愤怒的', '惊讶的'], correctIndexes: [1] },
      { type: 'fill-blank', content: 'The opposite of "fast" is ___.', answer: 'slow' },
      { type: 'spell', content: '请写出"学习"对应的英文单词', answer: 'study' }
    ]
  },
  {
    id: 2,
    taskName: '第四单元单词测试',
    classLevel: 'B',
    className: 'B级-英语进阶班',
    questionCount: 40,
    startTime: '2026-04-16 08:00:00',
    deadline: '2026-04-26 23:59:59',
    completedCount: 28,
    totalStudents: 35,
    createTime: '2026-04-15 14:00:00',
    questions: [
      { type: 'choice', content: 'What is the meaning of "computer"?', options: ['电视', '电脑', '手机', '平板'], correctIndexes: [1] },
      { type: 'fill-blank', content: '"学习"用英文是 ___.', answer: 'study' },
      { type: 'spell', content: '请写出"朋友"对应的英文单词', answer: 'friend' }
    ]
  },
  {
    id: 3,
    taskName: '基础词汇练习',
    classLevel: 'C',
    className: 'C级-英语提高班',
    questionCount: 30,
    startTime: '2026-04-17 08:00:00',
    deadline: '2026-04-27 23:59:59',
    completedCount: 40,
    totalStudents: 48,
    createTime: '2026-04-16 09:00:00',
    questions: [
      { type: 'choice', content: 'What is the meaning of "book"?', options: ['书', '笔', '桌子', '椅子'], correctIndexes: [0] },
      { type: 'fill-blank', content: '"书"用英文是 ___.', answer: 'book' }
    ]
  },
  {
    id: 4,
    taskName: '入门测试',
    classLevel: 'D',
    className: 'D级-英语基础班',
    questionCount: 20,
    startTime: '2026-04-18 08:00:00',
    deadline: '2026-04-28 23:59:59',
    completedCount: 35,
    totalStudents: 48,
    createTime: '2026-04-17 11:00:00',
    questions: [
      { type: 'choice', content: 'What is the meaning of "cat"?', options: ['狗', '猫', '鸟', '鱼'], correctIndexes: [1] },
      { type: 'spell', content: '请写出"猫"对应的英文单词', answer: 'cat' }
    ]
  },
  {
    id: 5,
    taskName: '第二单元单词测试',
    classLevel: 'A',
    className: 'A级-英语精英班',
    questionCount: 45,
    startTime: '2026-04-10 08:00:00',
    deadline: '2026-04-20 23:59:59',
    completedCount: 25,
    totalStudents: 25,
    createTime: '2026-04-09 15:00:00',
    questions: [
      { type: 'choice', content: 'What is the meaning of "school"?', options: ['学校', '医院', '商场', '公园'], correctIndexes: [0] }
    ]
  },
  {
    id: 6,
    taskName: '综合练习',
    classLevel: 'B',
    className: 'B级-英语进阶班',
    questionCount: 35,
    startTime: '2026-04-12 08:00:00',
    deadline: '2026-04-22 23:59:59',
    completedCount: 30,
    totalStudents: 35,
    createTime: '2026-04-11 10:00:00',
    questions: []
  }
];

/**
 * GET /api/teacher-home/task/list
 * 获取任务列表（支持班级等级筛选）
 */
router.get('/task/list', authMiddleware, async (req, res) => {
  await delay(300);
  const { classLevel, pageNum = 1, pageSize = 10 } = req.query;
  
  let filteredList = [...mockTaskListData];
  
  // 按班级等级筛选
  if (classLevel) {
    filteredList = filteredList.filter(t => t.classLevel === classLevel);
  }
  
  // 分页
  const start = (parseInt(pageNum) - 1) * parseInt(pageSize);
  const end = start + parseInt(pageSize);
  
  // 返回列表时不包含题目详情
  const listWithoutQuestions = filteredList.slice(start, end).map(t => ({
    id: t.id,
    taskName: t.taskName,
    classLevel: t.classLevel,
    className: t.className,
    questionCount: t.questionCount,
    startTime: t.startTime,
    deadline: t.deadline,
    completedCount: t.completedCount,
    totalStudents: t.totalStudents,
    createTime: t.createTime
  }));
  
  return res.json({
    code: 200,
    rows: listWithoutQuestions,
    total: filteredList.length
  });
});

/**
 * GET /api/teacher-home/task/:taskId
 * 获取任务详情（包含题目列表）
 */
router.get('/task/:taskId', authMiddleware, async (req, res) => {
  await delay(300);
  const taskId = parseInt(req.params.taskId);
  const task = mockTaskListData.find(t => t.id === taskId);
  
  if (!task) {
    return res.json({ code: 404, msg: '任务不存在' });
  }
  
  return res.json({
    code: 200,
    data: task
  });
});

/**
 * POST /api/teacher-home/task/:taskId/remind
 * 督促学生完成任务
 */
router.post('/task/:taskId/remind', authMiddleware, async (req, res) => {
  await delay(300);
  const taskId = parseInt(req.params.taskId);
  const task = mockTaskListData.find(t => t.id === taskId);
  
  if (!task) {
    return res.json({ code: 404, msg: '任务不存在' });
  }
  
  // 计算未完成人数
  const notCompletedCount = task.totalStudents - task.completedCount;
  
  return res.json({
    code: 200,
    msg: `督促提醒已发送至 ${notCompletedCount} 位未完成作业的学生`
  });
});

// ==================== 错题管理相关接口 ====================

// 错题列表数据
const mockErrorListData = [
  {
    questionId: 1,
    questionType: '3',
    questionContent: 'I still remember the days _____ we spent together.',
    correctAnswer: 'which',
    wrongAnswer: 'ex sed',
    classLevel: 'A',
    wrongCount: 1,
    taskName: '定语从句专项练习',
    createTime: '2026-03-11 17:28:00',
    mastered: false
  },
  {
    questionId: 2,
    questionType: '1',
    questionContent: "What is the antonym of 'beautiful'?",
    options: { A: 'ugly', B: 'beautiful', C: 'ordinary', D: 'strange' },
    correctAnswer: 'A',
    wrongAnswer: 'A',
    classLevel: 'B',
    wrongCount: 1,
    taskName: '词汇测试',
    createTime: '2026-03-10 15:20:00',
    mastered: false
  },
  {
    questionId: 3,
    questionType: '2',
    questionContent: '拼写单词：苹果',
    correctAnswer: 'apple',
    wrongAnswer: 'appple',
    classLevel: 'C',
    wrongCount: 1,
    taskName: '单词拼写练习',
    createTime: '2026-03-09 10:00:00',
    mastered: false
  },
  {
    questionId: 4,
    questionType: '1',
    questionContent: 'What is the meaning of "happy"?',
    options: { A: 'sad', B: 'happy', C: 'angry', D: 'surprised' },
    correctAnswer: 'B',
    wrongAnswer: 'C',
    classLevel: 'A',
    wrongCount: 2,
    taskName: '情绪词汇测试',
    createTime: '2026-03-08 14:30:00',
    mastered: true
  },
  {
    questionId: 5,
    questionType: '3',
    questionContent: 'The capital of France is ___.',
    correctAnswer: 'Paris',
    wrongAnswer: 'London',
    classLevel: 'B',
    wrongCount: 1,
    taskName: '国家首都测试',
    createTime: '2026-03-07 09:15:00',
    mastered: false
  }
];

/**
 * GET /api/teacher-home/error/list
 * 获取错题列表（支持搜索筛选）
 */
router.get('/error/list', authMiddleware, async (req, res) => {
  await delay(300);
  const { startDate, endDate, questionType, classLevel, pageNum = 1, pageSize = 10 } = req.query;
  
  let filteredList = [...mockErrorListData];
  
  // 按时间范围筛选
  if (startDate) {
    filteredList = filteredList.filter(e => e.createTime >= startDate);
  }
  if (endDate) {
    filteredList = filteredList.filter(e => e.createTime <= endDate + ' 23:59:59');
  }
  
  // 按题目类型筛选
  if (questionType) {
    filteredList = filteredList.filter(e => e.questionType === questionType);
  }
  
  // 按班级等级筛选
  if (classLevel) {
    filteredList = filteredList.filter(e => e.classLevel === classLevel);
  }
  
  // 分页
  const start = (parseInt(pageNum) - 1) * parseInt(pageSize);
  const end = start + parseInt(pageSize);
  
  return res.json({
    code: 200,
    rows: filteredList.slice(start, end),
    total: filteredList.length
  });
});

/**
 * GET /api/teacher-home/error/template
 * 下载错题导入模板
 */
router.get('/error/template', authMiddleware, async (req, res) => {
  await delay(300);
  
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('错题导入模板');
  
  // 设置列宽
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
  
  // 设置表头样式
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
  
  // 添加示例数据
  worksheet.addRows([
    { questionType: 3, taskName: '定语从句专项练习', errorDate: '2026-03-11 17:28', questionContent: 'I still remember the days _____ we spent together.', correctAnswer: 'which', wrongAnswer: 'ex sed', wrongCount: 1, mastered: 0 },
    { questionType: 1, taskName: '词汇测试', errorDate: '2026-03-10 15:20', questionContent: "What is the antonym of 'beautiful'?", correctAnswer: 'C', wrongAnswer: 'A', wrongCount: 1, mastered: 0 },
    { questionType: 2, taskName: '单词拼写练习', errorDate: '2026-03-09 10:00', questionContent: '拼写单词：苹果', correctAnswer: 'apple', wrongAnswer: 'appple', wrongCount: 1, mastered: 0 }
  ]);
  
  // 设置响应头
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="error_template.xlsx"');
  
  // 写入文件并发送到响应
  await workbook.xlsx.write(res);
  res.end();
});

/**
 * GET /api/teacher-home/error/export
 * 导出错题（Excel/PDF）
 */
router.get('/error/export', authMiddleware, async (req, res) => {
  await delay(500);
  const { format, scope, questionIds, startDate, endDate, questionType, classLevel } = req.query;
  
  if (!format || !['excel', 'pdf'].includes(format)) {
    return res.json({ code: 400, msg: '请指定导出格式（excel/pdf）' });
  }
  
  let exportData = [...mockErrorListData];
  
  // 如果是筛选导出，应用筛选条件
  if (scope === 'filtered') {
    if (questionIds) {
      const ids = questionIds.split(',').map(id => parseInt(id));
      exportData = exportData.filter(e => ids.includes(e.questionId));
    }
    if (startDate) {
      exportData = exportData.filter(e => e.createTime >= startDate);
    }
    if (endDate) {
      exportData = exportData.filter(e => e.createTime <= endDate + ' 23:59:59');
    }
    if (questionType) {
      exportData = exportData.filter(e => e.questionType === questionType);
    }
    if (classLevel) {
      exportData = exportData.filter(e => e.classLevel === classLevel);
    }
  }
  
  if (format === 'excel') {
    // 生成 Excel 文件
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('错题记录');
    
    worksheet.columns = [
      { header: '题目ID', key: 'questionId', width: 10 },
      { header: '题目类型(1选择题 2单词拼写 3填空题)', key: 'questionType', width: 20 },
      { header: '题目内容', key: 'questionContent', width: 40 },
      { header: '正确答案', key: 'correctAnswer', width: 20 },
      { header: '学生答案', key: 'wrongAnswer', width: 20 },
      { header: '班级等级', key: 'classLevel', width: 12 },
      { header: '错误次数', key: 'wrongCount', width: 10 },
      { header: '任务名称', key: 'taskName', width: 20 },
      { header: '创建时间', key: 'createTime', width: 20 },
      { header: '是否已掌握(0未掌握 1已掌握)', key: 'mastered', width: 20 }
    ];
    
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    
    exportData.forEach(item => {
      worksheet.addRow({
        questionId: item.questionId,
        questionType: item.questionType,
        questionContent: item.questionContent,
        correctAnswer: item.correctAnswer,
        wrongAnswer: item.wrongAnswer,
        classLevel: item.classLevel,
        wrongCount: item.wrongCount,
        taskName: item.taskName,
        createTime: item.createTime,
        mastered: item.mastered ? 1 : 0
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="error_export.xlsx"');
    
    await workbook.xlsx.write(res);
    res.end();
  } else if (format === 'pdf') {
    // 生成 PDF 文件
    const PDFDocument = require('pdfkit');
    const path = require('path');
    
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    
    // 注册中文字体
    const fontPath = path.join(__dirname, '../fonts/NotoSansSC-Regular.otf');
    doc.registerFont('Chinese', fontPath);
    doc.font('Chinese');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="error_export.pdf"');
    
    doc.pipe(res);
    
    // 标题
    doc.fontSize(18).text('错题记录', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
    doc.moveDown();
    
    // 表格头
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
    
    const questionTypeMap = { '1': '选择题', '2': '单词拼写', '3': '填空题' };
    
    exportData.forEach(item => {
      x = 30;
      const row = [
        String(item.questionId),
        questionTypeMap[item.questionType] || item.questionType,
        (item.questionContent || '').substring(0, 20),
        item.correctAnswer || '',
        item.wrongAnswer || '',
        item.classLevel || '',
        String(item.wrongCount),
        (item.taskName || '').substring(0, 10),
        (item.createTime || '').substring(0, 10),
        item.mastered ? '已掌握' : '未掌握'
      ];
      
      row.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      
      y += 15;
      if (y > 550) {
        doc.addPage();
        y = 30;
      }
    });
    
    doc.end();
  }
});

/**
 * POST /api/teacher-home/error/import
 * 导入错题（Excel文件）
 */
router.post('/error/import', authMiddleware, upload.single('file'), async (req, res) => {
  await delay(500);
  
  const { file } = req;
  
  if (!file) {
    return res.json({ code: 400, msg: '请上传文件' });
  }
  
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);
    
    const importedData = [];
    let maxQuestionId = mockErrorListData.length > 0 
      ? Math.max(...mockErrorListData.map(e => e.questionId)) 
      : 0;
    
    // 从第2行开始读取（跳过表头）
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      
      const values = row.values;
      const questionType = values[1];
      const taskName = values[2];
      const errorDate = values[3];
      const questionContent = values[4];
      const correctAnswer = values[5];
      const wrongAnswer = values[6];
      const wrongCount = values[7];
      const mastered = values[8];
      
      // 跳过空行
      if (!questionType || !questionContent) return;
      
      maxQuestionId++;
      importedData.push({
        questionId: maxQuestionId,
        questionType: String(questionType),
        questionContent: questionContent,
        correctAnswer: correctAnswer,
        wrongAnswer: wrongAnswer,
        classLevel: 'A', // 默认班级
        wrongCount: wrongCount || 1,
        taskName: taskName || '',
        createTime: errorDate || new Date().toISOString().slice(0, 19).replace('T', ' '),
        mastered: mastered === 1
      });
    });
    
    // 添加到数据列表
    mockErrorListData.push(...importedData);
    
    return res.json({
      code: 200,
      msg: `成功导入 ${importedData.length} 条错题记录`
    });
  } catch (error) {
    console.error('导入错误:', error);
    return res.json({
      code: 500,
      msg: '文件解析失败，请检查文件格式'
    });
  }
});

/**
 * POST /api/teacher-home/error/batch-delete
 * 批量删除错题
 */
router.post('/error/batch-delete', authMiddleware, async (req, res) => {
  await delay(300);
  const { questionIds } = req.body;
  
  if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
    return res.json({ code: 400, msg: '请选择要删除的错题' });
  }
  
  // 模拟批量删除
  const deleteCount = questionIds.length;
  
  return res.json({
    code: 200,
    msg: `成功删除 ${deleteCount} 条错题记录`
  });
});

/**
 * GET /api/teacher-home/error/:questionId
 * 获取错题详情
 */
router.get('/error/:questionId', authMiddleware, async (req, res) => {
  await delay(300);
  const questionId = parseInt(req.params.questionId);
  const error = mockErrorListData.find(e => e.questionId === questionId);
  
  if (!error) {
    return res.json({ code: 404, msg: '错题记录不存在' });
  }
  
  const errorDate = error.createTime ? error.createTime.split(' ')[0] : '';
  
  return res.json({
    code: 200,
    data: {
      ...error,
      errorDate
    }
  });
});

/**
 * DELETE /api/teacher-home/error/:questionId
 * 删除单条错题
 */
router.delete('/error/:questionId', authMiddleware, async (req, res) => {
  await delay(300);
  const questionId = parseInt(req.params.questionId);
  const index = mockErrorListData.findIndex(e => e.questionId === questionId);
  
  if (index === -1) {
    return res.json({ code: 404, msg: '错题记录不存在' });
  }
  
  // 模拟删除
  mockErrorListData.splice(index, 1);
  
  return res.json({
    code: 200,
    msg: '删除成功'
  });
});

module.exports = router;