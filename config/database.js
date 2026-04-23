/**
 * MySQL 数据库配置
 */
module.exports = {
  host: '106.52.154.12',
  port: 3306,
  user: 'elia',
  password: 'TGtas7HfL88FM22r',
  database: 'elia',
  waitForConnections: true,
  connectionLimit: 10,      // 连接池大小
  queueLimit: 0,
  // 连接保活和重连配置
  connectTimeout: 20000,    // 连接超时 20秒
  acquireTimeout: 30000,    // 获取连接超时 30秒
  timeout: 60000,           // 查询超时 60秒
  enableKeepAlive: true,    // 启用 TCP KeepAlive
  keepAliveInitialDelay: 30000,  // KeepAlive 初始延迟 30秒
  // 连接空闲时自动断开重连
  idleTimeout: 300000,      // 空闲 5 分钟后断开
  // 重连配置
  multipleStatements: false,
  charset: 'utf8mb4'
};
