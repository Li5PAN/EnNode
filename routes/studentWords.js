const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// 获取当前用户ID
const getUserId = (req) => {
  return req.user?.id || 1;
};

/**
 * GET /api/student-words
 * 获取单词列表（带搜索功能，支持中英文）
 * @query {string} keyword - 搜索关键词（可选）
 * @query {number} page - 页码（默认1）
 * @query {number} pageSize - 每页数量（默认10）
 */
router.get('/', authMiddleware, async (req, res) => {
  const { keyword, page = 1, pageSize = 10 } = req.query;
  const userId = getUserId(req);

  try {
    let sql = 'SELECT * FROM elia_word_library WHERE status = "0"';
    let countSql = 'SELECT COUNT(*) as total FROM elia_word_library WHERE status = "0"';
    const params = [];
    const countParams = [];

    // 搜索功能：支持中英文
    if (keyword) {
      const searchKeyword = `%${keyword}%`;
      sql += ' AND (english_word LIKE ? OR chinese_meaning LIKE ?)';
      countSql += ' AND (english_word LIKE ? OR chinese_meaning LIKE ?)';
      params.push(searchKeyword, searchKeyword);
      countParams.push(searchKeyword, searchKeyword);
    }

    // 分页
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    sql += ' ORDER BY word_id ASC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [rows] = await pool.query(sql, params);
    const [countRows] = await pool.query(countSql, countParams);
    const total = countRows[0].total;

    // 查询用户收藏状态
    const wordIds = rows.map(r => r.word_id);
    let collectionMap = {};
    if (wordIds.length > 0) {
      const [collections] = await pool.query(
        'SELECT word_id, collection_id FROM elia_word_collection WHERE user_id = ? AND word_id IN (?)',
        [userId, wordIds]
      );
      collections.forEach(c => {
        collectionMap[c.word_id] = c.collection_id;
      });
    }

    const records = rows.map(w => ({
      wordId: w.word_id,
      word: w.english_word,
      englishWord: w.english_word,
      ukPhonetic: w.phonetic_uk,
      usPhonetic: w.phonetic_us,
      ukSpeech: w.audio_uk_url,
      usSpeech: w.audio_us_url,
      chineseMeaning: w.chinese_meaning,
      wordType: w.word_type,
      difficultyLevel: w.difficulty_level,
      exampleSentence: w.example_sentence,
      exampleTranslation: w.example_translation,
      imageUrl: w.image_url,
      wordFamily: w.word_family,
      synonymWords: w.synonym_words,
      antonymWords: w.antonym_words,
      isCollected: !!collectionMap[w.word_id],
      collectionId: collectionMap[w.word_id] || null
    }));

    return res.json({
      code: 200,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      rows: records,
      records
    });
  } catch (error) {
    console.error('获取单词列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-words/search
 * 搜索单词（支持中英文）
 * @query {string} keyword - 搜索关键词
 */
router.get('/search', authMiddleware, async (req, res) => {
  const { keyword } = req.query;
  const userId = getUserId(req);

  if (!keyword) {
    return res.json({ success: false, message: '请输入搜索关键词' });
  }

  try {
    const searchKeyword = `%${keyword}%`;
    const [rows] = await pool.query(
      'SELECT * FROM elia_word_library WHERE status = "0" AND (english_word LIKE ? OR chinese_meaning LIKE ?) LIMIT 1',
      [searchKeyword, searchKeyword]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: `未找到"${keyword}"相关的单词` });
    }

    const w = rows[0];

    // 记录搜索日志
    await pool.query(
      'INSERT INTO elia_word_search_log (user_id, search_word, search_type, search_time) VALUES (?, ?, ?, NOW())',
      [userId, keyword, /[\\u4e00-\\u9fa5]/.test(keyword) ? '2' : '1']
    );

    // 查询收藏状态
    const [collections] = await pool.query(
      'SELECT collection_id FROM elia_word_collection WHERE user_id = ? AND word_id = ?',
      [userId, w.word_id]
    );

    return res.json({
      success: true,
      data: {
        wordId: w.word_id,
        word: w.english_word,
        ukPhonetic: w.phonetic_uk,
        usPhonetic: w.phonetic_us,
        ukSpeech: w.audio_uk_url,
        usSpeech: w.audio_us_url,
        chineseMeaning: w.chinese_meaning,
        wordType: w.word_type,
        difficultyLevel: w.difficulty_level,
        exampleSentence: w.example_sentence,
        exampleTranslation: w.example_translation,
        imageUrl: w.image_url,
        wordFamily: w.word_family,
        synonymWords: w.synonym_words,
        antonymWords: w.antonym_words,
        isCollected: collections.length > 0,
        collectionId: collections[0]?.collection_id || null
      }
    });
  } catch (error) {
    console.error('搜索单词错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/student-words/collect
 * 收藏单词
 * @body {number} wordId - 单词ID
 */
router.post('/collect', authMiddleware, async (req, res) => {
  const { wordId } = req.body;
  const userId = getUserId(req);

  if (!wordId) {
    return res.json({ code: 400, msg: '请提供单词ID' });
  }

  try {
    // 检查单词是否存在
    const [wordRows] = await pool.query('SELECT word_id FROM elia_word_library WHERE word_id = ? AND status = "0"', [wordId]);
    if (wordRows.length === 0) {
      return res.json({ code: 400, msg: '单词不存在' });
    }

    // 检查是否已收藏
    const [collectionRows] = await pool.query(
      'SELECT collection_id FROM elia_word_collection WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    if (collectionRows.length > 0) {
      return res.json({ code: 400, msg: '该单词已收藏' });
    }

    // 添加收藏
    await pool.query(
      'INSERT INTO elia_word_collection (user_id, word_id, collection_time, create_time) VALUES (?, ?, NOW(), NOW())',
      [userId, wordId]
    );

    return res.json({ code: 200, msg: '收藏成功' });
  } catch (error) {
    console.error('收藏单词错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/student-words/uncollect
 * 取消收藏
 * @body {number} wordId - 单词ID
 */
router.post('/uncollect', authMiddleware, async (req, res) => {
  const { wordId } = req.body;
  const userId = getUserId(req);

  try {
    const [result] = await pool.query(
      'DELETE FROM elia_word_collection WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );

    if (result.affectedRows === 0) {
      return res.json({ code: 400, msg: '该单词未收藏' });
    }

    return res.json({ code: 200, msg: '取消收藏成功' });
  } catch (error) {
    console.error('取消收藏错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-words/favorites
 * 获取收藏单词列表（带搜索功能）
 * @query {string} keyword - 搜索关键词（可选）
 */
router.get('/favorites', authMiddleware, async (req, res) => {
  const { keyword } = req.query;
  const userId = getUserId(req);

  try {
    let sql = `
      SELECT c.collection_id, c.collection_time, c.tags, c.notes,
             w.word_id, w.english_word, w.phonetic_uk, w.phonetic_us, 
             w.chinese_meaning, w.word_type, w.difficulty_level,
             w.example_sentence, w.example_translation, w.audio_uk_url, w.audio_us_url
      FROM elia_word_collection c
      JOIN elia_word_library w ON c.word_id = w.word_id
      WHERE c.user_id = ? AND w.status = "0"
    `;
    const params = [userId];

    if (keyword) {
      const searchKeyword = `%${keyword}%`;
      sql += ' AND (w.english_word LIKE ? OR w.chinese_meaning LIKE ?)';
      params.push(searchKeyword, searchKeyword);
    }

    sql += ' ORDER BY c.collection_time DESC';

    const [rows] = await pool.query(sql, params);

    const records = rows.map(r => ({
      collectionId: r.collection_id,
      collectionTime: r.collection_time,
      tags: r.tags,
      notes: r.notes,
      wordId: r.word_id,
      word: r.english_word,
      englishWord: r.english_word,
      ukPhonetic: r.phonetic_uk,
      usPhonetic: r.phonetic_us,
      ukSpeech: r.audio_uk_url,
      usSpeech: r.audio_us_url,
      chineseMeaning: r.chinese_meaning,
      wordType: r.word_type,
      difficultyLevel: r.difficulty_level,
      exampleSentence: r.example_sentence,
      exampleTranslation: r.example_translation,
      isCollected: true
    }));

    return res.json({
      code: 200,
      total: records.length,
      rows: records,
      records
    });
  } catch (error) {
    console.error('获取收藏列表错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * DELETE /api/student-words/favorites/:collectionId
 * 删除收藏单词
 * @param {number} collectionId - 收藏ID
 */
router.delete('/favorites/:collectionId', authMiddleware, async (req, res) => {
  const { collectionId } = req.params;
  const userId = getUserId(req);

  try {
    const [result] = await pool.query(
      'DELETE FROM elia_word_collection WHERE collection_id = ? AND user_id = ?',
      [collectionId, userId]
    );

    if (result.affectedRows === 0) {
      return res.json({ code: 400, msg: '收藏不存在' });
    }

    return res.json({ code: 200, msg: '删除成功' });
  } catch (error) {
    console.error('删除收藏错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/student-words/spell-check
 * 根据中文释义拼写单词（看中文写英文）
 * @body {number} wordId - 单词ID
 * @body {string} userAnswer - 用户答案
 */
router.post('/spell-check', authMiddleware, async (req, res) => {
  const { wordId, userAnswer } = req.body;
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      'SELECT word_id, english_word FROM elia_word_library WHERE word_id = ? AND status = "0"',
      [wordId]
    );

    if (rows.length === 0) {
      return res.json({ code: 400, msg: '未找到该单词' });
    }

    const word = rows[0];
    const isCorrect = word.english_word.toLowerCase() === userAnswer.toLowerCase().trim();

    // 更新用户单词学习记录
    await pool.query(
      `INSERT INTO elia_user_word_record (user_id, word_id, study_count, correct_count, wrong_count, last_study_time, create_time)
       VALUES (?, ?, 1, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
         study_count = study_count + 1,
         correct_count = correct_count + ?,
         wrong_count = wrong_count + ?,
         last_study_time = NOW()`,
      [userId, wordId, isCorrect ? 1 : 0, isCorrect ? 1 : 0, isCorrect ? 0 : 1]
    );

    return res.json({
      code: 200,
      data: {
        isCorrect,
        correctAnswer: word.english_word,
        wordId: word.word_id,
        word: word.english_word
      }
    });
  } catch (error) {
    console.error('拼写检查错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/student-words/fill-blank
 * 填写缺失的字母（填空题）
 * @body {number} wordId - 单词ID
 * @body {string} userAnswer - 用户答案
 */
router.post('/fill-blank', authMiddleware, async (req, res) => {
  const { wordId, userAnswer } = req.body;
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      'SELECT word_id, english_word FROM elia_word_library WHERE word_id = ? AND status = "0"',
      [wordId]
    );

    if (rows.length === 0) {
      return res.json({ code: 400, msg: '未找到该单词' });
    }

    const word = rows[0];
    const isCorrect = word.english_word.toLowerCase() === userAnswer.toLowerCase().trim();

    // 更新用户单词学习记录
    await pool.query(
      `INSERT INTO elia_user_word_record (user_id, word_id, study_count, correct_count, wrong_count, last_study_time, create_time)
       VALUES (?, ?, 1, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
         study_count = study_count + 1,
         correct_count = correct_count + ?,
         wrong_count = wrong_count + ?,
         last_study_time = NOW()`,
      [userId, wordId, isCorrect ? 1 : 0, isCorrect ? 1 : 0, isCorrect ? 0 : 1]
    );

    return res.json({
      code: 200,
      data: {
        isCorrect,
        correctAnswer: word.english_word,
        wordId: word.word_id,
        word: word.english_word
      }
    });
  } catch (error) {
    console.error('填空检查错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/student-words/:wordId
 * 获取单词详情
 * @param {number} wordId - 单词ID
 */
router.get('/:wordId', authMiddleware, async (req, res) => {
  const { wordId } = req.params;
  const userId = getUserId(req);

  try {
    const [rows] = await pool.query(
      'SELECT * FROM elia_word_library WHERE word_id = ? AND status = "0"',
      [wordId]
    );

    if (rows.length === 0) {
      return res.json({ code: 400, msg: '未找到该单词' });
    }

    const w = rows[0];

    // 查询收藏状态
    const [collections] = await pool.query(
      'SELECT collection_id FROM elia_word_collection WHERE user_id = ? AND word_id = ?',
      [userId, w.word_id]
    );

    return res.json({
      code: 200,
      data: {
        wordId: w.word_id,
        word: w.english_word,
        ukPhonetic: w.phonetic_uk,
        usPhonetic: w.phonetic_us,
        ukSpeech: w.audio_uk_url,
        usSpeech: w.audio_us_url,
        chineseMeaning: w.chinese_meaning,
        wordType: w.word_type,
        difficultyLevel: w.difficulty_level,
        exampleSentence: w.example_sentence,
        exampleTranslation: w.example_translation,
        imageUrl: w.image_url,
        wordFamily: w.word_family,
        synonymWords: w.synonym_words,
        antonymWords: w.antonym_words,
        isCollected: collections.length > 0,
        collectionId: collections[0]?.collection_id || null
      }
    });
  } catch (error) {
    console.error('获取单词详情错误:', error);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
