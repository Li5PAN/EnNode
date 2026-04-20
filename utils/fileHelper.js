const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');

/**
 * 读取 JSON 文件
 */
function readJSON(filename) {
  const filePath = path.join(dataDir, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * 写入 JSON 文件
 */
function writeJSON(filename, data) {
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 生成新 ID（取当前最大 id + 1）
 */
function generateId(list) {
  if (list.length === 0) return 1;
  return Math.max(...list.map(item => item.id)) + 1;
}

module.exports = { readJSON, writeJSON, generateId };
