/**
 * SỔ CHI TIÊU GIA ĐÌNH — Backend Google Apps Script
 * ------------------------------------------------
 * Cách dùng:
 *   1. Tạo Google Sheet mới.
 *   2. Extensions → Apps Script → dán toàn bộ file này vào Code.gs.
 *   3. Deploy → New deployment → Web app
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Copy URL kết thúc bằng /exec, dán vào assets/api.js trong web app.
 *
 * Lần chạy đầu tiên script tự tạo các tab và 2 tài khoản mặc định trong SEED_MEMBERS.
 * Mật khẩu được lưu dạng hash trong cột "password" (không lưu plaintext).
 * Đổi mật khẩu bằng liên kết "Quên mật khẩu" trên web app.
 * KHÔNG đổi cột "id" sau khi đã có dữ liệu (dữ liệu tham chiếu theo id).
 *
 * Sau khi cập nhật code, chạy hàm setupSchema() một lần trong editor
 * để thêm cột/tab mới vào Sheet hiện tại (không xoá dữ liệu cũ).
 */

var TABS = {
  members: ['id', 'login', 'name', 'role', 'password', 'order'],
  incomes: ['id', 'amount', 'date', 'member', 'note', 'createdBy', 'createdAt',
            'category', 'loanId'],
  expenses: ['id', 'title', 'amount', 'category', 'reason', 'requester', 'created',
             'status', 'agreed', 'approvedAt', 'purchasedAt', 'rejectedBy', 'rejectedAt',
             'cancelledBy', 'cancelledAt', 'cancelReason', 'rejectNote',
             'urgent', 'urgentAt', 'urgentBy', 'urgentAck', 'urgentAckAt', 'urgentAckNote',
             'loanId'],
  loans: ['id', 'type', 'person', 'amount', 'date', 'dueDate', 'note',
          'createdBy', 'createdAt', 'updatedAt', 'cashId'],
  loanPayments: ['id', 'loanId', 'amount', 'date', 'note',
                 'createdBy', 'createdAt', 'cashId'],
  loanInterests: ['id', 'loanId', 'amount', 'date', 'note', 'mode',
                  'createdBy', 'createdAt', 'cashId'],
  budgets: ['category', 'amount', 'updatedAt', 'updatedBy']
};

var EXPENSE_MANUAL_CATEGORIES = [
  'home', 'utilities', 'food', 'transport', 'shopping', 'pets',
  'health', 'education', 'gifts', 'entertainment', 'travel', 'other'
];
var EXPENSE_AUTO_CATEGORIES = ['lend', 'repay', 'loan_interest'];
var INCOME_MANUAL_CATEGORIES = [
  'salary', 'bonus', 'business', 'interest', 'gift', 'other_income', 'refund'
];
var INCOME_AUTO_CATEGORIES = ['collect', 'borrow', 'loan_interest'];
var CONSUMPTION_CATEGORIES = EXPENSE_MANUAL_CATEGORIES.slice();

var SEED_MEMBERS = [
  ['luat', 'ongluatlangvang@gmail.com', 'Luật', 'Chồng', 'luat123', 1],
  ['thuong', 'thuonglt1210@gmail.com', 'Thương', 'Vợ', 'thuong123', 2]
];

var TOKEN_DAYS = 30;
var RESET_MINUTES = 15;
var APP_URL = 'https://nguyenphuluat.github.io/Money/';

/* ============================ HTTP ============================ */

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  var res;
  try {
    res = handle(body);
  } catch (err) {
    res = {
      ok: false,
      error: String((err && err.message) || err),
      code: (err && err.code) || ''
    };
  }
  return json(res);
}

function doGet() {
  return json({ ok: true, service: 'so-chi-tieu', time: new Date().toISOString() });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ========================== DISPATCH ========================== */

var WRITE_ACTIONS = {
  addIncome: 1,
  updateIncome: 1,
  deleteIncome: 1,
  addExpense: 1,
  updateExpense: 1,
  approve: 1,
  reject: 1,
  cancel: 1,
  purchase: 1,
  urgentPurchase: 1,
  urgentAck: 1,
  deleteExpense: 1,
  addLoan: 1,
  updateLoan: 1,
  deleteLoan: 1,
  addLoanPayment: 1,
  deleteLoanPayment: 1,
  saveLoanInterest: 1,
  deleteLoanInterest: 1,
  saveBudgets: 1,
  saveMember: 1
};

function handle(body) {
  var action = String(body.action || '');

  if (action === 'version') {
    // Giữ thật nhẹ: chỉ đọc Script Properties, không đụng Sheet.
    return { ok: true, v: getVersion() };
  }

  if (action === 'login') {
    ensureSheets();
    return doLogin(body.login, body.password);
  }

  if (action === 'forgot') {
    ensureSheets();
    return doForgot(body.email);
  }

  if (action === 'resetPassword') {
    ensureSheets();
    return withLock(function () {
      var resetRes = doResetPassword(body.token, body.password);
      if (!resetRes) resetRes = { ok: true };
      resetRes.v = bumpVersion();
      return resetRes;
    });
  }

  ensureSchema();

  var me = requireAuth(body.token);

  if (WRITE_ACTIONS[action] === 1) {
    return withLock(function () {
      var res = dispatch(action, me, body);
      if (!res) res = { ok: true };
      res.v = bumpVersion();
      return res;
    });
  }

  return dispatch(action, me, body);
}

function dispatch(action, me, body) {
  switch (action) {
    case 'list': return doList(me);
    case 'addIncome': return doAddIncome(me, body);
    case 'updateIncome': return doUpdateIncome(me, body);
    case 'deleteIncome': return doDeleteIncome(me, body);
    case 'addExpense': return doAddExpense(me, body);
    case 'updateExpense': return doUpdateExpense(me, body);
    case 'approve': return doApprove(me, body);
    case 'reject': return doReject(me, body);
    case 'cancel': return doCancel(me, body);
    case 'purchase': return doPurchase(me, body);
    case 'urgentPurchase': return doUrgentPurchase(me, body);
    case 'urgentAck': return doUrgentAck(me, body);
    case 'deleteExpense': return doDeleteExpense(me, body);
    case 'addLoan': return doAddLoan(me, body);
    case 'updateLoan': return doUpdateLoan(me, body);
    case 'deleteLoan': return doDeleteLoan(me, body);
    case 'addLoanPayment': return doAddLoanPayment(me, body);
    case 'deleteLoanPayment': return doDeleteLoanPayment(me, body);
    case 'saveLoanInterest': return doSaveLoanInterest(me, body);
    case 'deleteLoanInterest': return doDeleteLoanInterest(me, body);
    case 'saveBudgets': return doSaveBudgets(me, body);
    case 'saveMember': return doSaveMember(me, body);
    default: return { ok: false, error: 'Hành động không hợp lệ: ' + action };
  }
}

/* =========================== AUTH ============================ */

function doLogin(loginValue, password) {
  var login = String(loginValue || '').trim().toLowerCase();
  var pass = String(password || '');
  if (!login || !pass) throw new Error('Nhập tên đăng nhập và mật khẩu.');

  var cache = CacheService.getScriptCache();
  var failKey = 'fail:' + login;
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= 6) throw new Error('Sai quá nhiều lần. Thử lại sau 10 phút.');

  var row = null;
  var rows = readRows(sheet('members'));
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].login || '').trim().toLowerCase() === login) { row = rows[i]; break; }
  }

  if (!row || !verifyPassword(row.password, pass)) {
    cache.put(failKey, String(fails + 1), 600);
    throw new Error('Sai tên đăng nhập hoặc mật khẩu.');
  }

  cache.remove(failKey);
  var member = publicMember(row);
  return {
    ok: true,
    token: signToken({ id: member.id, ver: passVersion(row.password), exp: Date.now() + TOKEN_DAYS * 86400000 }),
    member: member
  };
}

