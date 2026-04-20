const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const authRouter        = require('./routes/auth');
const studentsRouter    = require('./routes/students');
const coursesRouter     = require('./routes/courses');
const usersRouter       = require('./routes/users');
const studentHomeRouter = require('./routes/studentHome');
const studentWordsRouter = require('./routes/studentWords');

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
        'GET    /api/student-words':            '获取单词列表（分页）',
        'GET    /api/student-words/all':        '获取所有单词',
        'GET    /api/student-words/search':     '搜索单词',
        'GET    /api/student-words/collections': '获取收藏列表',
        'POST   /api/student-words/collect':    '收藏/取消收藏',
        'DELETE /api/student-words/collections': '删除收藏',
        'POST   /api/student-words/match':      '单词答案匹配',
        'GET    /api/student-words/task/:id':   '获取任务单词'
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
app.listen(PORT, () => {
  console.log(`✅ 服务已启动：http://localhost:${PORT}`);
  console.log(`📄 接口文档：  http://localhost:${PORT}/`);
});
