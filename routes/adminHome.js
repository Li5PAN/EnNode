const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /api/admin-home/overview
 * 获取数据概览
 */
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    // 获取用户统计
    const [userRows] = await pool.query(
      `SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN user_type = '02' THEN 1 ELSE 0 END) as total_students,
        SUM(CASE WHEN user_type = '01' THEN 1 ELSE 0 END) as total_teachers
       FROM sys_user WHERE del_flag = '0'`
    );

    // 获取班级统计
    const [classRows] = await pool.query(
      'SELECT COUNT(*) as total_classes FROM elia_class WHERE class_status = "1"'
    );

    // 获取今日活跃用户
    const today = new Date().toISOString().split('T')[0];
    const [activeRows] = await pool.query(
      'SELECT COUNT(DISTINCT user_id) as active_today FROM elia_learning_record WHERE record_date = ?',
      [today]
    );

    // 获取待审核申请数
    const [pendingRows] = await pool.query(
      'SELECT COUNT(*) as pending_applications FROM elia_class WHERE class_status = "0"'
    );

    // 获取本月新增统计
    const [monthRows] = await pool.query(
      `SELECT 
        SUM(CASE WHEN user_type = '02' AND DATE(create_time) >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as month_new_students,
        SUM(CASE WHEN user_type = '01' AND DATE(create_time) >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as month_new_teachers
       FROM sys_user WHERE del_flag = '0'`
    );

    const [monthClassRows] = await pool.query(
      `SELECT COUNT(*) as month_new_classes 
       FROM elia_class 
       WHERE class_status = '1' AND DATE(create_time) >= DATE_FORMAT(NOW(), '%Y-%m-01')`
    );

    return res.json({
      code: 200,
      data: {
        totalUsers: userRows[0].total_users || 0,
        totalStudents: userRows[0].total_students || 0,
        totalTeachers: userRows[0].total_teachers || 0,
        totalClasses: classRows[0].total_classes || 0,
        activeToday: activeRows[0].active_today || 0,
        pendingApplications: pendingRows[0].pending_applications || 0,
        monthNewStudents: monthRows[0].month_new_students || 0,
        monthNewTeachers: monthRows[0].month_new_teachers || 0,
        monthNewClasses: monthClassRows[0].month_new_classes || 0
      }
    });
  } catch (error) {
    console.error('获取数据概览错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin-home/level-distribution
 * 获取各等级班级分布
 */
router.get('/level-distribution', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        c.class_level as level,
        COUNT(DISTINCT c.class_id) as classCount,
        COALESCE(SUM(cm.member_count), 0) as studentCount
       FROM elia_class c
       LEFT JOIN (
         SELECT class_id, COUNT(*) as member_count 
         FROM elia_class_member 
         WHERE member_status = '1'
         GROUP BY class_id
       ) cm ON c.class_id = cm.class_id
       WHERE c.class_status = '1'
       GROUP BY c.class_level
       ORDER BY c.class_level ASC`
    );

    const total = rows.reduce((sum, r) => sum + r.classCount, 0);
    const data = rows.map(r => ({
      level: `${r.level}级`,
      classCount: r.classCount,
      studentCount: r.studentCount,
      percentage: total > 0 ? Math.round((r.classCount / total) * 100) : 0
    }));

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取班级等级分布错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin-home/user-growth-trend
 * 获取用户增长趋势
 */
router.get('/user-growth-trend', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        DATE(create_time) as date,
        SUM(CASE WHEN user_type = '02' THEN 1 ELSE 0 END) as newStudents,
        SUM(CASE WHEN user_type = '01' THEN 1 ELSE 0 END) as newTeachers,
        COUNT(*) as newUsers
       FROM sys_user 
       WHERE del_flag = '0' AND create_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(create_time)
       ORDER BY date ASC`
    );

    // 填充缺失的日期
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const record = rows.find(r => r.date.toISOString().split('T')[0] === dateStr);
      data.push({
        date: dateStr,
        newStudents: record?.newStudents || 0,
        newTeachers: record?.newTeachers || 0,
        newUsers: record?.newUsers || 0
      });
    }

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取用户增长趋势错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin-home/class-change-trend
 * 获取换班变化趋势
 */
router.get('/class-change-trend', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        DATE(create_time) as date,
        SUM(CASE WHEN application_type = '3' AND application_status = '1' THEN 1 ELSE 0 END) as transferOut,
        SUM(CASE WHEN application_type = '3' AND application_status = '1' THEN 1 ELSE 0 END) as transferIn
       FROM elia_class_application 
       WHERE create_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(create_time)
       ORDER BY date ASC`
    );

    // 填充缺失的日期
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const record = rows.find(r => r.date.toISOString().split('T')[0] === dateStr);
      data.push({
        date: dateStr,
        transferOut: record?.transferOut || 0,
        transferIn: record?.transferIn || 0
      });
    }

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取换班变化趋势错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin-home/drop-class-trend
 * 获取退班变化趋势
 */
router.get('/drop-class-trend', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        DATE(leave_time) as date,
        COUNT(*) as dropCount
       FROM elia_class_member 
       WHERE member_status = '0' AND leave_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(leave_time)
       ORDER BY date ASC`
    );

    // 填充缺失的日期
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const record = rows.find(r => r.date.toISOString().split('T')[0] === dateStr);
      data.push({
        date: dateStr,
        dropCount: record?.dropCount || 0
      });
    }

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取退班变化趋势错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin-home/class-create-trend
 * 获取班级创建趋势
 */