function doForgot(emailValue) {
  var login = String(emailValue || '').trim().toLowerCase();
  if (!login) return { ok: false, error: 'Nhập email tài khoản.' };

  var rows = memberRows();
  var row = null;
  for (var i = 0; i < rows.length; i++) {
    if (str(rows[i].login).trim().toLowerCase() === login) { row = rows[i]; break; }
  }
  if (!row) return { ok: false, error: 'Không tìm thấy tài khoản dùng email này.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(str(row.login))) {
    return { ok: false, error: 'Tài khoản này không dùng email để đăng nhập.' };
  }

  var cache = CacheService.getScriptCache();
  var key = 'forgot:' + login;
  if (cache.get(key)) return { ok: false, error: 'Vừa gửi email rồi. Thử lại sau 5 phút.' };

  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('reset:' + token, JSON.stringify({
    id: str(row.id),
    ver: passVersion(row.password)
  }), RESET_MINUTES * 60);

  var resetUrl = APP_URL + 'reset-password.html?token=' + encodeURIComponent(token);
  MailApp.sendEmail({
    to: row.login,
    name: 'Sổ Chi Tiêu Gia Đình',
    subject: 'Đặt lại mật khẩu sổ chi tiêu gia đình',
    body: 'Xin chào ' + str(row.name) + ',\n\nMở liên kết sau để đặt lại mật khẩu (chỉ dùng một lần, hết hạn sau ' + RESET_MINUTES + ' phút):\n' + resetUrl + '\n\nNếu không phải bạn yêu cầu, hãy bỏ qua email này.',
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0F172A">' +
      '<p>Xin chào <b>' + escapeHtml(row.name) + '</b>,</p>' +
      '<p>Bạn vừa yêu cầu đặt lại mật khẩu sổ chi tiêu gia đình. Bấm nút bên dưới để tạo mật khẩu mới:</p>' +
      '<p><a href="' + resetUrl + '" style="display:inline-block;background:#0F766E;color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Đặt lại mật khẩu</a></p>' +
      '<p style="color:#64748B">Liên kết chỉ dùng một lần và hết hạn sau ' + RESET_MINUTES + ' phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại không thay đổi.</p>' +
      '<p style="color:#64748B">Mở sổ tại <a href="' + APP_URL + '">' + APP_URL + '</a>.</p>' +
      '</div>'
  });

  cache.put(key, '1', 300);
  return { ok: true, member: publicMember(row) };
}

function doResetPassword(tokenValue, passwordValue) {
  var token = String(tokenValue || '').trim();
  var pass = String(passwordValue || '');
  if (!token) throw new Error('Liên kết đặt lại mật khẩu không hợp lệ.');
  if (pass.length < 8) throw new Error('Mật khẩu mới cần ít nhất 8 ký tự.');
  if (pass.length > 128) throw new Error('Mật khẩu mới quá dài.');

  var cache = CacheService.getScriptCache();
  var key = 'reset:' + token;
  var raw = cache.get(key);
  if (!raw) throw new Error('Liên kết đã hết hạn hoặc đã được sử dụng.');

  var payload = null;
  try { payload = JSON.parse(raw); } catch (err) { payload = null; }
  if (!payload || !payload.id) {
    cache.remove(key);
    throw new Error('Liên kết đặt lại mật khẩu không hợp lệ.');
  }

  var row = memberById(payload.id);
  if (!row) {
    cache.remove(key);
    throw new Error('Tài khoản không còn tồn tại.');
  }
  if (payload.ver !== passVersion(row.password)) {
    cache.remove(key);
    throw new Error('Liên kết đã hết hạn hoặc đã được sử dụng.');
  }

  updateById('members', row.id, { password: createPasswordHash(pass) });
  cache.remove(key);
  return { ok: true };
}

function authorizeMail() {
  return MailApp.getRemainingDailyQuota();
}

function requireAuth(token) {
  var payload = verifyToken(token);
  if (!payload) {
    var err = new Error('Phiên đăng nhập đã hết hạn. Đăng nhập lại.');
    err.code = 'auth';
    throw err;
  }
  var row = memberById(payload.id);
  if (!row) {
    var err2 = new Error('Tài khoản không còn tồn tại.');
    err2.code = 'auth';
    throw err2;
  }
  if (!payload.ver || payload.ver !== passVersion(row.password)) {
    var err3 = new Error('Mật khẩu đã thay đổi. Đăng nhập lại.');
    err3.code = 'auth';
    throw err3;
  }
  return publicMember(row);
}

