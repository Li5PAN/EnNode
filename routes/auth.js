const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { pool } = require('../db/pool');
const { SECRET } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * 注册接口
 * Body: { username, password, code }
 * code: student(学生) / teacher(教师)
 */
router.post('/register', async (req, res) => {
  const { username, password, code } = req.body;

  // 验证必填字段
  if (!username || !password || !code) {
    return res.status(400).json({ code: 400, message: '账号、密码和身份不能为空' });
  }

  // 验证用户名长度
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ code: 400, message: '账号长度应在3-30个字符之间' });
  }

  // 验证密码长度
  if (password.length < 6) {
    return res.status(400).json({ code: 400, message: '密码长度不能少于6个字符' });
  }

  // 验证身份类型
  if (!['student', 'teacher'].includes(code)) {
    return res.status(400).json({ code: 400, message: '身份类型不正确' });
  }

  try {
    // 检查用户名是否已存在
    const [existingUsers] = await pool.query(
      'SELECT user_id FROM sys_user WHERE user_name = ? AND del_flag = "0"',
      [username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ code: 400, message: '该账号已存在' });
    }

    // 确定用户类型: student=02, teacher=01
    const userType = code === 'teacher' ? '01' : '02';

    // 创建用户，nick_name 默认使用 username
    const [result] = await pool.query(
      `INSERT INTO sys_user 
       (user_name, nick_name, user_type, password, status, del_flag, create_time)
       VALUES (?, ?, ?, ?, '0', '0', NOW())`,
      [username, username, userType, password]
    );

    const userId = result.insertId;

    // 生成 Token
    const token = jwt.sign(
      { id: userId, username: username, role: code, name: username },
      SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      code: 200,
      message: '注册成功',
      data: {
        token,
        userInfo: {
          id: userId,
          username: username,
          role: code,
          name: username
        }
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/auth/login
 * 登录接口
 * Body: { username, password }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  try {
    // 从数据库查询用户
    const [rows] = await pool.query(
      'SELECT user_id, user_name, nick_name, user_type, status, password FROM sys_user WHERE user_name = ? AND del_flag = "0"',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    const user = rows[0];

    // 验证密码（支持明文和BCrypt加密密码）
    let passwordMatch = false;
    
    if (user.password === password) {
      // 明文密码匹配
      passwordMatch = true;
    } else if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      // BCrypt加密密码，尝试比对
      try {
        const bcrypt = require('bcryptjs');
        passwordMatch = await bcrypt.compare(password, user.password);
      } catch (e) {
        passwordMatch = false;
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    // 检查用户状态
    if (user.status === '1') {
      return res.status(403).json({ code: 403, message: '账号已被禁用' });
    }

    // 确定用户角色
    let role = user.user_type || 'student';
    // user_type: 00=系统用户, 01=教师, 02=学生
    if (user.user_type === '01') {
      role = 'teacher';
    } else if (user.user_type === '02') {
      role = 'student';
    } else if (user.user_type === '00') {
      role = 'admin';
    }

    // 生成 Token，有效期 24 小时
    const token = jwt.sign(
      { id: user.user_id, username: user.user_name, role: role, name: user.nick_name },
      SECRET,
      { expiresIn: '24h' }
    );

    // 更新最后登录时间和IP
    await pool.query(
      'UPDATE sys_user SET login_date = NOW(), login_ip = ? WHERE user_id = ?',
      [req.ip || 'unknown', user.user_id]
    );

    return res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        userInfo: {
          id: user.user_id,
          username: user.user_name,
          role: role,
          name: user.nick_name
        }
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/auth/info
 * 获取当前登录用户信息（需要 Token）
 */
const { authMiddleware } = require('../middleware/auth');

router.get('/info', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // 从数据库获取用户详细信息
    const [rows] = await pool.query(
      `SELECT u.user_id, u.user_name, u.nick_name, u.user_type, u.email, u.phonenumber, 
              u.avatar, u.status, u.user_level, u.total_study_time, u.total_words_searched, 
              u.total_tasks_completed, u.current_class_id
       FROM sys_user u 
       WHERE u.user_id = ? AND u.del_flag = "0"`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    const user = rows[0];

    // 确定用户角色
    let role = user.user_type || 'student';
    if (user.user_type === '01') {
      role = 'teacher';
    } else if (user.user_type === '02') {
      role = 'student';
    } else if (user.user_type === '00') {
      role = 'admin';
    }

    return res.json({
      code: 200,
      message: '获取成功',
      data: {
        id: user.user_id,
        username: user.user_name,
        name: user.nick_name,
        role: role,
        email: user.email,
        phonenumber: user.phonenumber,
        avatar: user.avatar,
        userLevel: user.user_level,
        totalStudyTime: user.total_study_time,
        totalWordsSearched: user.total_words_searched,
        totalTasksCompleted: user.total_tasks_completed,
        currentClassId: user.current_class_id
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