router.get('/class-create-trend', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        DATE(create_time) as date,
        COUNT(*) as classCount
       FROM elia_class 
       WHERE class_status = '1' AND create_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(create_time)
       ORDER BY date ASC`
    );

    // 填充缺失的日期
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const record = rows.find(r => r.date.toISOString().split('T')[0] === dateStr);
      data.push({
        date: dateStr,
        classCount: record?.classCount || 0
      });
    }

    return res.json({ code: 200, data });
  } catch (error) {
    console.error('获取班级创建趋势错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin-home/class-review/list
 * 获取待审核班级列表（支持按老师名字搜索）
 */
router.get('/class-review/list', authMiddleware, async (req, res) => {
  const { teacherName, pageNum = 1, pageSize = 10 } = req.query;

  try {
    let sql = `
      SELECT c.*, u.nick_name as teacher_name
      FROM elia_class c
      LEFT JOIN sys_user u ON c.teacher_id = u.user_id
      WHERE c.class_status = '0'
    `;
    let countSql = 'SELECT COUNT(*) as total FROM elia_class c LEFT JOIN sys_user u ON c.teacher_id = u.user_id WHERE c.class_status = "0"';
    const params = [];
    const countParams = [];

    if (teacherName) {
      sql += ' AND u.nick_name LIKE ?';
      countSql += ' AND u.nick_name LIKE ?';
      params.push(`%${teacherName}%`);
      countParams.push(`%${teacherName}%`);
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
      maxStudents: c.max_students,
      taskCount: c.task_requirement || 0,
      createTime: c.create_time,
      teacherId: c.teacher_id,
      teacherName: c.teacher_name
    }));

    return res.json({ code: 200, rows: list, total });
  } catch (error) {
    console.error('获取待审核班级列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin-home/class-review/management-list
 * 获取已通过班级列表（支持按老师名字搜索）
 */
router.get('/class-review/management-list', authMiddleware, async (req, res) => {
  const { teacherName, classLevel, pageNum = 1, pageSize = 10 } = req.query;

  try {
    let sql = `
      SELECT c.*, u.nick_name as teacher_name
      FROM elia_class c
      LEFT JOIN sys_user u ON c.teacher_id = u.user_id
      WHERE c.class_status = '1'
    `;
    let countSql = 'SELECT COUNT(*) as total FROM elia_class c LEFT JOIN sys_user u ON c.teacher_id = u.user_id WHERE c.class_status = "1"';
    const params = [];
    const countParams = [];

    if (teacherName) {
      sql += ' AND u.nick_name LIKE ?';
      countSql += ' AND u.nick_name LIKE ?';
      params.push(`%${teacherName}%`);
      countParams.push(`%${teacherName}%`);
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
    console.error('获取已通过班级列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/admin-home/class-review/approve/:classId
 * 审核通过班级
 * @param {number} classId - 班级ID（路径参数）
 * @param {object} body - 请求体
 * @param {string} [body.reason] - 审核原因（可选）
 */
router.post('/class-review/approve/:classId', authMiddleware, async (req, res) => {
  const classId = parseInt(req.params.classId);
  const { reason } = req.body || {};

  try {
    // If reason provided, store it; otherwise just approve
    if (reason) {
      await pool.query(
        'UPDATE elia_class SET class_status = "1", audit_reason = ? WHERE class_id = ? AND class_status = "0"',
        [reason, classId]
      );
    } else {
      await pool.query(
        'UPDATE elia_class SET class_status = "1" WHERE class_id = ? AND class_status = "0"',
        [classId]
      );
    }

    // Check if update was successful
    const [checkResult] = await pool.query(
      'SELECT class_id FROM elia_class WHERE class_id = ? AND class_status = "1"',
      [classId]
    );

    if (checkResult.length === 0) {
      return res.json({ code: 404, msg: '待审核班级不存在' });
    }

    return res.json({ code: 200, msg: '班级审核通过' });
  } catch (error) {
    console.error('审核班级错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/admin-home/class-review/reject/:classId
 * 拒绝班级
 * @param {number} classId - 班级ID（路径参数）
 * @param {object} body - 请求体
 * @param {string} body.reason - 拒绝原因（必填）
 */
router.post('/class-review/reject/:classId', authMiddleware, async (req, res) => {
  const classId = parseInt(req.params.classId);
  const { reason } = req.body || {};

  if (!reason) {
    return res.json({ code: 400, msg: '请填写拒绝原因' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE elia_class SET class_status = "2", audit_reason = ? WHERE class_id = ? AND class_status = "0"',
      [reason, classId]
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
 * DELETE /api/admin-home/class-review/delete/:classId
 * 删除班级
 */
router.delete('/class-review/delete/:classId', authMiddleware, async (req, res) => {
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
 * GET /api/admin-home/user/list
 * 获取人员列表（支持身份筛选、搜索）
 */
router.get('/user/list', authMiddleware, async (req, res) => {
  const { role, keyword, pageNum = 1, pageSize = 10 } = req.query;

  try {
    let sql = `
      SELECT u.*, c.class_name, c.class_level
      FROM sys_user u
      LEFT JOIN elia_class c ON u.current_class_id = c.class_id
      WHERE u.del_flag = '0'
    `;
    let countSql = 'SELECT COUNT(*) as total FROM sys_user WHERE del_flag = "0"';
    const params = [];
    const countParams = [];

    // 按身份筛选
    if (role === 'student') {
      sql += ' AND u.user_type = "02"';
      countSql += ' AND user_type = "02"';
    } else if (role === 'teacher') {
      sql += ' AND u.user_type = "01"';
      countSql += ' AND user_type = "01"';
    }

    // 按关键字搜索
    if (keyword) {
      sql += ' AND (u.nick_name LIKE ? OR u.user_name LIKE ?)';
      countSql += ' AND (nick_name LIKE ? OR user_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 获取总数
    const [countRows] = await pool.query(countSql, countParams);
    const total = countRows[0].total;

    // 分页
    const offset = (parseInt(pageNum) - 1) * parseInt(pageSize);
    sql += ' ORDER BY u.create_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [rows] = await pool.query(sql, params);

    const list = rows.map(u => ({
      userId: u.user_id,
      userName: u.user_name,
      nickName: u.nick_name,
      roleType: u.user_type === '01' ? 'teacher' : (u.user_type === '02' ? 'student' : 'admin'),
      role: u.user_type === '01' ? 'teacher' : (u.user_type === '02' ? 'student' : 'admin'),
      className: u.class_name,
      classLevel: u.class_level,
      email: u.email,
      phonenumber: u.phonenumber,
      createTime: u.create_time
    }));

    return res.json({ code: 200, rows: list, total });
  } catch (error) {
    console.error('获取人员列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin-home/user/:userId
 * 获取人员详情
 */
router.get('/user/:userId', authMiddleware, async (req, res) => {
  const userId = parseInt(req.params.userId);

  try {
    const [rows] = await pool.query(
      `SELECT u.*, c.class_name, c.class_level
       FROM sys_user u
       LEFT JOIN elia_class c ON u.current_class_id = c.class_id
       WHERE u.user_id = ? AND u.del_flag = '0'`,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({ code: 404, msg: '用户不存在' });
    }

    const u = rows[0];
    return res.json({
      code: 200,
      data: {
        userId: u.user_id,
        userName: u.user_name,
        nickName: u.nick_name,
        roleType: u.user_type === '01' ? 'teacher' : (u.user_type === '02' ? 'student' : 'admin'),
        role: u.user_type === '01' ? 'teacher' : (u.user_type === '02' ? 'student' : 'admin'),
        className: u.class_name,
        classLevel: u.class_level,
        email: u.email,
        phonenumber: u.phonenumber,
        avatar: u.avatar,
        status: u.status,
        createTime: u.create_time,
        totalStudyTime: u.total_study_time,
        totalWordsSearched: u.total_words_searched,
        totalTasksCompleted: u.total_tasks_completed
      }
    });
  } catch (error) {
    console.error('获取人员详情错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * DELETE /api/admin-home/user/:userId
 * 删除人员
 */
router.delete('/user/:userId', authMiddleware, async (req, res) => {
  const userId = parseInt(req.params.userId);

  try {
    // 软删除
    const [result] = await pool.query(
      'UPDATE sys_user SET del_flag = "1" WHERE user_id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.json({ code: 404, msg: '用户不存在' });
    }

    return res.json({ code: 200, msg: '删除成功' });
  } catch (error) {
    console.error('删除人员错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
