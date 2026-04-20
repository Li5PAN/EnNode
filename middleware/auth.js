const jwt = require('jsonwebtoken');

const SECRET = 'node_json_api_secret_2024';

/**
 * 验证 JWT Token 中间件
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ code: 401, message: '未提供 Token，请先登录' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded; // 将用户信息挂载到 req 上
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: 'Token 无效或已过期，请重新登录' });
  }
}

/**
 * 仅 admin 可访问的中间件
 */
function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ code: 403, message: '权限不足，仅管理员可操作' });
}

/**
 * teacher 和 admin 可访问
 */
function teacherOrAdmin(req, res, next) {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ code: 403, message: '权限不足，仅教师或管理员可操作' });
}

module.exports = { authMiddleware, adminOnly, teacherOrAdmin, SECRET };
