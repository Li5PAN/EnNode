const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { testConnection } = require('./db/pool');

const authRouter        = require('./routes/auth');
const studentsRouter    = require('./routes/students');
const coursesRouter     = require('./routes/courses');
const usersRouter       = require('./routes/users');
const studentHomeRouter = require('./routes/studentHome');
const studentWordsRouter = require('./routes/studentWords');
const teacherHomeRouter  = require('./routes/teacherHome');
const teacherClassRouter = require('./routes/teacherClass');
const teacherClassDataRouter = require('./routes/teacherClassData');
const studentClassRouter = require('./routes/studentClass');
const studentErrorsRouter = require('./routes/studentErrors');
const studentClassDataRouter = require('./routes/studentClassData');
const adminHomeRouter    = require('./routes/adminHome');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── 中间件 ───────────────────────────────────────────────
// 允许所有来源跨域（前端项目可直接调用）
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ─── 路由 ─────────────────────────────────────────────────
app.use('/api/auth',       authRouter);
app.use('/api/students',   studentsRouter);
app.use('/api/courses',    coursesRouter);
app.use('/api/users',      usersRouter);
app.use('/api/student-home', studentHomeRouter);
app.use('/api/student-words', studentWordsRouter);
app.use('/api/teacher-home',  teacherHomeRouter);
app.use('/api/teacher-class', teacherClassRouter);
app.use('/api/teacher-class-data', teacherClassDataRouter);
app.use('/api/student-class', studentClassRouter);
app.use('/api/student-errors', studentErrorsRouter);
app.use('/api/student-class-data', studentClassDataRouter);
app.use('/api/admin-home',    adminHomeRouter);

