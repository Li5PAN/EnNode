const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// ==================== 模拟单词数据库 ====================
const MOCK_WORDS_DATA = {
  hello: {
    wordId: 1,
    englishWord: 'hello',
    phoneticUk: 'həˈləʊ',
    phoneticUs: 'həˈloʊ',
    chineseMeaning: 'int. 喂；你好 n. 表示问候',
    exampleSentence: 'Hello, how are you?',
    exampleTranslation: '你好，你好吗？',
    isCollected: false
  },
  apple: {
    wordId: 2,
    englishWord: 'apple',
    phoneticUk: 'ˈæpl',
    phoneticUs: 'ˈæpl',
    chineseMeaning: 'n. 苹果；苹果树；苹果公司',
    exampleSentence: 'An apple a day keeps the doctor away.',
    exampleTranslation: '一天一苹果，医生远离我。',
    isCollected: true
  },
  world: {
    wordId: 3,
    englishWord: 'world',
    phoneticUk: 'wɜːld',
    phoneticUs: 'wɜːrld',
    chineseMeaning: 'n. 世界；领域；世俗',
    exampleSentence: 'The world is beautiful.',
    exampleTranslation: '世界是美丽的。',
    isCollected: false
  },
  study: {
    wordId: 4,
    englishWord: 'study',
    phoneticUk: 'ˈstʌdi',
    phoneticUs: 'ˈstʌdi',
    chineseMeaning: 'n. 学习，研究 vt. 学习；考虑',
    exampleSentence: 'I study English every day.',
    exampleTranslation: '我每天学习英语。',
    isCollected: false
  },
  learn: {
    wordId: 5,
    englishWord: 'learn',
    phoneticUk: 'lɜːn',
    phoneticUs: 'lɜːrn',
    chineseMeaning: 'vt. 学习；得知 vi. 学习；获悉',
    exampleSentence: 'We learn something new every day.',
    exampleTranslation: '我们每天都学到新东西。',
    isCollected: true
  },
  practice: {
    wordId: 6,
    englishWord: 'practice',
    phoneticUk: 'ˈpræktɪs',
    phoneticUs: 'ˈpræktɪs',
    chineseMeaning: 'n. 实践；练习 vt. 练习；实习',
    exampleSentence: 'Practice makes perfect.',
    exampleTranslation: '熟能生巧。',
    isCollected: false
  },
  improve: {
    wordId: 7,
    englishWord: 'improve',
    phoneticUk: 'ɪmˈpruːv',
    phoneticUs: 'ɪmˈpruːv',
    chineseMeaning: 'vt. 改善，增进 vi. 改善，变得更好',
    exampleSentence: 'I want to improve my English.',
    exampleTranslation: '我想提高我的英语水平。',
    isCollected: false
  },
  knowledge: {
    wordId: 8,
    englishWord: 'knowledge',
    phoneticUk: 'ˈnɒlɪdʒ',
    phoneticUs: 'ˈnɑːlɪdʒ',
    chineseMeaning: 'n. 知识，学问；知道',
    exampleSentence: 'Knowledge is power.',
    exampleTranslation: '知识就是力量。',
    isCollected: false
  },
  education: {
    wordId: 9,
    englishWord: 'education',
    phoneticUk: 'ˌedʒuˈkeɪʃn',
    phoneticUs: 'ˌedʒuˈkeɪʃn',
    chineseMeaning: 'n. 教育；培养',
    exampleSentence: 'Education is very important.',
    exampleTranslation: '教育非常重要。',
    isCollected: false
  },
  teacher: {
    wordId: 10,
    englishWord: 'teacher',
    phoneticUk: 'ˈtiːtʃə(r)',
    phoneticUs: 'ˈtiːtʃər',
    chineseMeaning: 'n. 教师；导师',
    exampleSentence: 'My teacher is very kind.',
    exampleTranslation: '我的老师很和蔼。',
    isCollected: true
  },
  student: {
    wordId: 11,
    englishWord: 'student',
    phoneticUk: 'ˈstjuːdnt',
    phoneticUs: 'ˈstuːdnt',
    chineseMeaning: 'n. 学生；学者',
    exampleSentence: 'I am a student.',
    exampleTranslation: '我是一名学生。',
    isCollected: false
  }
};