function getSecret() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('TOKEN_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('TOKEN_SECRET', secret);
  }
  return secret;
}

function passVersion(password) {
  var sig = Utilities.computeHmacSha256Signature(String(password || ''), getSecret());
  return Utilities.base64EncodeWebSafe(sig).slice(0, 22);
}

function hashPassword(password, salt) {
  var sig = Utilities.computeHmacSha256Signature(
    String(salt) + ':' + String(password || ''),
    getSecret()
  );
  return Utilities.base64EncodeWebSafe(sig);
}

function isHashedPassword(value) {
  var parts = String(value || '').split('$');
  return parts.length === 3 && parts[0] === 'v1' &&
    parts[1].length >= 16 && parts[2].length >= 20;
}

function createPasswordHash(password) {
  var salt = Utilities.getUuid().replace(/-/g, '');
  return 'v1$' + salt + '$' + hashPassword(password, salt);
}

function safeEqual(a, b) {
  var left = String(a || '');
  var right = String(b || '');
  if (left.length !== right.length) return false;
  var diff = 0;
  for (var i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function verifyPassword(stored, password) {
  var value = String(stored || '');
  if (isHashedPassword(value)) {
    var parts = value.split('$');
    return safeEqual(hashPassword(password, parts[1]), parts[2]);
  }
  // Dữ liệu cũ còn plaintext: cho đăng nhập một lần rồi migrateMemberPasswords() thay bằng hash.
  return safeEqual(value, String(password || ''));
}

function migrateMemberPasswords() {
  var rows = readRows(sheet('members'));
  rows.forEach(function (row) {
    if (!str(row.id)) return;
    var value = String(row.password || '');
    if (!value || isHashedPassword(value)) return;
    updateById('members', row.id, { password: createPasswordHash(value) });
  });
}

function getVersion() {
  return PropertiesService.getScriptProperties().getProperty('DATA_VERSION') || '1';
}

function bumpVersion() {
  var props = PropertiesService.getScriptProperties();
  var next = Number(props.getProperty('DATA_VERSION') || '1') + 1;
  props.setProperty('DATA_VERSION', String(next));
  return next;
}

function signToken(payload) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var sig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(body, getSecret())
  );
  return body + '.' + sig;
}

function verifyToken(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  var expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], getSecret())
  );
  if (expected !== parts[1]) return null;
  try {
    var payload = JSON.parse(
      Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()
    );
    if (!payload || !payload.id || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

/* ============================ DATA ============================ */

function ensureSchema() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('Script phải được tạo từ Google Sheet (Extensions → Apps Script).');

    Object.keys(TABS).forEach(function (name) {
      var headers = TABS[name];
      var sh = ss.getSheetByName(name);
      if (!sh) {
        sh = ss.insertSheet(name);
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);
        sh.setFrozenRows(1);
        return;
      }
      var current = headersOf(sh);
      if (!current.length || sh.getLastRow() === 0) {
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);
        sh.setFrozenRows(1);
        return;
      }
      var missing = headers.filter(function (h) { return current.indexOf(h) === -1; });
      if (missing.length) {
        sh.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
      }
    });

    migrateMemberPasswords();
  } finally {
    lock.releaseLock();
  }
}

function ensureSheets() {
  ensureSchema();
  var members = sheet('members');
  if (members.getLastRow() <= 1) {
    SEED_MEMBERS.forEach(function (r) { members.appendRow(r); });
    migrateMemberPasswords();
  }
}

// Chạy hàm này một lần trong editor sau khi cập nhật code.
function setupSchema() {
  ensureSchema();
  return 'Đã thêm cột/tab mới, dữ liệu cũ giữ nguyên.';
}

function sheet(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Thiếu tab ' + name);
  return sh;
}

function headersOf(sh) {
  var last = sh.getLastColumn();
  if (!last) return [];
  return sh.getRange(1, 1, 1, last).getValues()[0].map(String);
}

function readRows(sh) {
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(String);
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row.some(function (v) { return v !== '' && v !== null; })) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = row[c];
    }
    out.push(obj);
  }
  return out;
}

function appendObject(name, obj) {
  var sh = sheet(name);
  var headers = headersOf(sh);
  var row = headers.map(function (h) {
    return obj[h] === undefined || obj[h] === null ? '' : obj[h];
  });
  sh.appendRow(row);
}

function findRowByName(name, id) {
  var sh = sheet(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return -1;
  var idCol = values[0].map(String).indexOf('id');
  if (idCol < 0) return -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) return i + 1; // 1-based
  }
  return -1;
}

function updateById(name, id, patch) {
  var sh = sheet(name);
  var rowIndex = findRowByName(name, id);
  if (rowIndex < 0) throw new Error('Không tìm thấy dữ liệu cần sửa.');
  var headers = headersOf(sh);
  var range = sh.getRange(rowIndex, 1, 1, headers.length);
  var values = range.getValues()[0];
  Object.keys(patch).forEach(function (key) {
    var col = headers.indexOf(key);
    if (col >= 0) values[col] = patch[key];
  });
  range.setValues([values]);
}

function deleteById(name, id) {
  var sh = sheet(name);
  var rowIndex = findRowByName(name, id);
  if (rowIndex < 0) throw new Error('Không tìm thấy dữ liệu cần xoá.');
  sh.deleteRow(rowIndex);
}