// ─── 根路径：接口文档概览 ──────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'Node JSON API',
    version: '1.0.0',
    description: '基于 JSON 文件的 RESTful API，无需数据库',
    endpoints: {
      auth: {
        'POST /api/auth/login': '登录，返回 Token',
        'GET  /api/auth/info':  '获取当前用户信息（需 Token）'
      },
      students: {
        'GET    /api/students':     '获取学生列表（支持 keyword/class/page/pageSize）',
        'GET    /api/students/:id': '获取单个学生',
        'POST   /api/students':     '新增学生（teacher/admin）',
        'PUT    /api/students/:id': '修改学生（teacher/admin）',
        'DELETE /api/students/:id': '删除学生（admin）'
      },
      studentHome: {
        'GET /api/student-home/overview':       '获取学习概览数据',
        'GET /api/student-home/clock-in-status': '获取打卡状态',
        'POST /api/student-home/clock-in':       '打卡',
        'GET /api/student-home/weekly-tasks':    '获取近7天任务完成情况',
        'GET /api/student-home/weekly-words':    '获取近7天单词学习趋势',
        'GET /api/student-home/pending-tasks':   '获取未完成任务列表',
        'GET /api/student-home/class-progress':  '获取班级任务完成进度'
      },
      studentWords: {
        'GET    /api/student-words':              '获取单词列表（分页+搜索）',
        'GET    /api/student-words/search':       '搜索单词（支持中英文）',
        'GET    /api/student-words/favorites':    '获取收藏列表（带搜索）',
        'POST   /api/student-words/collect':      '收藏单词',
        'POST   /api/student-words/uncollect':    '取消收藏',
        'DELETE /api/student-words/favorites/:collectionId': '删除收藏',
        'POST   /api/student-words/spell-check':  '看中文写英文核对',
        'POST   /api/student-words/fill-blank':   '填空题核对',
        'GET    /api/student-words/:wordId':      '获取单词详情'
      },
      teacherHome: {
        'GET /api/teacher-home/dashboard':              '获取教师仪表盘数据（顶部概览）',
        'GET /api/teacher-home/level-distribution':     '获取班级等级分布',
        'GET /api/teacher-home/task-completion':        '获取各班级任务完成率对比',
        'GET /api/teacher-home/activity-trend':         '获取学生活跃度趋势（最近7天）',
        'GET /api/teacher-home/error-type-distribution': '获取错题类型分布',
        'GET /api/teacher-home/task/list':              '获取任务列表（支持等级筛选）',
        'GET /api/teacher-home/task/:taskId':           '获取任务详情（包含题目）',
        'POST /api/teacher-home/task/:taskId/remind':   '督促学生完成任务',
        'GET /api/teacher-home/error/list':             '获取错题列表（支持搜索筛选）',
        'GET /api/teacher-home/error/:questionId':      '获取错题详情',
        'POST /api/teacher-home/error/import':          '导入错题（Excel文件）',
        'GET /api/teacher-home/error/export':           '导出错题（Excel/PDF）',
        'DELETE /api/teacher-home/error/:questionId':   '删除单条错题',
        'POST /api/teacher-home/error/batch-delete':    '批量删除错题',
        'GET /api/teacher-home/error/template':         '下载错题导入模板'
      },
      teacherClass: {
        'GET    /api/teacher-class/overview':        '获取班级概览数据',
        'GET    /api/teacher-class/list':            '获取班级列表（当前老师）',
        'GET    /api/teacher-class/all':             '获取所有班级列表',
        'POST   /api/teacher-class/create':          '创建班级（需审核）',
        'GET    /api/teacher-class/pending':         '获取待审核班级列表',
        'POST   /api/teacher-class/approve/:classId': '审核通过班级',
        'POST   /api/teacher-class/reject/:classId': '拒绝班级',
        'DELETE /api/teacher-class/delete/:classId': '删除班级',
        'POST   /api/teacher-class/publish-task':    '发布任务'
      },
      teacherClassData: {
        'GET /api/teacher-class-data/class-list':           '获取班级下拉列表',
        'GET /api/teacher-class-data/task-completion-chart': '获取班级任务完成对比图数据',
        'GET /api/teacher-class-data/student-activity-chart': '获取学生学习活跃分析图数据',
        'GET /api/teacher-class-data/error-type-chart':      '获取学生错题类型分析图数据'
      },
      studentClass: {
        'GET  /api/student-class/status':       '获取班级状态',
        'GET  /api/student-class/list':         '获取班级列表（支持等级筛选）',
        'GET  /api/student-class/my-class':     '获取我的班级信息',
        'GET  /api/student-class/ranking':      '获取班级排行榜 Top 15',
        'GET  /api/student-class/trend':        '获取班级学习趋势（近8周）',
        'POST /api/student-class/apply':        '申请入班',
        'POST /api/student-class/quit':         '退出班级',
        'POST /api/student-class/change':       '申请换班',
        'GET  /api/student-class/check-apply':  '检查是否可以申请入班'
      },
      studentErrors: {
        'GET    /api/student-errors/overview':      '获取错题统计概览',
        'GET    /api/student-errors/list':          '获取错题列表（支持筛选）',
        'GET    /api/student-errors/:wrongId':      '获取错题详情',
        'POST   /api/student-errors/add':           '手动添加错题',
        'PUT    /api/student-errors/:wrongId':      '编辑错题',
        'DELETE /api/student-errors/:wrongId':      '删除单条错题',
        'POST   /api/student-errors/batch-delete':  '批量删除错题',
        'POST   /api/student-errors/import':        '导入错题（Excel文件）',
        'GET    /api/student-errors/export':        '导出错题（Excel/PDF）',
        'GET    /api/student-errors/template':      '下载导入模板',
        'PUT    /api/student-errors/:wrongId/master': '标记已掌握/未掌握',
        'GET    /api/student-errors/type-stats':    '获取错题类型统计'
      },
      studentClassData: {
        'GET /api/student-class-data/statistics':   '获取顶部统计数据',
        'GET /api/student-class-data/daily-study':  '获取每日学习数据（近7天）',
        'GET /api/student-class-data/compare':      '获取班级vs个人完成率走势（近8周）',
        'GET /api/student-class-data/ranking':      '获取班级排名（支持按学习时长/单词量排序）'
      },
      adminHome: {
        'GET /api/admin-home/overview':            '获取数据概览',
        'GET /api/admin-home/level-distribution':  '获取各等级班级分布',
        'GET /api/admin-home/user-growth-trend':   '获取用户增长趋势',
        'GET /api/admin-home/class-change-trend':  '获取换班变化趋势',
        'GET /api/admin-home/drop-class-trend':    '获取退班变化趋势',
        'GET /api/admin-home/class-create-trend':  '获取班级创建趋势',
        'GET /api/admin-home/class-review/list':   '获取待审核班级列表（支持搜索）',
        'GET /api/admin-home/class-review/management-list': '获取已通过班级列表',
        'POST /api/admin-home/class-review/approve/:classId': '审核通过班级',
        'POST /api/admin-home/class-review/reject/:classId': '拒绝班级',
        'DELETE /api/admin-home/class-review/delete/:classId': '删除班级',
        'GET /api/admin-home/user/list':           '获取人员列表（支持筛选+搜索）',
        'GET /api/admin-home/user/:userId':        '获取人员详情',
        'DELETE /api/admin-home/user/:userId':     '删除人员'
      },
      courses: {
        'GET    /api/courses':     '获取课程列表（支持 keyword/page/pageSize）',
        'GET    /api/courses/:id': '获取单个课程',
        'POST   /api/courses':     '新增课程（teacher/admin）',
        'PUT    /api/courses/:id': '修改课程（teacher/admin）',
        'DELETE /api/courses/:id': '删除课程（admin）'
      },
      users: {
        'GET    /api/users':     '获取用户列表（admin）',
        'GET    /api/users/:id': '获取单个用户（admin）',
        'POST   /api/users':     '新增用户（admin）',
        'PUT    /api/users/:id': '修改用户（admin）',
        'DELETE /api/users/:id': '删除用户（admin）'
      }
    },
    auth_note: '除登录接口外，所有接口需在 Header 中携带：Authorization: Bearer <token>'
  });
});

// ─── 404 处理 ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ code: 404, message: `接口 ${req.method} ${req.path} 不存在` });
});

// ─── 全局错误处理 ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ code: 500, message: '服务器内部错误', error: err.message });
});

// ─── 启动服务 ─────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`✅ 服务已启动：http://localhost:${PORT}`);
  console.log(`📄 接口文档：  http://localhost:${PORT}/`);
  
  // 测试数据库连接
  await testConnection();
});
