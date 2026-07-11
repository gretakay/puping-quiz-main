// ╔══════════════════════════════════════════════╗
// ║  普平精舍題庫 — Google Apps Script           ║
// ║  貼到：試算表 → 延伸功能 → Apps Script       ║
// ╚══════════════════════════════════════════════╝

const SHEET_NAME = '題庫';
const QUESTIONS_PER_SESSION = 15;
const CACHE_TTL = 600; // 快取時效 10 分鐘（秒）

// ── 允許跨來源請求（讓網頁可以存取） ──
function doOptions() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ── GET 請求入口 ──
function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'getQuestions') {
      return getQuestions(e.parameter.class, e.parameter.course, e.parameter.type);
    }
    if (action === 'getCourses') {
      return getCourses(e.parameter.class);
    }
    if (action === 'getAll') {
      return getAllQuestions(e.parameter.class);
    }
    return json({ error: '未知的 action' });
  } catch (err) {
    return json({ error: err.message });
  }
}

// ── POST 請求入口 ──
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    if (action === 'addQuestion')    return addQuestion(data.question);
    if (action === 'updateQuestion') return updateQuestion(data.id, data.question);
    if (action === 'deleteQuestion') return deleteQuestion(data.id);
    if (action === 'toggleEnable')   return toggleEnable(data.id);
    if (action === 'batchImport')    return batchImport(data.questions);
    return json({ error: '未知的 action' });
  } catch (err) {
    return json({ error: err.message });
  }
}

// ════════════════════════════════════════
//  內部工具函式
// ════════════════════════════════════════

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function getAllData() {
  return getSheet().getDataRange().getValues();
}

// 一列資料 → 題目物件
// 欄位順序：ID(0) 班級(1) 課程(2) 題型(3) 題目(4)
//           選項A(5) 解釋A(6) 選項B(7) 解釋B(8)
//           選項C(9) 解釋C(10) 選項D(11) 解釋D(12)
//           答案(13) 啟用(14) 建立日期(15)
function rowToQ(row) {
  return {
    id:        row[0],
    class:     row[1],
    course:    row[2],
    type:      row[3],   // 'choice' 或 'fill'
    text:      row[4],
    optA:      row[5],  expA: row[6],
    optB:      row[7],  expB: row[8],
    optC:      row[9],  expC: row[10],
    optD:      row[11], expD: row[12],
    answer:    row[13], // 'A' / 'B' / 'C' / 'D'
    enabled:   row[14], // TRUE / FALSE
    createdAt: row[15]
  };
}

function nextId(data) {
  const ids = data.slice(1).map(r => Number(r[0])).filter(n => !isNaN(n) && n > 0);
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

function today() {
  return new Date().toLocaleDateString('zh-TW');
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 快取工具 ──
// 快取 key 格式：qs_班級_課程、courses_班級
function cacheGet(key) {
  try {
    const val = CacheService.getScriptCache().get(key);
    return val ? JSON.parse(val) : null;
  } catch(e) { return null; }
}

function cachePut(key, data) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(data), CACHE_TTL);
  } catch(e) { /* 資料太大時靜默略過 */ }
}

// 清除指定班級 + 課程的快取（寫入操作後呼叫）
function clearCache(className, course) {
  try {
    const cache = CacheService.getScriptCache();
    if (className && course) {
      cache.remove('qs_' + className + '_' + course);
    }
    if (className) {
      cache.remove('courses_' + className);
      cache.remove('qs_' + className + '_');
      cache.remove('all_' + className);   // 後台全量快取
    }
    cache.remove('all_ALL'); // 不篩班級的全量快取
  } catch(e) {}
}

// ════════════════════════════════════════
//  功能函式
// ════════════════════════════════════════

// 前台：取指定班級的課程清單（去重）
function getCourses(className) {
  const cacheKey = 'courses_' + className;
  const cached = cacheGet(cacheKey);
  if (cached) return json({ success: true, courses: cached });

  const data = getAllData();
  const seen = {};
  const courses = [];
  data.slice(1).forEach(r => {
    if (r[0] !== '' && r[1] === className && r[2] !== '' && !seen[r[2]]) {
      seen[r[2]] = true;
      courses.push(r[2]);
    }
  });

  cachePut(cacheKey, courses);
  return json({ success: true, courses: courses });
}

