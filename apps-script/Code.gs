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
 * Lần chạy đầu tiên script tự tạo 3 tab (members / incomes / expenses)
 * và 2 tài khoản mặc định:
 *      minh@giadinh.vn / minh123
 *      lan@giadinh.vn  / lan123
 * Đổi mật khẩu bằng cách sửa cột "password" trong tab members.
 * KHÔNG đổi cột "id" sau khi đã có dữ liệu (dữ liệu tham chiếu theo id).
 */

var TABS = {
  members: ['id', 'login', 'name', 'role', 'password', 'order'],
  incomes: ['id', 'amount', 'date', 'member', 'note', 'createdBy', 'createdAt'],
  expenses: ['id', 'title', 'amount', 'category', 'reason', 'requester', 'created',
             'status', 'agreed', 'approvedAt', 'purchasedAt', 'rejectedBy', 'rejectedAt',
             'cancelledBy', 'cancelledAt']
};

var SEED_MEMBERS = [
  ['luat', 'ongluatlangvang@gmail.com', 'Luật', 'Chồng', 'luat123', 1],
  ['thuong', 'thuonglt1210@gmail.com', 'Thương', 'Vợ', 'thuong123', 2]
];

var TOKEN_DAYS = 30;

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

function handle(body) {
  var action = String(body.action || '');

  if (action === 'login') {
    ensureSheets();
    return doLogin(body.login, body.password);
  }

  if (action === 'forgot') {
    ensureSheets();
    return doForgot(body.email);
  }

  var me = requireAuth(body.token);

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
    case 'deleteExpense': return doDeleteExpense(me, body);
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

  if (!row || String(row.password) !== pass) {
    cache.put(failKey, String(fails + 1), 600);
    throw new Error('Sai tên đăng nhập hoặc mật khẩu.');
  }

  cache.remove(failKey);
  var member = publicMember(row);
  return {
    ok: true,
    token: signToken({ id: member.id, exp: Date.now() + TOKEN_DAYS * 86400000 }),
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

  MailApp.sendEmail({
    to: row.login,
    name: 'Sổ Chi Tiêu Gia Đình',
    subject: 'Mật khẩu sổ chi tiêu gia đình',
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0F172A">' +
      '<p>Xin chào <b>' + escapeHtml(row.name) + '</b>,</p>' +
      '<p>Mật khẩu đăng nhập sổ chi tiêu của bạn là:</p>' +
      '<p style="font-size:22px;font-weight:700;letter-spacing:1px;background:#F0FDFA;padding:12px 16px;border-radius:10px;display:inline-block">' + escapeHtml(row.password) + '</p>' +
      '<p>Mở sổ tại <a href="https://nguyenphuluat.github.io/Money/">https://nguyenphuluat.github.io/Money/</a>.</p>' +
      '<p style="color:#64748B">Nếu không phải bạn yêu cầu, hãy bỏ qua email này và đổi mật khẩu trong tab <b>members</b>.</p>' +
      '</div>'
  });

  cache.put(key, '1', 300);
  return { ok: true, member: publicMember(row) };
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

function ensureSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Script phải được tạo từ Google Sheet (Extensions → Apps Script).');

  Object.keys(TABS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(TABS[name]);
      sh.setFrozenRows(1);
    }
  });

  var members = ss.getSheetByName('members');
  if (members.getLastRow() <= 1) {
    SEED_MEMBERS.forEach(function (r) { members.appendRow(r); });
  }
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

function num(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function str(v) { return v === null || v === undefined ? '' : String(v); }

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

function requireMember(me) {
  if (!me || !me.id) throw new Error('Chưa đăng nhập.');
  return me.id;
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

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================ LIST ============================ */

function doList(me) {
  return {
    ok: true,
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
        cancelledBy: str(r.cancelledBy),
        cancelledAt: isoValue(r.cancelledAt)
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
    note: str(body.note).slice(0, 120),
    createdBy: me.id,
    createdAt: nowIso()
  });
  return { ok: true };
}

function doUpdateIncome(me, body) {
  var row = findIncome(body.id);
  if (!row) throw new Error('Khoản thu không còn tồn tại.');
  var member = str(body.member) || str(row.member);
  if (memberIds().indexOf(member) === -1) throw new Error('Người kiếm không hợp lệ.');

  updateById('incomes', body.id, {
    amount: cleanAmount(body.amount),
    date: dayValue(body.date) || dayValue(new Date()),
    member: member,
    note: str(body.note).slice(0, 120)
  });
  return { ok: true };
}

function doDeleteIncome(me, body) {
  if (!findIncome(body.id)) throw new Error('Khoản thu không còn tồn tại.');
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
  var title = str(body.title).trim();
  var reason = str(body.reason).trim();
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
    category: str(body.category) || 'other',
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
  if (str(row.requester) !== me.id) throw new Error('Chỉ người gửi mới sửa được yêu cầu.');

  var status = str(row.status);
  if (['pending', 'approved', 'purchased'].indexOf(status) === -1) {
    throw new Error('Yêu cầu này không sửa được nữa.');
  }

  var patch = {
    title: str(body.title).trim().slice(0, 80),
    amount: cleanAmount(body.amount),
    category: str(body.category) || 'other',
    reason: str(body.reason).trim().slice(0, 300)
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

  updateById('expenses', body.id, patch);
  return { ok: true };
}

function doApprove(me, body) {
  return withLock(function () {
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
  });
}

function doReject(me, body) {
  var row = findExpense(body.id);
  if (!row) throw new Error('Yêu cầu không còn tồn tại.');
  if (str(row.status) !== 'pending') throw new Error('Yêu cầu đã được xử lý.');

  var agreed = parseAgreed(row.agreed);
  agreed[me.id] = false;

  var rejectedAt = nowIso();
  updateById('expenses', body.id, {
    status: 'rejected',
    agreed: JSON.stringify(agreed),
    rejectedBy: me.id,
    rejectedAt: rejectedAt
  });
  return { ok: true, rejectedAt: rejectedAt };
}

function doCancel(me, body) {
  var row = findExpense(body.id);
  if (!row) throw new Error('Yêu cầu không còn tồn tại.');
  if (str(row.requester) !== me.id) throw new Error('Chỉ người gửi mới huỷ được yêu cầu.');
  if (['pending', 'approved'].indexOf(str(row.status)) === -1) {
    throw new Error('Yêu cầu này không huỷ được nữa.');
  }

  updateById('expenses', body.id, {
    status: 'cancelled',
    cancelledBy: me.id,
    cancelledAt: nowIso()
  });
  return { ok: true };
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

function doDeleteExpense(me, body) {
  if (!findExpense(body.id)) throw new Error('Yêu cầu không còn tồn tại.');
  deleteById('expenses', body.id);
  return { ok: true };
}

/* ========================== MEMBERS =========================== */

function doSaveMember(me, body) {
  var name = str(body.name).trim();
  if (!name) throw new Error('Tên không được để trống.');
  updateById('members', me.id, {
    name: name.slice(0, 40),
    role: str(body.role).trim().slice(0, 20)
  });
  return { ok: true, member: publicMember(memberById(me.id)) };
}