// ==================== 收藏数据 ====================
let mockCollections = [
  { collectionId: 1, wordId: 2, englishWord: 'apple', phoneticUk: 'ˈæpl', phoneticUs: 'ˈæpl', chineseMeaning: 'n. 苹果；苹果树；苹果公司', exampleSentence: 'An apple a day keeps the doctor away.', exampleTranslation: '一天一苹果，医生远离我。' },
  { collectionId: 2, wordId: 5, englishWord: 'learn', phoneticUk: 'lɜːn', phoneticUs: 'lɜːrn', chineseMeaning: 'vt. 学习；得知 vi. 学习；获悉', exampleSentence: 'We learn something new every day.', exampleTranslation: '我们每天都学到新东西。' },
  { collectionId: 3, wordId: 10, englishWord: 'teacher', phoneticUk: 'ˈtiːtʃə(r)', phoneticUs: 'ˈtiːtʃər', chineseMeaning: 'n. 教师；导师', exampleSentence: 'My teacher is very kind.', exampleTranslation: '我的老师很和蔼。' }
];

// ==================== 中文到英文映射 ====================
const CHINESE_TO_ENGLISH = {
  '苹果': 'apple',
  '你好': 'hello',
  '世界': 'world',
  '学习': 'study',
  '学会': 'learn',
  '练习': 'practice',
  '提高': 'improve',
  '知识': 'knowledge',
  '教育': 'education',
  '老师': 'teacher',
  '学生': 'student'
};

// 检测是否包含中文
const isChinese = (text) => /[\u4e00-\u9fa5]/.test(text);

// 模拟延迟
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * GET /api/student-words
 * 获取学生单词列表（分页）
 * Query: englishWord, chineseMeaning, pageNum, pageSize
 */
router.get('/', authMiddleware, async (req, res) => {
  await delay(300);
  const { englishWord, chineseMeaning, pageNum = 1, pageSize = 10 } = req.query;

  let words = Object.values(MOCK_WORDS_DATA);

  // 英文单词模糊搜索
  if (englishWord) {
    words = words.filter(w => w.englishWord.toLowerCase().includes(englishWord.toLowerCase()));
  }

  // 中文释义模糊搜索
  if (chineseMeaning) {
    words = words.filter(w => w.chineseMeaning.includes(chineseMeaning));
  }

  const total = words.length;
  const start = (parseInt(pageNum) - 1) * parseInt(pageSize);
  const end = start + parseInt(pageSize);
  const rows = words.slice(start, end);

  return res.json({ code: 200, total, rows });
});

/**
 * GET /api/student-words/all
 * 获取所有单词（无分页）
 */
router.get('/all', authMiddleware, async (req, res) => {
  await delay(300);
  const words = Object.values(MOCK_WORDS_DATA);
  return res.json({ code: 200, data: words });
});

/**
 * GET /api/student-words/search
 * 搜索单词（支持中英文）
 * Query: keyword
 */
router.get('/search', authMiddleware, async (req, res) => {
  await delay(300);
  const { keyword } = req.query;

  if (!keyword) {
    return res.json({ code: 200, data: null });
  }

  let searchKey = keyword;

  // 中文转英文
  if (isChinese(keyword)) {
    const englishWord = CHINESE_TO_ENGLISH[keyword];
    if (englishWord) {
      searchKey = englishWord;
    } else {
      return res.json({ code: 200, data: null, message: `未找到"${keyword}"对应的英文单词` });
    }
  }

  const wordData = MOCK_WORDS_DATA[searchKey.toLowerCase()];

  if (!wordData) {
    return res.json({ code: 200, data: null });
  }

  // 构建完整返回格式
  const result = {
    word: wordData.englishWord,
    wordId: wordData.wordId,
    ukPhonetic: wordData.phoneticUk || '',
    usPhonetic: wordData.phoneticUs || '',
    ukSpeech: wordData.phoneticUk ? `https://dict.youdao.com/dictvoice?audio=${wordData.englishWord}&type=1` : '',
    usSpeech: wordData.phoneticUs ? `https://dict.youdao.com/dictvoice?audio=${wordData.englishWord}&type=2` : '',
    meanings: wordData.chineseMeaning ? [wordData.chineseMeaning] : [],
    wordForms: [],
    examples: wordData.exampleSentence ? [{
      sentence: wordData.exampleSentence,
      translation: wordData.exampleTranslation || '',
      sentenceSpeech: ''
    }] : [],
    webMeanings: [],
    isCollected: wordData.isCollected
  };

  return res.json({ code: 200, data: result });
});

/**
 * GET /api/student-words/collections
 * 获取收藏的单词列表
 * Query: englishWord, pageNum, pageSize
 */