// 前台：取指定班級 + 課程 + 題型的隨機 15 題
// type 參數：'choice' / 'fill' / 'all'（或空值 = all）
function getQuestions(className, course, type) {
  // 快取以班級+課程為單位（不含題型，型別過濾在取出後做）
  const cacheKey = 'qs_' + className + '_' + (course || '');
  let pool = cacheGet(cacheKey);

  if (!pool) {
    const data = getAllData();
    pool = data.slice(1).filter(r => {
      if (r[0] === '') return false;
      if (r[1] !== className) return false;
      if (course && r[2] !== course) return false;
      if (r[14] !== true) return false;
      return true;
    }).map(rowToQ);
    cachePut(cacheKey, pool);
  }

  let qs = pool;
  if (type && type !== 'all') {
    qs = pool.filter(q => q.type === type);
  }

  const result = qs.sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_SESSION);
  return json({ success: true, questions: result });
}

// 後台：取所有題目（可依班級篩選）
function getAllQuestions(className) {
  const cacheKey = 'all_' + (className || 'ALL');
  const cached = cacheGet(cacheKey);
  if (cached) return json({ success: true, questions: cached });

  const data = getAllData();
  let qs = data.slice(1)
    .filter(r => r[0] !== '')
    .map(rowToQ);
  if (className) qs = qs.filter(q => q.class === className);
  cachePut(cacheKey, qs);
  return json({ success: true, questions: qs });
}

// 後台：新增一題
function addQuestion(q) {
  const data = getAllData();
  const id = nextId(data);
  getSheet().appendRow([
    id, q.class, q.course, q.type, q.text,
    q.optA, q.expA, q.optB, q.expB,
    q.optC, q.expC, q.optD, q.expD,
    q.answer, true, today()
  ]);
  clearCache(q.class, q.course);
  return json({ success: true, id });
}

// 後台：更新題目
function updateQuestion(id, q) {
  const sheet = getSheet();
  const data = getAllData();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, 16).setValues([[
        id, q.class, q.course, q.type, q.text,
        q.optA, q.expA, q.optB, q.expB,
        q.optC, q.expC, q.optD, q.expD,
        q.answer, data[i][14], data[i][15]
      ]]);
      clearCache(q.class, q.course);
      return json({ success: true });
    }
  }
  return json({ error: '找不到 ID: ' + id });
}

// 後台：刪除題目
function deleteQuestion(id) {
  const sheet = getSheet();
  const data = getAllData();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      clearCache(data[i][1], data[i][2]); // 刪除前先記錄班級課程
      sheet.deleteRow(i + 1);
      return json({ success: true });
    }
  }
  return json({ error: '找不到 ID: ' + id });
}

// 後台：批次匯入
function batchImport(questions) {
  const sheet = getSheet();
  const data = getAllData();
  let id = nextId(data);
  const todayStr = today();
  const rows = questions.map(q => [
    id++, q.class, q.course, q.type, q.text,
    q.optA, q.expA, q.optB, q.expB,
    q.optC, q.expC, q.optD, q.expD,
    q.answer, true, todayStr
  ]);
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 16).setValues(rows);
    // 清除所有被匯入的班級+課程快取
    const affected = {};
    questions.forEach(q => { affected[q.class + '_' + q.course] = [q.class, q.course]; });
    Object.values(affected).forEach(([cls, crs]) => clearCache(cls, crs));
  }
  return json({ success: true, count: rows.length });
}

// 後台：切換啟用 / 停用
function toggleEnable(id) {
  const sheet = getSheet();
  const data = getAllData();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      const newVal = !data[i][14];
      sheet.getRange(i + 1, 15).setValue(newVal);
      clearCache(data[i][1], data[i][2]);
      return json({ success: true, enabled: newVal });
    }
  }
  return json({ error: '找不到 ID: ' + id });
}
