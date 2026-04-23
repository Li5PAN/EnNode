const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 测试连接
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL 数据库连接成功！');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL 数据库连接失败:', error.message);
    return false;
  }
}

// 定期保活检测（每 5 分钟执行一次）
setInterval(async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
  } catch (error) {
    console.warn('⚠️ 数据库连接保活检测失败:', error.message);
  }
}, 300000);

// 优雅关闭连接池
async function closePool() {
  try {
    await pool.end();
    console.log('✅ 数据库连接池已关闭');
  } catch (error) {
    console.error('❌ 关闭连接池失败:', error.message);
  }
}

// 进程退出时关闭连接池
process.on('SIGINT', async () => {
  await closePool();
  process.exit();
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit();
});

module.exports = {
  pool,
  testConnection,
  closePool
};