router.get('/collections', authMiddleware, async (req, res) => {
  await delay(300);
  const { englishWord, pageNum = 1, pageSize = 100 } = req.query;

  let collections = [...mockCollections];

  // 英文单词模糊搜索
  if (englishWord) {
    collections = collections.filter(c => c.englishWord.toLowerCase().includes(englishWord.toLowerCase()));
  }

  const total = collections.length;
  const start = (parseInt(pageNum) - 1) * parseInt(pageSize);
  const end = start + parseInt(pageSize);
  const rows = collections.slice(start, end);

  return res.json({ code: 200, total, rows });
});

/**
 * POST /api/student-words/collect
 * 收藏/取消收藏单词
 * Body: { wordId, collect }
 */
router.post('/collect', authMiddleware, async (req, res) => {
  await delay(300);
  const { wordId, collect } = req.body;

  const word = Object.values(MOCK_WORDS_DATA).find(w => w.wordId === wordId);

  if (!word) {
    return res.status(404).json({ code: 404, message: '单词不存在' });
  }

  if (collect) {
    // 收藏
    word.isCollected = true;
    // 如果收藏列表中没有，则添加
    if (!mockCollections.find(c => c.wordId === wordId)) {
      mockCollections.push({
        collectionId: mockCollections.length + 1,
        wordId: word.wordId,
        englishWord: word.englishWord,
        phoneticUk: word.phoneticUk,
        phoneticUs: word.phoneticUs,
        chineseMeaning: word.chineseMeaning,
        exampleSentence: word.exampleSentence,
        exampleTranslation: word.exampleTranslation
      });
    }
  } else {
    // 取消收藏
    word.isCollected = false;
    mockCollections = mockCollections.filter(c => c.wordId !== wordId);
  }

  return res.json({ code: 200, message: collect ? '收藏成功' : '取消收藏成功' });
});

/**
 * DELETE /api/student-words/collections
 * 批量删除收藏
 * Query: collectionIds (逗号分隔)
 */
router.delete('/collections', authMiddleware, async (req, res) => {
  await delay(300);
  const { collectionIds } = req.query;

  if (!collectionIds) {
    return res.status(400).json({ code: 400, message: '缺少收藏ID' });
  }

  const ids = collectionIds.split(',').map(id => parseInt(id));

  // 更新收藏列表
  mockCollections = mockCollections.filter(c => !ids.includes(c.collectionId));

  // 更新单词收藏状态
  const removedCollections = ids.map(id => mockCollections.find(c => c.collectionId === id)).filter(Boolean);
  removedCollections.forEach(c => {
    const word = Object.values(MOCK_WORDS_DATA).find(w => w.wordId === c.wordId);
    if (word) word.isCollected = false;
  });

  return res.json({ code: 200, message: '删除成功' });
});

/**
 * POST /api/student-words/match
 * 单词答案匹配验证
 * Body: { wordId, userAnswer, matchType }
 * matchType: 1=单词默写 2=单词拼写 3=英译中 4=中译英 5=填空题
 */
router.post('/match', authMiddleware, async (req, res) => {
  await delay(200);
  const { wordId, userAnswer, matchType } = req.body;

  const word = Object.values(MOCK_WORDS_DATA).find(w => w.wordId === wordId);

  if (!word) {
    return res.status(404).json({ code: 404, message: '单词不存在' });
  }

  let correct = false;
  let correctAnswer = '';

  switch (parseInt(matchType)) {
    case 1: // 单词默写
    case 2: // 单词拼写
      correct = userAnswer.toLowerCase().trim() === word.englishWord.toLowerCase();
      correctAnswer = word.englishWord;
      break;
    case 3: // 英译中
      correct = userAnswer.trim().includes(word.chineseMeaning.split(' ')[0]);
      correctAnswer = word.chineseMeaning;
      break;
    case 4: // 中译英
      correct = userAnswer.toLowerCase().trim() === word.englishWord.toLowerCase();
      correctAnswer = word.englishWord;
      break;
    case 5: // 填空题
      correct = userAnswer.toLowerCase().trim() === word.englishWord.toLowerCase();
      correctAnswer = word.englishWord;
      break;
    default:
      return res.status(400).json({ code: 400, message: '无效的匹配类型' });
  }

  return res.json({
    code: 200,
    data: {
      correct,
      correctAnswer: correctAnswer
    }
  });
});

/**
 * GET /api/student-words/task/:taskId
 * 获取任务的单词列表
 */
router.get('/task/:taskId', authMiddleware, async (req, res) => {
  await delay(300);
  const { taskId } = req.params;

  // 返回部分单词作为任务单词
  const taskWords = [MOCK_WORDS_DATA.hello, MOCK_WORDS_DATA.study, MOCK_WORDS_DATA.learn];

  return res.json({ code: 200, data: taskWords });
});

module.exports = router;