function deleteIfExists(name, id) {
  if (!id) return;
  var sh = sheet(name);
  var rowIndex = findRowByName(name, id);
  if (rowIndex > 0) sh.deleteRow(rowIndex);
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ========================== HELPERS =========================== */

function nowIso() { return new Date().toISOString(); }

function isoValue(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function dayValue(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v).slice(0, 10);
}

function validDay(v) {
  var s = String(v || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function num(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function str(v) { return v === null || v === undefined ? '' : String(v); }

function isOn(v) {
  var s = str(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function formatVnd(n) {
  return String(Math.round(num(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseAgreed(v) {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(String(v || '{}')); } catch (err) { return {}; }
}

function publicMember(row) {
  return {
    id: str(row.id),
    name: str(row.name) || 'Thành viên',
    role: str(row.role),
    email: str(row.login)
  };
}

function memberRows() {
  return readRows(sheet('members')).filter(function (r) { return str(r.id); });
}

function memberById(id) {
  var rows = memberRows();
  for (var i = 0; i < rows.length; i++) {
    if (str(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

function memberIds() {
  return memberRows()
    .sort(function (a, b) { return num(a.order) - num(b.order); })
    .map(function (r) { return str(r.id); });
}

function cleanAmount(v) {
  var n = num(v);
  if (!(n > 0)) throw new Error('Số tiền phải lớn hơn 0.');
  return Math.round(n);
}

function safeId(value) {
  var s = str(value);
  if (/^[A-Za-z0-9_-]{8,80}$/.test(s)) return s;
  return Utilities.getUuid();
}

function safeText(value) {
  var s = str(value);
  return /^[=+\-@]/.test(s) ? '\u200B' + s : s;
}

function manualExpenseCategory(value) {
  var id = str(value) || 'other';
  if (EXPENSE_MANUAL_CATEGORIES.indexOf(id) === -1) {
    throw new Error('Nhóm chi không hợp lệ.');
  }
  return id;
}

function manualIncomeCategory(value) {
  var id = str(value) || 'other_income';
  if (INCOME_MANUAL_CATEGORIES.indexOf(id) === -1) {
    throw new Error('Nhóm thu không hợp lệ.');
  }
  return id;
}

function isAutoExpenseCategory(id) {
  return EXPENSE_AUTO_CATEGORIES.indexOf(str(id)) !== -1;
}

function isAutoIncomeCategory(id) {
  return INCOME_AUTO_CATEGORIES.indexOf(str(id)) !== -1;
}

function allAgreed() {
  var agreed = {};
  memberIds().forEach(function (id) { agreed[id] = true; });
  return JSON.stringify(agreed);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================ LIST ============================ */

function doList(me) {
  var interestRows = readRows(sheet('loanInterests'));
  var interestsByLoan = {};
  interestRows.forEach(function (r) {
    var entry = mapLoanInterest(r);
    if (!interestsByLoan[entry.loanId]) interestsByLoan[entry.loanId] = [];
    interestsByLoan[entry.loanId].push(entry);
  });

  return {
    ok: true,
    v: getVersion(),
    me: me,
    members: memberRows()
      .sort(function (a, b) { return num(a.order) - num(b.order); })
      .map(publicMember),
    incomes: readRows(sheet('incomes')).map(function (r) {
      return {
        id: str(r.id),
        amount: num(r.amount),
        date: dayValue(r.date),
        member: str(r.member),
        note: str(r.note),
        category: str(r.category) || 'other_income',
        loanId: str(r.loanId),
        createdBy: str(r.createdBy),
        createdAt: isoValue(r.createdAt)
      };
    }),
    expenses: readRows(sheet('expenses')).map(function (r) {
      return {
        id: str(r.id),
        title: str(r.title),
        amount: num(r.amount),
        category: str(r.category) || 'other',
        reason: str(r.reason),
        requester: str(r.requester),
        created: isoValue(r.created),
        status: str(r.status) || 'pending',
        agreed: parseAgreed(r.agreed),
        approvedAt: isoValue(r.approvedAt),
        purchasedAt: isoValue(r.purchasedAt),
        rejectedBy: str(r.rejectedBy),
        rejectedAt: isoValue(r.rejectedAt),
        rejectNote: str(r.rejectNote),
        cancelledBy: str(r.cancelledBy),
        cancelledAt: isoValue(r.cancelledAt),
        cancelReason: str(r.cancelReason),
        urgent: isOn(r.urgent),
        urgentAt: isoValue(r.urgentAt),
        urgentBy: str(r.urgentBy),
        urgentAck: str(r.urgentAck),
        urgentAckAt: isoValue(r.urgentAckAt),
        urgentAckNote: str(r.urgentAckNote),
        loanId: str(r.loanId)
      };
    }),
    loans: readRows(sheet('loans')).map(function (r) {
      var loan = mapLoan(r);
      loan.interests = interestsByLoan[loan.id] || [];
      return loan;
    }),
    loanPayments: readRows(sheet('loanPayments')).map(mapLoanPayment),
    loanInterests: interestRows.map(mapLoanInterest),
    budgets: readRows(sheet('budgets')).map(function (r) {
      return {
        category: str(r.category),
        amount: num(r.amount),
        updatedAt: isoValue(r.updatedAt),
        updatedBy: str(r.updatedBy)
      };
    })
  };
}

/* ========================== INCOMES =========================== */

function doAddIncome(me, body) {
  var member = str(body.member) || me.id;
  if (memberIds().indexOf(member) === -1) throw new Error('Người kiếm không hợp lệ.');

  var id = safeId(body.id);
  if (findIncome(id)) return { ok: true, duplicate: true };

  appendObject('incomes', {
    id: id,
    amount: cleanAmount(body.amount),
    date: dayValue(body.date) || dayValue(new Date()),
    member: member,
    note: safeText(body.note).slice(0, 120),
    createdBy: me.id,
    createdAt: nowIso(),
    category: manualIncomeCategory(body.category),
    loanId: ''
  });
  return { ok: true };
}

function doUpdateIncome(me, body) {
  var row = findIncome(body.id);
  if (!row) throw new Error('Khoản thu không còn tồn tại.');
  if (str(row.loanId)) throw new Error('Khoản này thuộc sổ vay, sửa trong tab Vay nợ.');
  if (isAutoIncomeCategory(row.category)) throw new Error('Khoản này thuộc sổ vay, sửa trong tab Vay nợ.');

  var member = str(body.member) || str(row.member);
  if (memberIds().indexOf(member) === -1) throw new Error('Người kiếm không hợp lệ.');

  updateById('incomes', body.id, {
    amount: cleanAmount(body.amount),
    date: dayValue(body.date) || dayValue(new Date()),
    member: member,
    note: safeText(body.note).slice(0, 120),
    category: manualIncomeCategory(body.category)
  });
  return { ok: true };
}

function doDeleteIncome(me, body) {
  var row = findIncome(body.id);
  if (!row) throw new Error('Khoản thu không còn tồn tại.');
  if (str(row.loanId)) throw new Error('Khoản này thuộc sổ vay, xoá trong tab Vay nợ.');
  deleteById('incomes', body.id);
  return { ok: true };
}

function findIncome(id) {
  var rows = readRows(sheet('incomes'));
  for (var i = 0; i < rows.length; i++) {
    if (str(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

/* ========================== EXPENSES ========================== */

function findExpense(id) {
  var rows = readRows(sheet('expenses'));
  for (var i = 0; i < rows.length; i++) {
    if (str(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

function doAddExpense(me, body) {
  var title = safeText(str(body.title).trim());
  var reason = safeText(str(body.reason).trim());
  if (!title) throw new Error('Nhập tên món cần mua.');
  if (!reason) throw new Error('Nhập lý do mua.');

  var id = safeId(body.id);
  if (findExpense(id)) return { ok: true, duplicate: true };

  var agreed = {};
  memberIds().forEach(function (id) { agreed[id] = id === me.id ? true : null; });

  appendObject('expenses', {
    id: id,
    title: title.slice(0, 80),
    amount: cleanAmount(body.amount),
    category: manualExpenseCategory(body.category),
    reason: reason.slice(0, 300),
    requester: me.id,
    created: nowIso(),
    status: 'pending',
    agreed: JSON.stringify(agreed)
  });
  return { ok: true };
}

function doUpdateExpense(me, body) {
  var row = findExpense(body.id);
  if (!row) throw new Error('Yêu cầu không còn tồn tại.');
  if (str(row.loanId)) throw new Error('Khoản này thuộc sổ vay, sửa trong tab Vay nợ.');
  if (isAutoExpenseCategory(row.category)) throw new Error('Khoản này thuộc sổ vay, sửa trong tab Vay nợ.');
  if (str(row.requester) !== me.id) throw new Error('Chỉ người gửi mới sửa được yêu cầu.');

  var status = str(row.status);
  if (['pending', 'approved', 'purchased'].indexOf(status) === -1) {
    throw new Error('Yêu cầu này không sửa được nữa.');
  }

  var patch = {
    title: safeText(str(body.title).trim()).slice(0, 80),
    amount: cleanAmount(body.amount),
    category: manualExpenseCategory(body.category),
    reason: safeText(str(body.reason).trim()).slice(0, 300)
  };
  if (!patch.title) throw new Error('Nhập tên món cần mua.');
  if (!patch.reason) throw new Error('Nhập lý do mua.');

  if (status === 'approved') {
    var agreed = {};
    memberIds().forEach(function (id) { agreed[id] = id === me.id ? true : null; });
    patch.status = 'pending';
    patch.agreed = JSON.stringify(agreed);
    patch.approvedAt = '';
  }

  if (isOn(row.urgent) && str(row.urgentAck)) {
    patch.urgentAck = '';
    patch.urgentAckAt = '';
    patch.urgentAckNote = '';
  }

  updateById('expenses', body.id, patch);
  return { ok: true };
}

function doApprove(me, body) {
  var row = findExpense(body.id);
  if (!row) throw new Error('Yêu cầu không còn tồn tại.');
  if (str(row.status) !== 'pending') throw new Error('Yêu cầu đã được xử lý.');

  var agreed = parseAgreed(row.agreed);
  agreed[me.id] = true;

  var ids = memberIds();
  var all = ids.length >= 2 && ids.every(function (id) { return agreed[id] === true; });

  var patch = { agreed: JSON.stringify(agreed) };
  if (all) {
    patch.status = 'approved';
    patch.approvedAt = nowIso();
  }
  updateById('expenses', body.id, patch);
  return { ok: true, approved: all, approvedAt: patch.approvedAt || '' };
}

function doReject(me, body) {
  var row = findExpense(body.id);
  if (!row) throw new Error('Yêu cầu không còn tồn tại.');
  if (str(row.status) !== 'pending') throw new Error('Yêu cầu đã được xử lý.');

  var agreed = parseAgreed(row.agreed);
  agreed[me.id] = false;

  var note = safeText(str(body.reason).trim()).slice(0, 200);
  var rejectedAt = nowIso();
  updateById('expenses', body.id, {
    status: 'rejected',
    agreed: JSON.stringify(agreed),
    rejectedBy: me.id,
    rejectedAt: rejectedAt,
    rejectNote: note
  });
  return { ok: true, rejectedAt: rejectedAt, rejectNote: note };
}

function doCancel(me, body) {
  var row = findExpense(body.id);
  if (!row) throw new Error('Yêu cầu không còn tồn tại.');

  var status = str(row.status);
  if (status === 'pending') {
    if (str(row.requester) !== me.id) throw new Error('Chỉ người gửi mới huỷ được yêu cầu đang chờ.');
  } else if (status === 'approved') {
    // Sau khi cả hai duyệt, ai cũng huỷ được nếu không cần nữa.
  } else {
    throw new Error('Yêu cầu này không huỷ được nữa.');
  }

  var reason = safeText(str(body.reason).trim()).slice(0, 200);
  if (status === 'approved' && !reason) throw new Error('Nhập lý do huỷ.');

  var cancelledAt = nowIso();
  updateById('expenses', body.id, {
    status: 'cancelled',
    cancelledBy: me.id,
    cancelledAt: cancelledAt,
    cancelReason: reason
  });
  return { ok: true, cancelledAt: cancelledAt, cancelReason: reason };
}

function doPurchase(me, body) {
  var row = findExpense(body.id);
  if (!row) throw new Error('Yêu cầu không còn tồn tại.');
  if (str(row.status) !== 'approved') throw new Error('Chỉ ghi nhận đã mua khi yêu cầu đã được duyệt.');

  var purchasedAt = nowIso();
  updateById('expenses', body.id, {
    status: 'purchased',
    purchasedAt: purchasedAt
  });
  return { ok: true, purchasedAt: purchasedAt };
}

function doUrgentPurchase(me, body) {
  var row = findExpense(body.id);
  if (!row) throw new Error('Yêu cầu không còn tồn tại.');

  var status = str(row.status);
  if (status === 'purchased' && isOn(row.urgent)) {
    return {
      ok: true,
      duplicate: true,
      purchasedAt: isoValue(row.purchasedAt),
      urgentAt: isoValue(row.urgentAt)
    };
  }
  if (status !== 'pending') throw new Error('Chỉ chi gấp được yêu cầu đang chờ duyệt.');

  var agreed = parseAgreed(row.agreed);
  agreed[me.id] = true;

  var urgentAt = nowIso();
  updateById('expenses', body.id, {
    status: 'purchased',
    purchasedAt: urgentAt,
    urgent: '1',
    urgentAt: urgentAt,
    urgentBy: me.id,
    urgentAck: '',
    urgentAckAt: '',
    urgentAckNote: '',
    agreed: JSON.stringify(agreed)
  });
  return { ok: true, purchasedAt: urgentAt, urgentAt: urgentAt };
}

function doUrgentAck(me, body) {
  var row = findExpense(body.id);
  if (!row) throw new Error('Yêu cầu không còn tồn tại.');
  if (!isOn(row.urgent) || str(row.status) !== 'purchased') {
    throw new Error('Khoản này không phải khoản chi gấp.');
  }
  if (str(row.urgentBy) === me.id) throw new Error('Người chi gấp không tự xác nhận.');

  var ok = body.ok === true || body.ok === 'true' || body.ok === 1 || body.ok === '1';
  var note = safeText(str(body.note).trim()).slice(0, 200);
  if (!ok && !note) throw new Error('Nhập lý do phản đối.');

  var ackAt = nowIso();
  var agreed = parseAgreed(row.agreed);
  agreed[me.id] = ok;

  updateById('expenses', body.id, {
    urgentAck: ok ? 'ok' : 'no',
    urgentAckAt: ackAt,
    urgentAckNote: note,
    agreed: JSON.stringify(agreed)
  });
  return {
    ok: true,
    urgentAck: ok ? 'ok' : 'no',
    urgentAckAt: ackAt,
    urgentAckNote: note
  };
}

function doDeleteExpense(me, body) {
  var row = findExpense(body.id);
  if (!row) throw new Error('Yêu cầu không còn tồn tại.');
  if (str(row.loanId)) throw new Error('Khoản này thuộc sổ vay, xoá trong tab Vay nợ.');
  deleteById('expenses', body.id);
  return { ok: true };
}

/* =========================== LOANS ============================ */

function mapLoan(r) {
  return {
    id: str(r.id),
    type: str(r.type) || 'lend',
    person: str(r.person),
    amount: num(r.amount),
    date: dayValue(r.date),
    dueDate: dayValue(r.dueDate),
    note: str(r.note),
    createdBy: str(r.createdBy),
    createdAt: isoValue(r.createdAt),
    updatedAt: isoValue(r.updatedAt),
    cashId: str(r.cashId)
  };
}

function mapLoanPayment(r) {
  return {
    id: str(r.id),
    loanId: str(r.loanId),
    amount: num(r.amount),
    date: dayValue(r.date),
    note: str(r.note),
    createdBy: str(r.createdBy),
    createdAt: isoValue(r.createdAt),
    cashId: str(r.cashId)
  };
}

function mapLoanInterest(r) {
  return {
    id: str(r.id),
    loanId: str(r.loanId),
    amount: num(r.amount),
    date: dayValue(r.date),
    note: str(r.note),
    mode: str(r.mode) === 'capitalize' ? 'capitalize' : 'pay',
    createdBy: str(r.createdBy),
    createdAt: isoValue(r.createdAt),
    cashId: str(r.cashId)
  };
}

function findLoan(id) {
  var rows = readRows(sheet('loans'));
  for (var i = 0; i < rows.length; i++) {
    if (str(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

function findLoanPayment(id) {
  var rows = readRows(sheet('loanPayments'));
  for (var i = 0; i < rows.length; i++) {
    if (str(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

function loanPayments(loanId) {
  return readRows(sheet('loanPayments')).filter(function (r) {
    return str(r.loanId) === String(loanId);
  });
}

function loanPaid(loanId) {
  return loanPayments(loanId).reduce(function (s, p) { return s + num(p.amount); }, 0);
}

function findLoanInterest(id) {
  var rows = readRows(sheet('loanInterests'));
  for (var i = 0; i < rows.length; i++) {
    if (str(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

function loanInterests(loanId) {
  return readRows(sheet('loanInterests')).filter(function (r) {
    return str(r.loanId) === String(loanId);
  });
}

function loanInterestTotal(loanId, mode) {
  return loanInterests(loanId)
    .filter(function (r) { return str(r.mode) === mode; })
    .reduce(function (s, r) { return s + num(r.amount); }, 0);
}

function loanPrincipal(loanId) {
  var row = findLoan(loanId);
  if (!row) return 0;
  return num(row.amount) + loanInterestTotal(loanId, 'capitalize');
}

function loanType(value) {
  var type = str(value);
  if (type !== 'lend' && type !== 'borrow') throw new Error('Loại khoản vay không hợp lệ.');
  return type;
}

function loanPerson(value) {
  var person = safeText(str(value).trim()).slice(0, 60);
  if (!person) throw new Error('Nhập tên người vay / cho vay.');
  return person;
}

function loanNote(value) {
  return safeText(str(value).trim()).slice(0, 200);
}

function loanDay(value, label) {
  var day = dayValue(value);
  if (!validDay(day)) throw new Error('Ngày ' + label + ' không hợp lệ.');
  return day;
}

function buildLoanCash(loan, me) {
  var cashId = Utilities.getUuid();
  var now = nowIso();
  if (loan.type === 'lend') {
    appendObject('expenses', {
      id: cashId,
      title: 'Cho ' + loan.person + ' vay',
      amount: loan.amount,
      category: 'lend',
      reason: loan.note || 'Khoản cho vay',
      requester: me.id,
      created: now,
      status: 'purchased',
      agreed: allAgreed(),
      purchasedAt: loan.date,
      loanId: loan.id
    });
  } else {
    appendObject('incomes', {
      id: cashId,
      amount: loan.amount,
      date: loan.date,
      member: me.id,
      note: 'Vay ' + loan.person + (loan.note ? ' · ' + loan.note : ''),
      createdBy: me.id,
      createdAt: now,
      category: 'borrow',
      loanId: loan.id
    });
  }
  return cashId;
}

function doAddLoan(me, body) {
  var id = safeId(body.id);
  if (findLoan(id)) return { ok: true, duplicate: true };

  var loan = {
    id: id,
    type: loanType(body.type),
    person: loanPerson(body.person),
    amount: cleanAmount(body.amount),
    date: loanDay(body.date || new Date(), 'vay'),
    dueDate: body.dueDate ? loanDay(body.dueDate, 'hạn trả') : '',
    note: loanNote(body.note),
    createdBy: me.id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    cashId: ''
  };

  var cashId = buildLoanCash(loan, me);
  loan.cashId = cashId;
  try {
    appendObject('loans', loan);
  } catch (err) {
    try { deleteIfExists(loan.type === 'lend' ? 'expenses' : 'incomes', cashId); } catch (e) { /* ignore */ }
    throw err;
  }
  return { ok: true, loan: mapLoanWithInterests(id) };
}

function doUpdateLoan(me, body) {
  var row = findLoan(body.id);
  if (!row) throw new Error('Khoản vay không còn tồn tại.');

  var type = str(row.type) || 'lend';
  var person = loanPerson(body.person === undefined ? row.person : body.person);
  var dueDate = body.dueDate ? loanDay(body.dueDate, 'hạn trả') : '';
  var note = loanNote(body.note === undefined ? row.note : body.note);
  var amount = num(row.amount);
  var date = dayValue(row.date);

  if (!validDay(date)) date = dayValue(new Date());

  var payments = loanPayments(row.id);
  var newAmount = body.amount === undefined ? amount : cleanAmount(body.amount);
  var newDate = body.date === undefined ? date : loanDay(body.date, 'vay');

  if ((newAmount !== amount || newDate !== date) && payments.length) {
    throw new Error('Đã có lần trả/thu, không sửa được số tiền hoặc ngày vay. Xoá khoản vay rồi tạo lại.');
  }

  var cashId = str(row.cashId);
  var cash = cashId
    ? (type === 'lend' ? findExpense(cashId) : findIncome(cashId))
    : null;
  if (cashId && !cash) throw new Error('Không tìm thấy khoản tiền liên kết.');

  if (cashId) {
    if (type === 'lend') {
      updateById('expenses', cashId, {
        title: 'Cho ' + person + ' vay',
        reason: note || 'Khoản cho vay',
        amount: newAmount,
        purchasedAt: newDate
      });
    } else {
      updateById('incomes', cashId, {
        amount: newAmount,
        date: newDate,
        note: 'Vay ' + person + (note ? ' · ' + note : '')
      });
    }
  }

  updateById('loans', row.id, {
    person: person,
    amount: newAmount,
    date: newDate,
    dueDate: dueDate,
    note: note,
    updatedAt: nowIso()
  });
  return { ok: true, loan: mapLoanWithInterests(row.id) };
}

function doDeleteLoan(me, body) {
  var row = findLoan(body.id);
  if (!row) throw new Error('Khoản vay không còn tồn tại.');

  var type = str(row.type) || 'lend';
  var payments = loanPayments(row.id);
  payments.forEach(function (p) {
    deleteIfExists(type === 'lend' ? 'incomes' : 'expenses', str(p.cashId));
    deleteIfExists('loanPayments', str(p.id));
  });
  loanInterests(row.id).forEach(function (entry) {
    deleteIfExists(type === 'lend' ? 'incomes' : 'expenses', str(entry.cashId));
    deleteIfExists('loanInterests', str(entry.id));
  });
  deleteIfExists(type === 'lend' ? 'expenses' : 'incomes', str(row.cashId));
  deleteIfExists('loans', row.id);
  return { ok: true };
}

function doAddLoanPayment(me, body) {
  var id = safeId(body.id);
  if (findLoanPayment(id)) return { ok: true, duplicate: true };

  var row = findLoan(body.loanId);
  if (!row) throw new Error('Khoản vay không còn tồn tại.');

  var type = str(row.type) || 'lend';
  var person = str(row.person);
  var principal = num(row.amount) + loanInterestTotal(row.id, 'capitalize');
  var paid = loanPaid(row.id);
  var remaining = principal - paid;
  if (remaining <= 0) throw new Error('Khoản vay này đã tất toán.');

  var amount = cleanAmount(body.amount);
  if (amount > remaining) {
    throw new Error('Số tiền vượt quá số còn lại (' + formatVnd(remaining) + ' ₫).');
  }

  var date = loanDay(body.date || new Date(), 'trả');
  var note = loanNote(body.note);
  var cashId = Utilities.getUuid();
  var now = nowIso();

  if (type === 'lend') {
    appendObject('incomes', {
      id: cashId,
      amount: amount,
      date: date,
      member: me.id,
      note: 'Thu nợ ' + person + (note ? ' · ' + note : ''),
      createdBy: me.id,
      createdAt: now,
      category: 'collect',
      loanId: row.id
    });
  } else {
    appendObject('expenses', {
      id: cashId,
      title: 'Trả nợ ' + person,
      amount: amount,
      category: 'repay',
      reason: note || 'Trả nợ',
      requester: me.id,
      created: now,
      status: 'purchased',
      agreed: allAgreed(),
      purchasedAt: date,
      loanId: row.id
    });
  }

  var payment = {
    id: id,
    loanId: row.id,
    amount: amount,
    date: date,
    note: note,
    createdBy: me.id,
    createdAt: now,
    cashId: cashId
  };
  try {
    appendObject('loanPayments', payment);
  } catch (err) {
    try { deleteIfExists(type === 'lend' ? 'incomes' : 'expenses', cashId); } catch (e) { /* ignore */ }
    throw err;
  }

  return {
    ok: true,
    payment: mapLoanPayment(findLoanPayment(id)),
    remaining: remaining - amount
  };
}

function doDeleteLoanPayment(me, body) {
  var payment = findLoanPayment(body.id);
  if (!payment) throw new Error('Lần trả không còn tồn tại.');

  var row = findLoan(payment.loanId);
  if (!row) throw new Error('Khoản vay không còn tồn tại.');

  var type = str(row.type) || 'lend';
  deleteIfExists(type === 'lend' ? 'incomes' : 'expenses', str(payment.cashId));
  deleteIfExists('loanPayments', str(payment.id));

  var remaining = loanPrincipal(row.id) - loanPaid(row.id);
  return { ok: true, remaining: Math.max(0, remaining) };
}

function mapLoanWithInterests(id) {
  var row = findLoan(id);
  if (!row) return null;
  var loan = mapLoan(row);
  loan.interests = loanInterests(id).map(mapLoanInterest);
  return loan;
}

function syncLoanInterestCash(loan, entry, me) {
  var cashId = str(entry.cashId);
  if (entry.mode === 'capitalize') {
    if (cashId) {
      deleteIfExists(loan.type === 'lend' ? 'incomes' : 'expenses', cashId);
    }
    return '';
  }

  var owner = str(loan.createdBy) || me.id;
  var now = str(entry.createdAt) || nowIso();
  var newCashId = cashId || Utilities.getUuid();

  if (loan.type === 'lend') {
    var note = 'Lãi cho vay ' + str(loan.person) + (entry.note ? ' · ' + entry.note : '');
    if (cashId && findIncome(cashId)) {
      updateById('incomes', cashId, {
        amount: entry.amount,
        date: entry.date,
        member: owner,
        note: note,
        category: 'loan_interest',
        loanId: loan.id
      });
    } else {
      appendObject('incomes', {
        id: newCashId,
        amount: entry.amount,
        date: entry.date,
        member: owner,
        note: note,
        createdBy: me.id,
        createdAt: now,
        category: 'loan_interest',
        loanId: loan.id
      });
    }
    return newCashId;
  }

  var reason = entry.note || 'Lãi đi vay';
  if (cashId && findExpense(cashId)) {
    updateById('expenses', cashId, {
      title: 'Lãi đi vay ' + str(loan.person),
      amount: entry.amount,
      category: 'loan_interest',
      reason: reason,
      requester: owner,
      purchasedAt: entry.date,
      loanId: loan.id
    });
  } else {
    appendObject('expenses', {
      id: newCashId,
      title: 'Lãi đi vay ' + str(loan.person),
      amount: entry.amount,
      category: 'loan_interest',
      reason: reason,
      requester: owner,
      created: now,
      status: 'purchased',
      agreed: allAgreed(),
      approvedAt: entry.date,
      purchasedAt: entry.date,
      loanId: loan.id
    });
  }
  return newCashId;
}

function doSaveLoanInterest(me, body) {
  var loan = findLoan(body.loanId);
  if (!loan) throw new Error('Khoản vay không còn tồn tại.');

  var existing = body.id ? findLoanInterest(safeId(body.id)) : null;
  if (existing && str(existing.loanId) !== str(loan.id)) {
    throw new Error('Lần lãi không thuộc khoản vay này.');
  }

  var record = {
    id: existing ? str(existing.id) : Utilities.getUuid(),
    loanId: str(loan.id),
    amount: cleanAmount(body.amount),
    date: loanDay(body.date || new Date(), 'lãi'),
    note: loanNote(body.note),
    mode: body.mode === undefined && existing
      ? (str(existing.mode) === 'capitalize' ? 'capitalize' : 'pay')
      : (str(body.mode) === 'capitalize' ? 'capitalize' : 'pay'),
    createdBy: existing ? str(existing.createdBy) : me.id,
    createdAt: existing ? str(existing.createdAt) : nowIso(),
    cashId: existing ? str(existing.cashId) : ''
  };

  var cashId = syncLoanInterestCash(loan, record, me);
  record.cashId = cashId;

  try {
    if (existing) {
      updateById('loanInterests', record.id, record);
    } else {
      appendObject('loanInterests', record);
    }
  } catch (err) {
    if (!existing && cashId) {
      try { deleteIfExists(loan.type === 'lend' ? 'incomes' : 'expenses', cashId); } catch (e) { /* ignore */ }
    }
    throw err;
  }

  return {
    ok: true,
    interest: mapLoanInterest(findLoanInterest(record.id)),
    loan: mapLoanWithInterests(loan.id)
  };
}

function doDeleteLoanInterest(me, body) {
  var entry = findLoanInterest(body.id);
  if (!entry) throw new Error('Lần lãi không còn tồn tại.');

  var loan = findLoan(entry.loanId);
  if (!loan) throw new Error('Khoản vay không còn tồn tại.');
  if (body.loanId && str(body.loanId) !== str(loan.id)) {
    throw new Error('Lần lãi không thuộc khoản vay này.');
  }

  var type = str(loan.type) || 'lend';
  deleteIfExists(type === 'lend' ? 'incomes' : 'expenses', str(entry.cashId));
  deleteIfExists('loanInterests', str(entry.id));

  var remaining = loanPrincipal(loan.id) - loanPaid(loan.id);
  return { ok: true, remaining: Math.max(0, remaining) };
}

/* =========================== BUDGETS ========================== */

function doSaveBudgets(me, body) {
  var list = body.budgets;
  if (!Array.isArray(list)) throw new Error('Dữ liệu ngân sách không hợp lệ.');

  var now = nowIso();
  var budgetMap = {};
  list.forEach(function (item) {
    if (!item) return;
    var category = str(item.category);
    if (CONSUMPTION_CATEGORIES.indexOf(category) === -1) return;
    var amount = Math.round(num(item.amount));
    if (!(amount > 0)) return;
    budgetMap[category] = amount;
  });

  var sh = sheet('budgets');
  var headers = TABS.budgets.slice();
  var rows = [headers];
  Object.keys(budgetMap).forEach(function (category) {
    rows.push([category, budgetMap[category], now, me.id]);
  });

  sh.clearContents();
  sh.getRange(1, 1, rows.length, headers.length).setValues(rows);

  return {
    ok: true,
    budgets: Object.keys(budgetMap).map(function (category) {
      return { category: category, amount: budgetMap[category], updatedAt: now, updatedBy: me.id };
    })
  };
}

/* ========================== MEMBERS =========================== */

function doSaveMember(me, body) {
  var name = str(body.name).trim();
  if (!name) throw new Error('Nhập tên hiển thị.');
  updateById('members', me.id, {
    name: safeText(name).slice(0, 40),
    role: safeText(str(body.role).trim()).slice(0, 20)
  });
  return { ok: true, member: publicMember(memberById(me.id)) };
}
