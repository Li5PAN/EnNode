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

module.exports = {
  pool,
  testConnection
};
