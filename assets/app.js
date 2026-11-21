/* Sổ Chi Tiêu Gia Đình — giao diện OpenDesign, dữ liệu Google Sheet qua Apps Script */
import * as api from './api.js';

(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var STATUS = {
    pending: { label: 'Chờ duyệt', cls: 'pending', icon: 'clock' },
    approved: { label: 'Đã duyệt', cls: 'approved', icon: 'check' },
    purchased: { label: 'Đã chi tiêu', cls: 'purchased', icon: 'cart' },
    rejected: { label: 'Từ chối', cls: 'rejected', icon: 'x' },
    cancelled: { label: 'Đã huỷ', cls: 'cancelled', icon: 'slash' }
  };

  var CATEGORIES = [
    { id: 'home', label: 'Nhà ở', color: 'var(--chart-1)' },
    { id: 'utilities', label: 'Hóa đơn & tiện ích', color: 'var(--chart-9)' },
    { id: 'food', label: 'Ăn uống', color: 'var(--chart-2)' },
    { id: 'transport', label: 'Đi lại', color: 'var(--chart-3)' },
    { id: 'shopping', label: 'Mua sắm', color: 'var(--chart-8)' },
    { id: 'pets', label: 'Thú cưng', color: 'var(--chart-7)' },
    { id: 'health', label: 'Sức khỏe', color: 'var(--chart-5)' },
    { id: 'education', label: 'Giáo dục', color: 'var(--chart-4)' },
    { id: 'gifts', label: 'Quà tặng & hiếu hỉ', color: 'var(--chart-10)' },
    { id: 'entertainment', label: 'Giải trí', color: 'var(--chart-11)' },
    { id: 'travel', label: 'Du lịch', color: 'var(--chart-12)' },
    { id: 'other', label: 'Khác', color: 'var(--chart-6)' }
  ];

  function categoryMeta(id) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i];
    }
    return CATEGORIES[CATEGORIES.length - 1];
  }

  var ICONS = {
    overview: '<path d="M3 10.4 12 3l9 7.4"/><path d="M5.5 9.6V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.6"/>',
    income: '<path d="M3 17.5 9.4 11l3.4 3.4L21 6"/><path d="M15 6h6v6"/>',
    expenses: '<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z"/><path d="M9.5 8.5h5M9.5 12.5h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.6 4.4 4.4L19 7.5"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 1.9"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    slash: '<circle cx="12" cy="12" r="8.4"/><path d="m6.8 6.8 10.4 10.4"/>',
    cart: '<circle cx="9.2" cy="19.8" r="1.3"/><circle cx="18" cy="19.8" r="1.3"/><path d="M3 4.2h2.3l2.4 11h10.1l2.2-8H6.1"/>',
    trash: '<path d="M4 7h16"/><path d="M9.2 7V4.4h5.6V7"/><path d="M6.4 7l.8 13h9.6l.8-13"/><path d="M10 11v5M14 11v5"/>',
    pencil: '<path d="M4 20h4L19.2 8.8a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.6 6.4 4 4"/>',
    more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    alert: '<path d="M12 4 3.2 20h17.6L12 4Z"/><path d="M12 10.2v4"/><path d="M12 17.3v.1"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5.2 20c.8-3.5 3.5-5.4 6.8-5.4s6 1.9 6.8 5.4"/>',
    logout: '<path d="M14 5H6.5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1H14"/><path d="M17 8.4 20.6 12 17 15.6"/><path d="M10.2 12h10.2"/>',
    calendar: '<rect x="3.6" y="5" width="16.8" height="15.4" rx="2.6"/><path d="M8.2 3v4M15.8 3v4M3.6 10h16.8"/>',
    info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5"/><path d="M12 8.1v.1"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9"/><path d="M14.5 9.4c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 2 0 1.2 1.1 1.7 2.6 2.1 1.6.4 2.8.9 2.8 2.2 0 1.3-1.2 2.1-2.9 2.1-1.2 0-2.2-.5-2.8-1.4"/>',
    filter: '<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',
    arrowRight: '<path d="M9 6l6 6-6 6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'
  };

  function icon(name, size) {
    var s = size || 18;
    return '<svg class="od-icon" style="--od-icon-size:' + s + 'px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(n) {
    return Math.round(Math.abs(Number(n) || 0)).toLocaleString('de-DE') + ' ₫';
  }
  function signedMoney(n, plus) {
    if (n < 0) return '−' + money(n);
    return (plus ? '+' : '') + money(n);
  }
  var pad2 = function (n) { return String(n).padStart(2, '0'); };
  function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      var p = value.split('-');
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  function atTime(value) {
    var d = toDate(value);
    return d ? d.getTime() : 0;
  }
  function fmtDate(iso) {
    var d = toDate(iso);
    if (!d) return '—';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function dateInputValue(iso) {
    if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    var d = toDate(iso) || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function relTime(iso) {
    var d = toDate(iso);
    if (!d) return '';
    var diff = Date.now() - d.getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return mins + ' phút trước';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' giờ trước';
    var days = Math.floor(hours / 24);
    if (days === 1) return 'Hôm qua';
    if (days < 30) return days + ' ngày trước';
    return fmtDate(iso);
  }
  function monthKey(iso) {
    var d = toDate(iso);
    if (!d) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }
  function monthLabel(key) {
    var parts = key.split('-');
    return 'Tháng ' + Number(parts[1]) + '/' + parts[0];
  }
  function memberIds() {
    return state.members.map(function (m) { return m.id; });
  }
  function findMember(id) {
    for (var i = 0; i < state.members.length; i++) {
      if (state.members[i].id === id) return state.members[i];
    }
    return null;
  }
  function nameOf(id) {
    var m = findMember(id);
    if (m) return m.name || 'Thành viên';
    if (state.profile && state.profile.id === id) return state.profile.name || 'Thành viên';
    return '';
  }
  function roleOf(id) {
    var m = findMember(id);
    return m && m.role ? m.role : 'Thành viên';
  }
  function otherOf(id) {
    for (var i = 0; i < state.members.length; i++) {
      if (state.members[i].id !== id) return state.members[i].id;
    }
    return null;
  }
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  function colorIndexOf(id) {
    for (var i = 0; i < state.members.length; i++) {
      if (state.members[i].id === id) return i % 6;
    }
    return 0;
  }
  function avatar(id, extra) {
    return '<span class="avatar avatar--c' + colorIndexOf(id) + (extra ? ' ' + extra : '') + '" aria-hidden="true">' + esc(initials(nameOf(id))) + '</span>';
  }
  function pill(status, size) {
    var s = STATUS[status];
    return '<span class="pill pill--' + s.cls + '">' + icon(s.icon, size || 13) + s.label + '</span>';
  }

  var state = {
    user: null,
    profile: null,
    members: [],
    data: { incomes: [], expenses: [] },
    view: 'overview',
    filter: 'all',
    filters: {
      income: { person: 'all', preset: 'all', from: '', to: '' },
      expenses: { person: 'all', preset: 'all', from: '', to: '' }
    },
    filterDraft: null,
    loading: true,
    loggedIn: false,
    busy: false,
    editingIncome: null,
    editingExpense: null,
    incomeMember: null,
    pollTimer: null,
    refreshing: false,
    lastSync: 0
  };

  function compute() {
    var data = state.data;
    var purchased = data.expenses.filter(function (e) { return e.status === 'purchased'; });
    var totalIn = data.incomes.reduce(function (s, i) { return s + i.amount; }, 0);
    var totalOut = purchased.reduce(function (s, e) { return s + e.amount; }, 0);
    var pending = data.expenses.filter(function (e) { return e.status === 'pending'; }).reduce(function (s, e) { return s + e.amount; }, 0);
    var approved = data.expenses.filter(function (e) { return e.status === 'approved'; }).reduce(function (s, e) { return s + e.amount; }, 0);
    var now = new Date();
    var sameMonth = function (value) {
      var d = toDate(value);
      return !!d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    var monthIn = data.incomes.filter(function (i) { return sameMonth(i.date); }).reduce(function (s, i) { return s + i.amount; }, 0);
    var monthOut = purchased.filter(function (e) { return sameMonth(e.purchasedAt); }).reduce(function (s, e) { return s + e.amount; }, 0);
    return {
      totalIn: totalIn, totalOut: totalOut, balance: totalIn - totalOut,
      pending: pending, approved: approved,
      monthIn: monthIn, monthOut: monthOut,
      monthInCount: data.incomes.filter(function (i) { return sameMonth(i.date); }).length,
      monthOutCount: purchased.filter(function (e) { return sameMonth(e.purchasedAt); }).length
    };
  }

  function todoList() {
    var me = state.user;
    return state.data.expenses.filter(function (e) {
      if (e.status === 'pending') return e.requester !== me && e.agreed[me] !== true;
      return e.status === 'approved';
    }).sort(function (a, b) { return atTime(b.created) - atTime(a.created); });
  }
  var toastTimer = null;
  function toast(message, isError) {
    var el = $('#toast');
    if (!el) return;
    el.innerHTML = icon(isError ? 'alert' : 'check', 16) + '<span>' + esc(message) + '</span>';
    el.classList.toggle('is-error', Boolean(isError));
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
      setTimeout(function () { el.hidden = true; }, 220);
    }, 3200);
  }
  function fail(err) {
    console.error(err);
    toast((err && err.message) || 'Không lưu được. Kiểm tra kết nối mạng rồi thử lại.', true);
  }

  function navItems() {
    return [
      { id: 'overview', label: 'Tổng quan', icon: 'overview' },
      { id: 'income', label: 'Thu nhập', icon: 'income' },
      { id: 'expenses', label: 'Chi tiêu', icon: 'expenses', badge: todoList().length }
    ];
  }

  function navMarkup(mode) {
    var items = navItems();
    return items.map(function (item) {
      if (mode === 'side') {
        return '<button class="side-link" type="button" data-act="nav" data-view="' + item.id + '"' +
          (state.view === item.id ? ' aria-current="page"' : '') + '>' +
          icon(item.icon, 19) + '<span>' + item.label + '</span>' +
          (item.badge ? '<span class="nav-badge">' + item.badge + '</span>' : '') +
          '</button>';
      }
      return '<button class="tab" type="button" data-act="nav" data-view="' + item.id + '"' +
        (state.view === item.id ? ' aria-current="page"' : '') + '>' +
        icon(item.icon, 22) + '<span>' + item.label + '</span>' +
        (item.badge ? '<span class="nav-badge">' + item.badge + '</span>' : '') +
        '</button>';
    }).join('');
  }

  function renderNav() {
    var side = $('#sideNav');
    var tab = $('#tabbar');
    if (side) side.innerHTML = navMarkup('side');
    if (tab) tab.innerHTML = navMarkup('tab');
    var sideUser = $('#sideUser');
    if (sideUser) {
      sideUser.innerHTML = avatar(state.user) + '<span class="side-user-text">' +
        '<span class="side-user-name">' + esc(nameOf(state.user)) + '</span>' +
        '<span class="side-user-mail">' + esc(state.profile ? state.profile.email : '') + '</span></span>';
    }
    var topAvatar = $('#topAvatar');
    if (topAvatar) topAvatar.innerHTML = avatar(state.user);
  }

  function pageHead(title, sub, actions) {
    return '<div class="page-head"><div><h1 class="page-title" id="pageTitle" tabindex="-1">' + esc(title) + '</h1>' +
      (sub ? '<p class="page-sub">' + sub + '</p>' : '') + '</div>' +
      (actions ? '<div class="page-head-actions">' + actions + '</div>' : '') + '</div>';
  }

  function emptyState(opts) {
    return '<div class="empty"><div class="empty-art">' + icon(opts.icon || 'coin', 30) + '</div>' +
      '<p class="empty-title">' + esc(opts.title) + '</p>' +
      '<p class="empty-text">' + esc(opts.text) + '</p>' +
      (opts.actions ? '<div class="empty-actions">' + opts.actions + '</div>' : '') + '</div>';
  }

  function approverChip(e, id) {
    var ok = e.agreed[id] === true;
    var no = e.agreed[id] === false;
    var cls = ok ? 'is-ok' : (no ? 'is-no' : 'is-wait');
    var ic = ok ? 'check' : (no ? 'x' : 'clock');
    return '<span class="approver ' + cls + '">' + avatar(id, 'avatar--xs') + '<span class="approver-name">' + esc(nameOf(id)) + '</span>' + icon(ic, 13) + '</span>';
  }

  function actionButtons(e) {
    var me = state.user;
    var out = [];
    var delBtn = '<button class="btn-icon btn-icon--danger" type="button" data-act="delete-req" data-id="' + e.id + '" aria-label="Xoá yêu cầu ' + esc(e.title) + '">' + icon('trash', 20) + '</button>';
    var canEdit = e.requester === me && ['pending', 'approved', 'purchased'].indexOf(e.status) !== -1;
    var editBtn = canEdit ? '<button class="btn btn--ghost btn--sm" type="button" data-act="edit-expense" data-id="' + e.id + '" aria-label="Sửa yêu cầu ' + esc(e.title) + '">Sửa</button>' : '';

    if (e.status === 'pending') {
      if (e.requester !== me && e.agreed[me] !== true) {
        out.push('<button class="btn btn--accept" type="button" data-act="approve" data-id="' + e.id + '">Đồng ý</button>');
        out.push('<button class="btn btn--reject" type="button" data-act="reject" data-id="' + e.id + '">Từ chối</button>');
      } else if (e.requester === me) {
        var waitingId = otherOf(me);
        var waitingName = waitingId ? nameOf(waitingId) : 'người còn lại';
        var joined = state.members.length >= 2;
        out.push('<span class="req-stamp">Bạn đã đồng ý · ' + (joined ? 'chờ ' + esc(waitingName) : 'chờ ' + esc(waitingName) + ' tham gia') + '</span>');
        out.push(editBtn);
        out.push('<button class="btn btn--ghost btn--sm" type="button" data-act="cancel" data-id="' + e.id + '">Huỷ</button>');
      }
    } else if (e.status === 'approved') {
      out.push('<button class="btn btn--buy" type="button" data-act="ask-buy" data-id="' + e.id + '">Đã mua</button>');
      if (canEdit) out.push(editBtn);
      if (e.requester === me) out.push('<button class="btn btn--ghost btn--sm" type="button" data-act="cancel" data-id="' + e.id + '">Huỷ</button>');
    } else if (e.status === 'purchased') {
      out.push('<span class="req-stamp">Đã mua ' + fmtDate(e.purchasedAt) + '</span>');
      if (canEdit) out.push(editBtn);
      out.push(delBtn);
    } else if (e.status === 'rejected') {
      out.push('<span class="req-stamp">' + esc(nameOf(e.rejectedBy)) + ' từ chối · ' + relTime(e.rejectedAt) + '</span>');
      out.push(delBtn);
    } else {
      out.push('<span class="req-stamp">' + esc(nameOf(e.cancelledBy || e.requester)) + ' đã huỷ · ' + relTime(e.cancelledAt || e.created) + '</span>');
      out.push(delBtn);
    }
    return out.join('');
  }

  function requestCard(e) {
    var closed = e.status === 'rejected' || e.status === 'cancelled';
    var html = '<article class="req-card' + (closed ? ' is-closed' : '') + '" data-open="' + e.id + '">';
    html += '<div class="req-head"><div class="req-title-wrap">' +
      '<button class="req-title req-open" type="button" data-act="open-request" data-id="' + e.id + '">' + esc(e.title) + '</button>' +
      pill(e.status) + '</div>' +
      '<span class="req-amount">' + money(e.amount) + '</span></div>';
    html += '<p class="req-reason od-clamp-2">' + esc(e.reason) + '</p>';
    html += '<div class="req-meta"><span>' + esc(nameOf(e.requester)) + ' gửi · ' + relTime(e.created) + '</span></div>';

    if (e.status === 'pending') {
      var ids = memberIds();
      var waiting = ids.filter(function (id) { return e.agreed[id] !== true; });
      var agreedNames = ids.filter(function (id) { return e.agreed[id] === true; }).map(nameOf);
      var note = waiting.length && agreedNames.length
        ? '<span class="approver-note">' + esc(agreedNames.join(' và ')) + ' đã đồng ý · chờ ' + esc(nameOf(waiting[0])) + ' duyệt</span>'
        : '';
      html += '<div class="req-approvers">' + ids.map(function (id) { return approverChip(e, id); }).join('') + note + '</div>';
    } else if (e.status === 'approved') {
      html += '<p class="req-note">Cả hai đã đồng ý · chờ mua</p>';
    }
    html += '<div class="req-actions">' + actionButtons(e) + '</div>';
    html += '</article>';
    return html;
  }

  function activityItems() {
    var items = [];
    state.data.incomes.forEach(function (i) {
      items.push({ at: i.date, tone: 'income', text: '<b>' + esc(nameOf(i.member)) + '</b> đã thêm thu nhập', amount: i.amount });
    });
    state.data.expenses.forEach(function (e) {
      items.push({ at: e.created, tone: '', text: '<b>' + esc(nameOf(e.requester)) + '</b> gửi yêu cầu “' + esc(e.title) + '”', amount: e.amount });
      if (e.status === 'approved' || e.status === 'purchased') {
        items.push({ at: e.approvedAt || e.purchasedAt, tone: '', text: 'Hai người đã duyệt “' + esc(e.title) + '”', amount: null });
      }
      if (e.status === 'purchased') {
        items.push({ at: e.purchasedAt, tone: 'expense', text: 'Đã ghi nhận chi tiêu “' + esc(e.title) + '”', amount: e.amount });
      }
      if (e.status === 'rejected') {
        items.push({ at: e.rejectedAt, tone: '', text: '<b>' + esc(nameOf(e.rejectedBy)) + '</b> từ chối “' + esc(e.title) + '”', amount: e.amount });
      }
    });
    return items.sort(function (a, b) { return atTime(b.at) - atTime(a.at); }).slice(0, 6);
  }

  function activityHtml() {
    return '<div class="activity">' + activityItems().map(function (item) {
      var tone = item.tone ? ' is-' + item.tone : '';
      var amount = '';
      if (item.amount != null) {
        var sign = item.tone === 'income' ? '+' : (item.tone === 'expense' ? '−' : '');
        amount = '<span class="activity-amount' + tone + '">' + sign + money(item.amount) + '</span>';
      }
      return '<div class="activity-item"><span class="activity-dot' + tone + '" aria-hidden="true"></span>' +
        '<div class="activity-text"><span class="activity-line">' + item.text + '</span>' +
        '<span class="activity-time">' + relTime(item.at) + '</span></div>' + amount + '</div>';
    }).join('') + '</div>';
  }

  function monthIncomeBy(member) {
    var now = new Date();
    return state.data.incomes.filter(function (i) {
      var d = toDate(i.date);
      return i.member === member && d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).reduce(function (s, i) { return s + i.amount; }, 0);
  }

  function inThisMonth(value) {
    var d = toDate(value), now = new Date();
    return !!d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  function chartData() {
    var totals = {};
    state.data.expenses.forEach(function (e) {
      if (e.status !== 'purchased' || !e.purchasedAt || !inThisMonth(e.purchasedAt)) return;
      var id = e.category || 'other';
      totals[id] = (totals[id] || 0) + e.amount;
    });
    var rows = Object.keys(totals).map(function (id) {
      var meta = categoryMeta(id);
      return { id: id, label: meta.label, color: meta.color, value: totals[id] };
    }).sort(function (a, b) { return b.value - a.value; });
    if (!rows.length) return null;

    if (rows.length > 5) {
      var head = rows.slice(0, 4);
      var restSum = rows.slice(4).reduce(function (s, r) { return s + r.value; }, 0);
      var existing = null;
      head.forEach(function (r) { if (r.id === 'other') existing = r; });
      if (existing) existing.value += restSum;
      else head.push({ id: 'other', label: 'Khác', color: categoryMeta('other').color, value: restSum });
      rows = head.sort(function (a, b) { return b.value - a.value; });
    }

    return { rows: rows, total: rows.reduce(function (s, r) { return s + r.value; }, 0) };
  }

  function chartHtml() {
    var data = chartData();
    if (!data) return '';

    var parts = [];
    var segments = '';
    data.rows.forEach(function (row) {
      var pct = Math.round(row.value / data.total * 100);
      parts.push(row.label + ' ' + pct + '%');
      segments += '<span class="chart-seg" style="flex-grow:' + row.value + ';background:' + row.color + '" aria-hidden="true"></span>';
    });

    var legend = data.rows.map(function (row) {
      return '<li class="chart-item">' +
        '<span class="chart-key" style="background:' + row.color + '" aria-hidden="true"></span>' +
        '<span class="chart-name">' + esc(row.label) + '</span>' +
        '<span class="chart-amount">' + money(row.value) + '</span>' +
        '<span class="chart-pct">' + Math.round(row.value / data.total * 100) + '%</span></li>';
    }).join('');

    var c = compute();
    var income = '';
    if (c.monthIn > 0) {
      var used = Math.round(c.monthOut / c.monthIn * 100);
      var over = used > 100;
      income = '<div class="chart-income' + (over ? ' is-over' : '') + '">' +
        '<span class="chart-income-label">' + (over ? 'Chi vượt thu nhập' : 'So với thu nhập') + '</span>' +
        '<span class="chart-income-value">' + used + '%</span></div>';
    }

    var month = monthLabel(monthKey(new Date().toISOString()));
    return '<div class="section chart-section"><div class="section-head"><h2 class="section-title">Chi tiêu theo nhóm</h2>' +
      '<span class="chart-period">' + esc(month) + '</span></div>' +
      '<div class="card chart-card">' +
      '<div class="chart-summary"><div class="chart-total-block"><span class="chart-total-label">Tổng chi tháng này</span>' +
      '<span class="chart-total">' + money(data.total) + '</span></div>' + income + '</div>' +
      '<div class="chart-stack" role="img" aria-label="Chi tiêu tháng này theo nhóm: ' + esc(parts.join(', ')) + '">' + segments + '</div>' +
      '<ul class="chart-legend">' + legend + '</ul></div></div>';
  }

  function renderOverview() {
    var c = compute();
    var isNeg = c.balance < 0;
    var emptyAll = state.data.incomes.length === 0 && state.data.expenses.length === 0;
    var dateLine = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    var html = pageHead('Tổng quan', esc(dateLine));

    if (emptyAll) {
      html += emptyState({
        icon: 'coin',
        title: 'Sổ còn trống',
        text: 'Bắt đầu bằng khoản thu nhập đầu tiên, rồi tạo yêu cầu chi để cả hai cùng duyệt.',
        actions: '<button class="btn btn--primary" type="button" data-act="open-income">' + icon('plus', 18) + 'Thêm thu nhập</button>' +
          '<button class="btn btn--secondary" type="button" data-act="open-expense">Tạo yêu cầu chi</button>'
      });
      return html;
    }

    if (state.members.length < 2) {
      html += '<div class="banner"><span class="banner-icon">' + icon('user', 17) + '</span><div>' +
        '<p class="banner-title">Mời người còn lại đăng nhập</p>' +
        '<p class="banner-text">Khi cả hai cùng vào sổ, yêu cầu chi mới có người duyệt và số dư mới được kiểm soát chung.</p>' +
        '</div></div>';
    }

    html += '<div class="stat-row" style="margin-top:16px">';
    html += '<section class="balance-card' + (isNeg ? ' is-negative' : '') + '" aria-labelledby="balLabel">' +
      '<div class="balance-head"><span class="balance-label" id="balLabel">Số dư hiện tại</span>' +
      (isNeg ? '<span class="pill pill--loan">' + icon('alert', 13) + 'Đang vay</span>' : '') + '</div>' +
      '<span class="balance-amount">' + signedMoney(c.balance) + '</span>' +
      (isNeg ? '<p class="balance-warn">' + icon('alert', 15) + 'Chi vượt thu ' + money(c.balance) + '</p>' : '') +
      (c.pending + c.approved
        ? '<div class="balance-split">' +
          '<div><span class="split-label">Chờ duyệt</span><span class="split-value">' + money(c.pending) + '</span></div>' +
          '<div><span class="split-label">Đã duyệt, chưa mua</span><span class="split-value">' + money(c.approved) + '</span></div>' +
          '</div><p class="balance-foot">Tổng ' + money(c.pending + c.approved) + ' chưa trừ vào số dư.</p>'
        : '<p class="balance-foot">Không có khoản nào đang chờ duyệt.</p>') +
      '</section>';

    html += '<article class="stat-card"><span class="stat-label">Thu tháng này</span>' +
      '<span class="stat-value is-income">' + money(c.monthIn) + '</span>' +
      '<span class="stat-sub">' + c.monthInCount + ' khoản</span></article>';
    html += '<article class="stat-card"><span class="stat-label">Chi tháng này</span>' +
      '<span class="stat-value is-expense">' + money(c.monthOut) + '</span>' +
      '<span class="stat-sub">' + c.monthOutCount + ' khoản đã mua</span></article>';
    html += '</div>';

    var todo = todoList();

    html += '<div class="overview-grid">';
    html += '<div class="overview-col">';
    html += '<div class="section todo-section"><div class="section-head"><div class="section-title-row"><h2 class="section-title">Cần xử lý</h2>' +
      (todo.length ? '<span class="count-pill">' + todo.length + '</span>' : '') + '</div>' +
      '<button class="section-link" type="button" data-act="nav" data-view="expenses">Xem tất cả</button></div>';

    if (todo.length) {
      html += '<div class="req-list">' + todo.map(requestCard).join('') + '</div>';
    } else {
      html += '<div class="card card-pad" style="display:flex;gap:12px;align-items:center;padding:16px">' +
        '<span class="quiet-check">' + icon('check', 16) + '</span>' +
        '<div><p class="card-title">Không có gì chờ bạn</p><p class="card-sub">Yêu cầu cần duyệt sẽ xuất hiện ở đây.</p></div></div>';
    }
    html += '</div>';
    html += chartHtml();
    html += '</div>';

    html += '<div class="overview-col">';
    html += '<div class="section"><div class="section-head"><h2 class="section-title">Hoạt động gần đây</h2></div>' +
      '<div class="card card-pad">' + activityHtml() + '</div></div>';

    html += '<div class="section desk-only"><div class="section-head"><h2 class="section-title">Thu nhập tháng này</h2></div>' +
      '<div class="card card-pad">' + state.members.map(function (m) {
        return '<div class="person-row">' + avatar(m.id, 'avatar--sm') +
          '<div class="person-text"><p class="person-name">' + esc(m.name || 'Thành viên') + '</p><p class="person-role">' + esc(m.role || 'Thành viên') + '</p></div>' +
          '<span class="person-amount">' + money(monthIncomeBy(m.id)) + '</span></div>';
      }).join('') + '</div></div>';
    html += '</div>';
    html += '</div>';

    return html;
  }

  var FILTER_PRESETS = [
    { id: 'all', label: 'Tất cả' },
    { id: 'thisMonth', label: 'Tháng này' },
    { id: 'lastMonth', label: 'Tháng trước' },
    { id: 'last3', label: '3 tháng gần đây' }
  ];

  function presetRange(preset) {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    if (preset === 'thisMonth') return { from: dateInputValue(new Date(y, m, 1)), to: dateInputValue(now) };
    if (preset === 'lastMonth') return { from: dateInputValue(new Date(y, m - 1, 1)), to: dateInputValue(new Date(y, m, 0)) };
    if (preset === 'last3') return { from: dateInputValue(new Date(y, m - 2, 1)), to: dateInputValue(now) };
    return { from: '', to: '' };
  }

  function inDateRange(value, filter) {
    var d = toDate(value);
    if (!d) return false;
    var t = d.getTime();
    if (filter.from) {
      var start = new Date(filter.from + 'T00:00:00').getTime();
      if (!isNaN(start) && t < start) return false;
    }
    if (filter.to) {
      var end = new Date(filter.to + 'T23:59:59.999').getTime();
      if (!isNaN(end) && t > end) return false;
    }
    return true;
  }

  function passesFilter(item, filter, dateField, personField) {
    if (filter.person !== 'all' && item[personField] !== filter.person) return false;
    return inDateRange(item[dateField], filter);
  }

  function filterPersonName(id) { return id === 'all' ? 'Tất cả' : nameOf(id); }

  function shortDate(value) {
    if (!value) return '';
    var parts = value.split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] : value;
  }

  function filterTimeLabel(filter) {
    for (var i = 0; i < FILTER_PRESETS.length; i++) {
      var preset = FILTER_PRESETS[i];
      if (preset.id === 'all' || filter.preset !== preset.id) continue;
      var range = presetRange(preset.id);
      if (range.from === filter.from && range.to === filter.to) return preset.label;
    }
    if (filter.from && filter.to) return shortDate(filter.from) + ' – ' + shortDate(filter.to);
    if (filter.from) return 'Từ ' + shortDate(filter.from);
    if (filter.to) return 'Đến ' + shortDate(filter.to);
    return 'Tất cả thời gian';
  }

  function filterActive(filter) {
    return filter.person !== 'all' || filter.preset !== 'all' || !!filter.from || !!filter.to;
  }

  function filterLabel(kind) { return kind === 'income' ? 'Người kiếm' : 'Người gửi'; }

  function renderFilterPersons() {
    var wrap = $('#filterPersons');
    if (!wrap) return;
    wrap.innerHTML = '<button class="seg-btn is-mini" type="button" data-act="filter-person" data-person="all">Tất cả</button>' +
      state.members.map(function (m) {
        return '<button class="seg-btn is-mini" type="button" data-act="filter-person" data-person="' + esc(m.id) + '">' + esc(m.name || 'Thành viên') + '</button>';
      }).join('');
  }

  function filterBar(kind) {
    var filter = state.filters[kind];
    var active = filterActive(filter);
    var person = filterPersonName(filter.person);
    var time = filterTimeLabel(filter);
    return '<div class="filter-bar" role="group" aria-label="Bộ lọc">' +
      '<button class="filter-trigger' + (filter.person !== 'all' ? ' is-active' : '') + '" type="button" data-act="open-filter" aria-haspopup="dialog" aria-label="' + filterLabel(kind) + ': ' + esc(person) + '">' +
        '<span class="filter-trigger-label">' + filterLabel(kind) + '</span>' +
        '<span class="filter-trigger-value" title="' + esc(person) + '">' + esc(person) + '</span></button>' +
      '<button class="filter-trigger' + (filter.preset !== 'all' || filter.from || filter.to ? ' is-active' : '') + '" type="button" data-act="open-filter" aria-haspopup="dialog" aria-label="Thời gian: ' + esc(time) + '">' +
        '<span class="filter-trigger-label">Thời gian</span>' +
        '<span class="filter-trigger-value" title="' + esc(time) + '">' + esc(time) + '</span></button>' +
      (active ? '<button class="filter-clear" type="button" data-act="clear-filter" aria-label="Xoá bộ lọc">Xoá</button>' : '') +
      '</div>';
  }

  function clearFilter(kind, includeStatus) {
    if (kind !== 'income' && kind !== 'expenses') return;
    state.filters[kind] = { person: 'all', preset: 'all', from: '', to: '' };
    if (kind === 'expenses' && includeStatus) state.filter = 'all';
    render();
  }

  function syncFilterSheet() {
    var draft = state.filterDraft;
    if (!draft) return;
    if (!draft.from && !draft.to) draft.preset = 'all';
    else if (draft.preset !== 'custom') {
      var draftRange = presetRange(draft.preset);
      if (draftRange.from !== draft.from || draftRange.to !== draft.to) draft.preset = 'custom';
    }
    var isIncome = draft.target === 'income';
    var title = $('#filterTitle');
    if (title) title.textContent = isIncome ? 'Lọc thu nhập' : 'Lọc chi tiêu';
    var sub = $('#filterSub');
    if (sub) sub.textContent = isIncome ? 'Theo người kiếm và ngày nhận.' : 'Theo người gửi và ngày tạo yêu cầu.';
    var personLabel = $('#filterPersonLabel');
    if (personLabel) personLabel.textContent = isIncome ? 'Người kiếm' : 'Người gửi';
    $$('#filterPersons [data-person]').forEach(function (button) {
      button.textContent = filterPersonName(button.getAttribute('data-person'));
      button.setAttribute('aria-pressed', button.getAttribute('data-person') === draft.person ? 'true' : 'false');
    });
    $$('#filterPresets [data-preset]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-preset') === draft.preset ? 'true' : 'false');
    });
    var from = $('#filterFrom');
    var to = $('#filterTo');
    if (from) { from.value = draft.from || ''; from.setAttribute('aria-invalid', 'false'); }
    if (to) { to.value = draft.to || ''; to.setAttribute('aria-invalid', 'false'); }
    var hint = $('#filterHint');
    if (hint) hint.textContent = isIncome
      ? 'Lọc theo ngày nhận thu nhập; để trống nếu không giới hạn.'
      : 'Lọc theo ngày gửi yêu cầu; để trống nếu không giới hạn.';
    var error = $('#filterErr');
    if (error) { error.hidden = true; error.textContent = ''; }
  }

  function openFilterSheet() {
    if (state.view !== 'income' && state.view !== 'expenses') return;
    var filter = state.filters[state.view];
    state.filterDraft = { target: state.view, person: filter.person, preset: filter.preset, from: filter.from, to: filter.to };
    renderFilterPersons();
    syncFilterSheet();
    openDialog($('#filterSheet'), '#filterPersons [aria-pressed="true"]');
  }

  function resetFilterDraft() {
    if (!state.filterDraft) return;
    state.filterDraft.person = 'all';
    state.filterDraft.preset = 'all';
    state.filterDraft.from = '';
    state.filterDraft.to = '';
    syncFilterSheet();
  }

  function onFilterDateChange() {
    if (!state.filterDraft) return;
    var from = $('#filterFrom');
    var to = $('#filterTo');
    state.filterDraft.from = from ? from.value : '';
    state.filterDraft.to = to ? to.value : '';
    state.filterDraft.preset = (state.filterDraft.from || state.filterDraft.to) ? 'custom' : 'all';
    syncFilterSheet();
  }

  function applyFilterDraft() {
    var draft = state.filterDraft;
    if (!draft) return;
    var fromEl = $('#filterFrom');
    var toEl = $('#filterTo');
    var error = $('#filterErr');
    var from = fromEl ? fromEl.value : '';
    var to = toEl ? toEl.value : '';
    if (from && to && from > to) {
      if (error) {
        error.textContent = 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.';
        error.hidden = false;
      }
      if (fromEl) fromEl.setAttribute('aria-invalid', 'true');
      if (toEl) toEl.setAttribute('aria-invalid', 'true');
      return;
    }
    var preset = draft.preset;
    if (!from && !to) preset = 'all';
    else if (preset === 'all') preset = 'custom';
    else if (preset !== 'custom') {
      var range = presetRange(preset);
      if (range.from !== from || range.to !== to) preset = 'custom';
    }
    state.filters[draft.target] = { person: draft.person, preset: preset, from: from, to: to };
    state.filterDraft = null;
    closeDialog($('#filterSheet'));
    render();
  }

  function renderIncome() {
    var all = state.data.incomes.slice().sort(function (a, b) { return atTime(b.date) - atTime(a.date); });
    var incomes = all.filter(function (i) { return passesFilter(i, state.filters.income, 'date', 'member'); });
    var total = incomes.reduce(function (s, i) { return s + i.amount; }, 0);
    var html = pageHead('Thu nhập', incomes.length + ' khoản · tổng ' + money(total),
      '<button class="btn btn--primary" type="button" data-act="open-income">' + icon('plus', 18) + 'Thêm thu nhập</button>');

    html += filterBar('income');

    if (!incomes.length) {
      if (all.length) {
        return html + emptyState({
          icon: 'income',
          title: 'Không có khoản thu phù hợp',
          text: 'Thử đổi người hoặc khoảng thời gian để xem các khoản khác.',
          actions: '<button class="btn btn--secondary" type="button" data-act="clear-filter">Xoá bộ lọc</button>'
        });
      }
      return html + emptyState({
        icon: 'income',
        title: 'Chưa có khoản thu nào',
        text: 'Ghi lại lương hoặc khoản kiếm được để số dư của cả hai bắt đầu từ con số thật.',
        actions: '<button class="btn btn--primary" type="button" data-act="open-income">' + icon('plus', 18) + 'Thêm thu nhập</button>'
      });
    }

    var groups = {};
    incomes.forEach(function (i) {
      var key = monthKey(i.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(i);
    });

    Object.keys(groups).sort().reverse().forEach(function (key) {
      var list = groups[key];
      var sum = list.reduce(function (s, i) { return s + i.amount; }, 0);
      html += '<section class="income-group"><div class="group-head"><h2 class="group-title">' + esc(monthLabel(key)) + '</h2>' +
        '<span class="group-sum">+' + money(sum) + '</span></div>' +
        '<div class="card income-table">' +
        '<div class="income-head" aria-hidden="true"><span>Người kiếm</span><span>Ghi chú</span><span>Ngày</span><span style="text-align:right">Số tiền</span><span></span></div>';
      list.forEach(function (i) {
        html += '<div class="income-row">' +
          '<div class="income-who">' + avatar(i.member, 'avatar--sm') + '<span class="income-name">' + esc(nameOf(i.member)) + '</span></div>' +
          '<div class="income-info"><span class="income-note">' + esc(i.note || 'Không ghi chú') + '</span></div>' +
          '<div class="income-date">' + fmtDate(i.date) + '</div>' +
          '<div class="income-amount">+' + money(i.amount) + '</div>' +
          '<button class="btn-icon income-more" type="button" data-act="income-menu" data-id="' + i.id + '" aria-label="Thao tác với khoản thu ' + esc(i.note || nameOf(i.member)) + '">' + icon('more', 20) + '</button>' +
          '</div>';
      });
      html += '</div></section>';
    });

    return html;
  }

  var FILTERS = [
    { id: 'all', label: 'Tất cả' },
    { id: 'pending', label: 'Chờ duyệt' },
    { id: 'approved', label: 'Đã duyệt' },
    { id: 'purchased', label: 'Đã chi tiêu' },
    { id: 'other', label: 'Khác' }
  ];

  function filterCount(id, source) {
    source = source || state.data.expenses;
    return source.filter(function (e) {
      if (id === 'all') return true;
      if (id === 'other') return e.status === 'rejected' || e.status === 'cancelled';
      return e.status === id;
    }).length;
  }

  function renderExpenses() {
    var order = { pending: 0, approved: 1, purchased: 2, rejected: 3, cancelled: 4 };
    var base = state.data.expenses.filter(function (e) {
      return passesFilter(e, state.filters.expenses, 'created', 'requester');
    });
    var list = base.slice().sort(function (a, b) {
      var d = (order[a.status] || 0) - (order[b.status] || 0);
      return d !== 0 ? d : atTime(b.created) - atTime(a.created);
    });
    if (state.filter !== 'all') {
      list = list.filter(function (e) {
        if (state.filter === 'other') return e.status === 'rejected' || e.status === 'cancelled';
        return e.status === state.filter;
      });
    }

    var openCount = base.filter(function (e) { return e.status === 'pending' || e.status === 'approved'; }).length;
    var html = pageHead('Chi tiêu', openCount ? openCount + ' khoản đang chờ xử lý' : 'Không có khoản nào đang chờ',
      '<button class="btn btn--primary" type="button" data-act="open-expense">' + icon('plus', 18) + 'Tạo yêu cầu chi</button>');

    html += filterBar('expenses');
    html += '<div class="chip-rail" role="group" aria-label="Lọc yêu cầu theo trạng thái">' +
      FILTERS.map(function (f) {
        var count = filterCount(f.id, base);
        return '<button class="chip" type="button" data-act="filter" data-filter="' + f.id + '" aria-pressed="' + (state.filter === f.id ? 'true' : 'false') + '">' +
          f.label + (count ? '<b>' + count + '</b>' : '') + '</button>';
      }).join('') + '</div>';

    if (!list.length) {
      var isAllData = state.data.expenses.length === 0;
      var baseEmpty = base.length === 0;
      html += emptyState({
        icon: 'expenses',
        title: isAllData ? 'Chưa có yêu cầu chi' : (baseEmpty ? 'Không có yêu cầu phù hợp' : 'Không có yêu cầu ở mục này'),
        text: isAllData
          ? 'Tạo yêu cầu đầu tiên để người còn lại nhận được và bấm duyệt.'
          : (baseEmpty
            ? 'Thử đổi người hoặc khoảng thời gian để xem các yêu cầu khác.'
            : 'Thử chọn “Tất cả” để xem những yêu cầu ở trạng thái khác.'),
        actions: isAllData
          ? '<button class="btn btn--primary" type="button" data-act="open-expense">' + icon('plus', 18) + 'Tạo yêu cầu chi</button>'
          : (baseEmpty
            ? '<button class="btn btn--secondary" type="button" data-act="clear-all-filters">Xoá bộ lọc</button>'
            : '<button class="btn btn--secondary" type="button" data-act="filter" data-filter="all">Xem tất cả</button>')
      });
      return html;
    }

    html += '<div class="req-list">' + list.map(requestCard).join('') + '</div>';
    return html;
  }

  function render() {
    renderNav();
    var content = $('#content');
    if (!content) return;
    if (state.loading) {
      content.innerHTML = pageHead('Tổng quan', 'Đang tải sổ của gia đình…') +
        '<div class="skeleton-block" style="height:150px"></div>' +
        '<div class="skeleton-grid" style="margin-top:12px">' +
        '<div class="skeleton-block" style="height:88px"></div><div class="skeleton-block" style="height:88px"></div></div>' +
        '<div class="skeleton-block" style="height:180px;margin-top:20px"></div>' +
        '<div class="skeleton-block" style="height:140px;margin-top:16px"></div>';
      return;
    }
    var view = state.view;
    if (view === 'income') content.innerHTML = renderIncome();
    else if (view === 'expenses') content.innerHTML = renderExpenses();
    else content.innerHTML = renderOverview();
  }

  function go(view) {
    if (['overview', 'income', 'expenses'].indexOf(view) === -1) view = 'overview';
    state.view = view;
    render();
    window.scrollTo(0, 0);
    if (window.history && window.history.replaceState) {
      try { window.history.replaceState(null, '', '#' + view); } catch (err) { /* preview sandbox */ }
    }
  }

  function findExpense(id) {
    return state.data.expenses.filter(function (e) { return e.id === id; })[0];
  }

  function openDialog(dialog, focusSelector) {
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('sheet-open');
    requestAnimationFrame(function () {
      var target = focusSelector ? $(focusSelector, dialog) : null;
      if (!target) target = dialog.querySelector('input:not([type=hidden]), textarea, button');
      if (target) target.focus();
    });
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
  }

  function focusPage() {
    var title = $('#pageTitle');
    if (title) title.focus({ preventScroll: true });
  }

  function setBusy(button, label) {
    state.busy = true;
    document.body.classList.add('is-busy');

    var original = button ? button.innerHTML : '';
    var wasDisabled = button ? button.disabled : false;
    var scope = button ? (button.closest('dialog') || button.closest('.req-card')) : null;
    var others = [];
    if (scope) {
      others = $$('button', scope).filter(function (b) { return b !== button; });
    }
    var previous = others.map(function (b) { return { el: b, disabled: b.disabled }; });
    previous.forEach(function (item) { item.el.disabled = true; });

    if (button) {
      button.disabled = true;
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span>' + esc(label || 'Đang xử lý…') + '</span>';
    }

    return function done() {
      state.busy = false;
      document.body.classList.remove('is-busy');
      previous.forEach(function (item) { item.el.disabled = item.disabled; });
      if (button) {
        button.classList.remove('is-loading');
        button.removeAttribute('aria-busy');
        button.disabled = wasDisabled;
        button.innerHTML = original;
      }
    };
  }

  async function runBusy(button, label, task) {
    if (state.busy) return false;
    var done = setBusy(button, label);
    try {
      return await task();
    } finally {
      done();
    }
  }

  function timelineHtml(e) {
    var items = [];
    var order = [e.requester].concat(memberIds().filter(function (id) { return id !== e.requester; }));
    items.push({ cls: 'is-done', icon: 'check', title: 'Gửi yêu cầu', time: fmtDate(e.created) + ' · ' + relTime(e.created) });
    order.forEach(function (id) {
      if (e.agreed[id] === true) {
        items.push({ cls: 'is-done', icon: 'check', title: nameOf(id) + ' đã đồng ý', time: '' });
      }
    });
    if (e.status === 'pending') {
      order.forEach(function (id) {
        if (e.agreed[id] !== true) {
          items.push({ cls: 'is-wait', icon: 'clock', title: 'Chờ ' + nameOf(id) + ' duyệt', time: '' });
        }
      });
    } else if (e.status === 'approved') {
      items.push({ cls: 'is-done', icon: 'check', title: 'Đã duyệt', time: e.approvedAt ? fmtDate(e.approvedAt) : '' });
    } else if (e.status === 'purchased') {
      items.push({ cls: 'is-done', icon: 'cart', title: 'Đã mua', time: fmtDate(e.purchasedAt) });
    } else if (e.status === 'rejected') {
      items.push({ cls: 'is-bad', icon: 'x', title: nameOf(e.rejectedBy) + ' từ chối', time: relTime(e.rejectedAt) });
    } else if (e.status === 'cancelled') {
      items.push({ cls: 'is-bad', icon: 'slash', title: nameOf(e.cancelledBy || e.requester) + ' đã huỷ', time: relTime(e.cancelledAt || e.created) });
    }
    return '<div class="timeline">' + items.map(function (item) {
      return '<div class="tl-item ' + item.cls + '"><span class="tl-dot">' + icon(item.icon, 14) + '</span>' +
        '<div class="tl-text"><span class="tl-title">' + esc(item.title) + '</span>' +
        (item.time ? '<span class="tl-time">' + item.time + '</span>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  function approverCards(e) {
    return '<div class="approver-cards">' + memberIds().map(function (id) {
      var cls = '';
      var label = 'Đang chờ';
      var ic = 'clock';
      if (e.rejectedBy === id) { cls = 'is-no'; label = 'Từ chối · ' + relTime(e.rejectedAt); ic = 'x'; }
      else if (e.agreed[id] === true) { cls = 'is-ok'; label = 'Đã đồng ý'; ic = 'check'; }
      else if (e.status === 'cancelled') { cls = ''; label = 'Không xét'; ic = 'slash'; }
      else { cls = 'is-wait'; label = 'Đang chờ'; ic = 'clock'; }
      return '<div class="approver-card ' + cls + '"><div class="approver-card-top">' + avatar(id, 'avatar--sm') +
        '<span class="approver-card-name">' + esc(nameOf(id)) + '</span></div>' +
        '<span class="approver-card-state">' + icon(ic, 14) + esc(label) + '</span></div>';
    }).join('') + '</div>';
  }

  function openDetail(id) {
    var e = findExpense(id);
    if (!e) return;
    var sheet = $('#detailSheet');
    var body = $('#detailBody');
    if (!sheet || !body) return;

    var s = STATUS[e.status];
    body.innerHTML =
      '<div class="detail-hero"><span class="detail-amount">' + money(e.amount) + '</span>' +
      '<span class="detail-title">' + esc(e.title) + '</span>' +
      '<p class="detail-reason">' + esc(e.reason) + '</p></div>' +
      '<dl class="detail-facts">' +
      '<div class="fact"><dt>Người gửi</dt><dd>' + esc(nameOf(e.requester)) + '</dd></div>' +
      '<div class="fact"><dt>Nhóm chi</dt><dd>' + esc(categoryMeta(e.category || 'other').label) + '</dd></div>' +
      '<div class="fact"><dt>Thời gian tạo</dt><dd>' + fmtDate(e.created) + '</dd></div>' +
      (e.status === 'purchased' ? '<div class="fact"><dt>Đã mua</dt><dd>' + fmtDate(e.purchasedAt) + '</dd></div>' : '') +
      (e.status === 'rejected' ? '<div class="fact"><dt>Từ chối bởi</dt><dd>' + esc(nameOf(e.rejectedBy)) + ' · ' + fmtDate(e.rejectedAt) + '</dd></div>' : '') +
      '</dl>' +
      '<div><p class="block-label">Dòng thời gian</p>' + timelineHtml(e) + '</div>' +
      '<div><p class="block-label">Người duyệt</p>' + approverCards(e) + '</div>';

    var waitingIds = e.status === 'pending'
      ? memberIds().filter(function (id) { return e.agreed[id] !== true; })
      : [];
    $('#detailSub').textContent = e.status === 'pending'
      ? (waitingIds.length ? 'Đang chờ ' + nameOf(waitingIds[0]) + ' duyệt' : 'Đang chờ đủ người duyệt')
      : s.label;

    var actions = actionButtons(e);
    $('#detailActions').innerHTML = actions || '<button class="btn btn--secondary btn--block" type="button" data-close>Đóng</button>';
    openDialog(sheet, '#detailBody [data-act], #detailBody button');
  }

  function openPurchase(id) {
    var e = findExpense(id);
    if (!e || e.status !== 'approved') return;
    closeDialog($('#detailSheet'));
    var c = compute();
    var after = c.balance - e.amount;
    var body = $('#purchaseBody');
    var foot = $('#purchaseFoot');
    if (!body || !foot) return;

    body.innerHTML =
      '<p class="purchase-q">Xác nhận đã mua <b>' + esc(e.title) + '</b>?</p>' +
      '<p class="purchase-amount">' + money(e.amount) + '</p>' +
      '<div class="purchase-balance' + (after < 0 ? ' is-neg' : '') + '">' +
      '<span>Số dư sau khi mua</span><b>' + signedMoney(after) + '</b></div>' +
      (after < 0
        ? '<p class="purchase-warn">' + icon('alert', 16) + 'Sau khi mua, bạn sẽ đang vay ' + money(after) + '.</p>'
        : '<p class="purchase-note">Khoản này sẽ bị trừ vào số dư chung ngay khi bạn xác nhận.</p>');

    foot.innerHTML = '<button class="btn btn--secondary" type="button" data-close>Huỷ</button>' +
      '<button class="btn btn--primary" type="button" data-act="confirm-buy" data-id="' + e.id + '">' + icon('check', 17) + 'Đã mua</button>';
    openDialog($('#purchaseSheet'), '#purchaseSheet [data-close]');
  }

  var confirmAction = null;
  var confirmBusyLabel = 'Đang xử lý…';
  function openConfirm(opts) {
    var sheet = $('#confirmSheet');
    if (!sheet) return;
    closeDialog($('#detailSheet'));
    $('#confirmTitle').textContent = opts.title;
    $('#confirmText').innerHTML = opts.message;
    var btn = $('#confirmBtn');
    btn.textContent = opts.confirmLabel || 'Xác nhận';
    btn.className = 'btn ' + (opts.danger === false ? 'btn--primary' : 'btn--danger-solid');
    confirmAction = opts.onConfirm || null;
    confirmBusyLabel = opts.busyLabel || 'Đang xử lý…';
    openDialog(sheet, '#confirmCancel');
  }

  function afterMutation() {
    closeDialog($('#detailSheet'));
    closeDialog($('#confirmSheet'));
    closeDialog($('#incomeSheet'));
    closeDialog($('#incomeMenu'));
    closeDialog($('#expenseSheet'));
    closeDialog($('#purchaseSheet'));
    render();
    requestAnimationFrame(focusPage);
  }

  function memberSeg(selected) {
    return state.members.map(function (m) {
      return '<button class="seg-btn" type="button" data-act="pick-member" data-member="' + esc(m.id) + '" aria-pressed="' + (selected === m.id ? 'true' : 'false') + '">' +
        avatar(m.id, 'avatar--xs') + '<span class="seg-name">' + esc(m.name || 'Thành viên') + '</span></button>';
    }).join('');
  }

  function findIncome(id) {
    return state.data.incomes.filter(function (i) { return i.id === id; })[0];
  }

  function openIncomeForm(income) {
    var form = $('#incomeForm');
    if (!form) return;
    var editing = !!income;
    state.editingIncome = editing ? income.id : null;
    state.incomeMember = editing ? income.member : state.user;

    $('#incomeTitle').textContent = editing ? 'Sửa khoản thu' : 'Thêm thu nhập';
    $('#incomeSheetSub').textContent = editing
      ? 'Cập nhật số tiền, ngày hoặc người kiếm.'
      : 'Khoản tiền này sẽ cộng vào số dư chung.';
    $('#incomeSubmit').textContent = editing ? 'Lưu thay đổi' : 'Lưu';
    $('#incMember').innerHTML = memberSeg(state.incomeMember);

    $('#incAmount').value = editing ? Number(income.amount).toLocaleString('de-DE') : '';
    $('#incAmount').setAttribute('aria-invalid', 'false');
    var incFieldWrap = $('#incAmount').closest('.amount-field');
    if (incFieldWrap) incFieldWrap.classList.remove('is-error');
    $('#incAmountErr').hidden = true;
    $('#incAmountErr').textContent = '';
    $('#incDate').value = dateInputValue(editing ? income.date : new Date().toISOString());
    $('#incNote').value = editing ? (income.note || '') : '';
    openDialog($('#incomeSheet'), '#incAmount');
  }

  function openExpenseForm(expense) {
    var form = $('#expenseForm');
    if (!form) return;
    if (expense && (expense.requester !== state.user || ['pending', 'approved', 'purchased'].indexOf(expense.status) === -1)) return;

    var editing = !!expense;
    state.editingExpense = editing ? expense.id : null;

    $('#expenseTitle').textContent = editing ? 'Sửa yêu cầu chi' : 'Tạo yêu cầu chi';
    $('#expenseSheetSub').textContent = editing
      ? 'Cập nhật thông tin yêu cầu chi.'
      : 'Cả hai cùng duyệt trước khi mua.';
    $('#expenseSubmit').textContent = editing ? 'Lưu thay đổi' : 'Gửi yêu cầu';

    $('#expTitle').value = editing ? expense.title : '';
    $('#expAmount').value = editing ? Number(expense.amount).toLocaleString('de-DE') : '';
    $('#expReason').value = editing ? (expense.reason || '') : '';
    $('#expCategory').value = editing ? (expense.category || 'other') : 'other';

    ['#expTitleErr', '#expAmountErr', '#expReasonErr'].forEach(function (sel) {
      $(sel).hidden = true;
      $(sel).textContent = '';
    });
    ['#expTitle', '#expAmount', '#expReason'].forEach(function (sel) { $(sel).setAttribute('aria-invalid', 'false'); });
    var expFieldWrap = $('#expAmount').closest('.amount-field');
    if (expFieldWrap) expFieldWrap.classList.remove('is-error');

    var notice;
    if (!editing) {
      notice = 'Người gửi được tính là đã đồng ý. ' + esc(nameOf(otherOf(state.user))) + ' sẽ nhận được yêu cầu để duyệt.';
    } else if (expense.status === 'approved') {
      notice = 'Yêu cầu đã duyệt sẽ quay về Chờ duyệt để ' + esc(nameOf(otherOf(expense.requester))) + ' duyệt lại sau khi lưu.';
    } else if (expense.status === 'purchased') {
      notice = 'Đây là khoản đã mua. Nếu đổi số tiền, số dư sẽ được tính lại.';
    } else {
      notice = 'Yêu cầu vẫn ở trạng thái Chờ duyệt sau khi sửa.';
    }
    $('#expNotice').innerHTML = icon('info', 16) + '<span>' + notice + '</span>';

    closeDialog($('#detailSheet'));
    openDialog($('#expenseSheet'), '#expTitle');
  }

  function openAccount() {
    var body = $('#accountBody');
    if (!body) return;
    var me = state.profile || {};
    var rows = state.members.map(function (m) {
      return '<div class="person-row">' + avatar(m.id, 'avatar--sm') +
        '<div class="person-text"><p class="person-name">' + esc(m.name || 'Thành viên') + '</p>' +
        '<p class="person-role">' + esc(m.role || 'Thành viên') + '</p></div>' +
        (m.id === state.user ? '<span class="req-stamp">Bạn</span>' : '') + '</div>';
    }).join('');

    body.innerHTML =
      '<div class="account-head">' + avatar(state.user) +
      '<div class="account-text"><p class="account-name">' + esc(me.name || 'Thành viên') + '</p>' +
      '<p class="account-mail">' + esc(me.email || '') + '</p></div></div>' +
      '<div class="field"><label for="accName">Tên hiển thị</label>' +
      '<input class="input" id="accName" value="' + esc(me.name || '') + '" maxlength="24" autocomplete="off"></div>' +
      '<div class="field"><label for="accRole">Vai trò <span class="opt">(không bắt buộc)</span></label>' +
      '<input class="input" id="accRole" value="' + esc(me.role || '') + '" maxlength="16" placeholder="Ví dụ: Chồng, Vợ" autocomplete="off"></div>' +
      '<button class="btn btn--primary btn--block" type="button" data-act="save-name">' + icon('check', 17) + 'Lưu thay đổi</button>' +
      '<p class="block-label" style="margin-top:22px">Thành viên sổ</p>' +
      '<div style="display:flex;flex-direction:column;gap:12px">' + rows + '</div>' +
      '<button class="btn btn--danger btn--block" type="button" data-act="logout" style="margin-top:20px">' + icon('logout', 17) + 'Đăng xuất</button>';
    openDialog($('#accountSheet'), '#accName');
  }

  function newId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10);
  }

  function addIncome() {
    var amount = Number($('#incAmount').value.replace(/[^\d]/g, ''));
    var dateVal = $('#incDate').value;
    if (!amount) {
      $('#incAmount').setAttribute('aria-invalid', 'true');
      var incField = $('#incAmount').closest('.amount-field');
      if (incField) incField.classList.add('is-error');
      $('#incAmountErr').textContent = 'Nhập số tiền lớn hơn 0.';
      $('#incAmountErr').hidden = false;
      $('#incAmount').focus();
      return;
    }
    if (!dateVal) {
      $('#incDate').focus();
      return;
    }

    var editing = state.editingIncome ? findIncome(state.editingIncome) : null;
    var values = {
      amount: amount,
      date: dateVal,
      member: state.incomeMember || state.user,
      note: $('#incNote').value.trim()
    };

    runBusy($('#incomeSubmit'), 'Đang lưu…', async function () {
      try {
        if (editing) {
          await api.updateIncome(Object.assign({ id: editing.id }, values));
          editing.amount = values.amount;
          editing.date = values.date;
          editing.member = values.member;
          editing.note = values.note;
          toast('Đã cập nhật thu nhập');
        } else {
          var id = newId();
          await api.addIncome(Object.assign({ id: id }, values));
          state.data.incomes.push({
            id: id,
            amount: amount,
            date: values.date,
            member: values.member,
            note: values.note,
            createdAt: new Date().toISOString()
          });
          toast('Đã thêm thu nhập ' + money(amount));
        }
        state.editingIncome = null;
        afterMutation();
      } catch (err) {
        fail(err);
      }
    });
  }

  function createExpense() {
    var title = $('#expTitle').value.trim();
    var amount = Number($('#expAmount').value.replace(/[^\d]/g, ''));
    var reason = $('#expReason').value.trim();
    var category = $('#expCategory').value || 'other';
    var ok = true;

    if (!title) {
      $('#expTitle').setAttribute('aria-invalid', 'true');
      $('#expTitleErr').textContent = 'Nhập tên món cần mua.';
      $('#expTitleErr').hidden = false;
      ok = false;
    }
    if (!amount) {
      $('#expAmount').setAttribute('aria-invalid', 'true');
      var expField = $('#expAmount').closest('.amount-field');
      if (expField) expField.classList.add('is-error');
      $('#expAmountErr').textContent = 'Nhập số tiền lớn hơn 0.';
      $('#expAmountErr').hidden = false;
      ok = false;
    }
    if (!reason) {
      $('#expReason').setAttribute('aria-invalid', 'true');
      $('#expReasonErr').textContent = 'Cho người duyệt biết lý do mua.';
      $('#expReasonErr').hidden = false;
      ok = false;
    }
    if (!ok) {
      var first = $('#expTitle[aria-invalid="true"]') || $('#expAmount[aria-invalid="true"]') || $('#expReason[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }

    var editing = state.editingExpense ? findExpense(state.editingExpense) : null;
    var me = state.user;

    runBusy($('#expenseSubmit'), editing ? 'Đang lưu…' : 'Đang gửi…', async function () {
      try {
        if (editing) {
          await api.updateExpense({
            id: editing.id,
            title: title,
            amount: amount,
            category: category,
            reason: reason
          });
          editing.title = title;
          editing.amount = amount;
          editing.category = category;
          editing.reason = reason;

          if (editing.status === 'approved') {
            var reset = {};
            reset[editing.requester] = true;
            state.members.forEach(function (m) { if (m.id !== editing.requester) reset[m.id] = null; });
            editing.status = 'pending';
            editing.approvedAt = null;
            editing.agreed = reset;
            var partner = otherOf(editing.requester);
            toast('Đã cập nhật · chờ ' + (partner ? nameOf(partner) : 'người còn lại') + ' duyệt lại');
          } else if (editing.status === 'purchased') {
            toast('Đã cập nhật chi tiêu · số dư đã tính lại');
          } else {
            toast('Đã cập nhật yêu cầu');
          }
        } else {
          var id = newId();
          var agreed = {};
          agreed[me] = true;
          state.members.forEach(function (m) { if (m.id !== me) agreed[m.id] = null; });

          await api.addExpense({
            id: id,
            title: title,
            amount: amount,
            category: category,
            reason: reason
          });

          state.data.expenses.push({
            id: id,
            title: title,
            amount: amount,
            category: category,
            reason: reason,
            requester: me,
            created: new Date().toISOString(),
            agreed: agreed,
            status: 'pending'
          });
          state.filter = 'all';
          state.view = 'expenses';
          var other = otherOf(me);
          toast('Đã gửi yêu cầu' + (other ? ' tới ' + nameOf(other) : ''));
        }
        state.editingExpense = null;
        afterMutation();
      } catch (err) {
        fail(err);
      }
    });
  }

  function approve(id, button) {
    if (state.busy) return;
    var e = findExpense(id);
    if (!e || e.status !== 'pending') return;
    var me = state.user;
    var partner = otherOf(me);

    runBusy(button, 'Đang xử lý…', async function () {
      try {
        var res = await api.approve(id);
        e.agreed[me] = true;
        if (res.approved) {
          e.status = 'approved';
          e.approvedAt = res.approvedAt || new Date().toISOString();
        }
        toast(res.approved
          ? 'Đã đồng ý · yêu cầu đủ hai người duyệt'
          : 'Đã đồng ý · chờ ' + (partner ? nameOf(partner) : 'người còn lại') + ' duyệt');
        afterMutation();
      } catch (err) {
        fail(err);
      }
    });
  }

  function reject(id, button) {
    if (state.busy) return;
    var e = findExpense(id);
    if (!e || e.status !== 'pending') return;

    runBusy(button, 'Đang xử lý…', async function () {
      try {
        var res = await api.reject(id);
        e.status = 'rejected';
        e.rejectedBy = state.user;
        e.rejectedAt = res.rejectedAt || new Date().toISOString();
        e.agreed[state.user] = false;
        toast('Đã từ chối yêu cầu');
        afterMutation();
      } catch (err) {
        fail(err);
      }
    });
  }

  function askCancel(id) {
    var e = findExpense(id);
    if (!e || e.requester !== state.user) return;
    openConfirm({
      title: 'Huỷ yêu cầu?',
      message: '<b>' + esc(e.title) + '</b> · ' + money(e.amount) + '. Yêu cầu sẽ dừng ở trạng thái Đã huỷ và không trừ số dư.',
      confirmLabel: 'Huỷ yêu cầu',
      busyLabel: 'Đang huỷ…',
      onConfirm: async function () {
        try {
          await api.cancel(id);
          e.status = 'cancelled';
          e.cancelledBy = state.user;
          e.cancelledAt = new Date().toISOString();
          toast('Đã huỷ yêu cầu');
          afterMutation();
        } catch (err) {
          fail(err);
        }
      }
    });
  }

  function askDeleteExpense(id) {
    var e = findExpense(id);
    if (!e) return;
    openConfirm({
      title: 'Xoá yêu cầu?',
      message: '<b>' + esc(e.title) + '</b> sẽ bị xoá khỏi sổ. Thao tác này không thể hoàn tác.',
      confirmLabel: 'Xoá',
      busyLabel: 'Đang xoá…',
      onConfirm: async function () {
        try {
          await api.deleteExpense(id);
          state.data.expenses = state.data.expenses.filter(function (x) { return x.id !== id; });
          toast('Đã xoá yêu cầu');
          afterMutation();
        } catch (err) {
          fail(err);
        }
      }
    });
  }

  function confirmBuy(id, button) {
    if (state.busy) return;
    var e = findExpense(id);
    if (!e || e.status !== 'approved') return;

    runBusy(button, 'Đang xử lý…', async function () {
      try {
        var res = await api.purchase(id);
        e.status = 'purchased';
        e.purchasedAt = res.purchasedAt || new Date().toISOString();
        toast('Đã ghi nhận chi tiêu · số dư đã cập nhật');
        afterMutation();
      } catch (err) {
        fail(err);
      }
    });
  }

  function askDeleteIncome(id) {
    var inc = findIncome(id);
    if (!inc) return;
    openConfirm({
      title: 'Xoá khoản thu?',
      message: '<b>' + (inc.note ? esc(inc.note) : esc(nameOf(inc.member))) + '</b> · +' + money(inc.amount) + '. Số dư sẽ được tính lại.',
      confirmLabel: 'Xoá',
      busyLabel: 'Đang xoá…',
      onConfirm: async function () {
        try {
          await api.deleteIncome(id);
          state.data.incomes = state.data.incomes.filter(function (i) { return i.id !== id; });
          toast('Đã xoá khoản thu');
          afterMutation();
        } catch (err) {
          fail(err);
        }
      }
    });
  }
  function openIncomeMenu(id) {
    var income = findIncome(id);
    var sheet = $('#incomeMenu');
    if (!income || !sheet) return;
    $('#incomeMenuTitle').textContent = income.note || 'Khoản thu';
    $('#incomeMenuSub').textContent = nameOf(income.member) + ' · ' + money(income.amount) + ' · ' + fmtDate(income.date);
    $('#incomeMenuBody').innerHTML =
      '<button class="menu-row" type="button" data-act="edit-income" data-id="' + income.id + '">' + icon('pencil', 20) + '<span>Chỉnh sửa</span></button>' +
      '<button class="menu-row menu-row--danger" type="button" data-act="delete-income" data-id="' + income.id + '">' + icon('trash', 20) + '<span>Xoá khoản thu</span></button>';
    openDialog(sheet, '#incomeMenuBody .menu-row');
  }

  function showLogin() {
    $('#loginView').hidden = false;
    $('#appView').hidden = true;
    state.loggedIn = false;
    document.body.classList.remove('sheet-open');
  }

  function showAccessDenied(message) {
    var alert = $('#loginAlert');
    if (alert) {
      alert.textContent = message || 'Tài khoản này chưa được cấp quyền vào sổ.';
      alert.hidden = false;
    }
    showLogin();
  }

  function resetForgotSheet() {
    var title = $('#forgotTitle');
    var sub = $('#forgotSub');
    var fields = $('#forgotFields');
    var done = $('#forgotDone');
    var email = $('#forgotEmail');
    var err = $('#forgotEmailErr');
    var submit = $('#forgotSubmit');
    var close = $('#forgotClose');
    if (title) title.textContent = 'Quên mật khẩu';
    if (sub) sub.textContent = 'Mật khẩu sẽ được gửi đến đúng email của tài khoản.';
    if (fields) fields.hidden = false;
    if (done) done.hidden = true;
    if (email) {
      email.value = '';
      email.setAttribute('aria-invalid', 'false');
    }
    if (err) {
      err.textContent = '';
      err.hidden = true;
    }
    if (submit) {
      submit.hidden = false;
      submit.disabled = false;
      submit.innerHTML = 'Gửi mật khẩu';
      submit.removeAttribute('aria-busy');
      submit.classList.remove('is-loading');
    }
    if (close) {
      close.hidden = false;
      close.disabled = false;
      close.textContent = 'Đóng';
      close.classList.remove('btn--primary');
      close.classList.add('btn--secondary');
    }
    var doneText = $('#forgotDoneText');
    if (doneText) doneText.textContent = '';
  }

  function openForgotSheet() {
    var sheet = $('#forgotSheet');
    if (!sheet || state.loggedIn) return;
    var loginBtn = $('#loginBtn');
    if (loginBtn && loginBtn.disabled) return;
    resetForgotSheet();
    var loginEmail = $('#loginEmail');
    var email = $('#forgotEmail');
    if (email && loginEmail) email.value = loginEmail.value.trim();
    openDialog(sheet, '#forgotEmail');
  }

  function showForgotError(message) {
    var email = $('#forgotEmail');
    var err = $('#forgotEmailErr');
    if (err) {
      err.textContent = message;
      err.hidden = false;
    }
    if (email) {
      email.setAttribute('aria-invalid', 'true');
      email.focus();
    }
  }

  function syncForgotSent(member) {
    var fields = $('#forgotFields');
    var done = $('#forgotDone');
    var title = $('#forgotTitle');
    var sub = $('#forgotSub');
    var text = $('#forgotDoneText');
    var email = $('#forgotEmail');
    var err = $('#forgotEmailErr');
    var submit = $('#forgotSubmit');
    var close = $('#forgotClose');
    if (fields) fields.hidden = true;
    if (done) done.hidden = false;
    if (title) title.textContent = 'Kiểm tra email';
    if (sub) sub.textContent = 'Mật khẩu đã được gửi đến đúng tài khoản.';
    if (text) text.innerHTML = 'Mật khẩu của tài khoản <b>' + esc(member.name) + '</b> đã được gửi đến <b>' + esc(member.email) + '</b>.';
    if (email) email.setAttribute('aria-invalid', 'false');
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
    if (submit) submit.hidden = true;
    if (close) {
      close.textContent = 'Đóng';
      close.classList.remove('btn--secondary');
      close.classList.add('btn--primary');
    }
    if (done) done.focus();
  }

  function sendForgotEmail() {
    if (state.busy) return;
    var fields = $('#forgotFields');
    if (fields && fields.hidden) return;
    var emailEl = $('#forgotEmail');
    if (!emailEl) return;
    var email = emailEl.value.trim();
    var err = $('#forgotEmailErr');
    if (err) {
      err.textContent = '';
      err.hidden = true;
    }
    emailEl.setAttribute('aria-invalid', 'false');
    if (!email) {
      showForgotError('Nhập email tài khoản.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showForgotError('Email chưa đúng định dạng.');
      return;
    }
    var btn = $('#forgotSubmit');
    if (!btn) return;

    runBusy(btn, 'Đang gửi…', async function () {
      try {
        var res = await api.forgotPassword(email);
        syncForgotSent(res.member);
      } catch (e) {
        showForgotError((e && e.message) || 'Không gửi được email.');
      }
    });
  }

  function enterApp(withSkeleton) {
    var hashView = (location.hash || '').replace('#', '');
    state.view = ['overview', 'income', 'expenses'].indexOf(hashView) !== -1 ? hashView : 'overview';
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    state.loggedIn = true;
    if (withSkeleton) {
      state.loading = true;
      render();
      requestAnimationFrame(focusPage);
    } else {
      state.loading = false;
      render();
      requestAnimationFrame(focusPage);
    }
  }

  function resetState() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    state.user = null;
    state.profile = null;
    state.members = [];
    state.data = { incomes: [], expenses: [] };
    state.loading = true;
    state.loggedIn = false;
    state.busy = false;
    state.editingIncome = null;
    state.editingExpense = null;
    state.incomeMember = null;
    state.filter = 'all';
    state.refreshing = false;
    state.filters = {
      income: { person: 'all', preset: 'all', from: '', to: '' },
      expenses: { person: 'all', preset: 'all', from: '', to: '' }
    };
  }

  function applyData(data) {
    if (data.me) {
      state.user = data.me.id;
      state.profile = data.me;
    }
    state.members = data.members || [];
    state.data.incomes = data.incomes || [];
    state.data.expenses = data.expenses || [];
    state.loading = false;
    state.lastSync = Date.now();
  }

  var refreshPromise = null;

  function refreshData(silent) {
    if (!state.loggedIn) return Promise.resolve();
    if (refreshPromise) {
      return refreshPromise.then(function () { return refreshData(silent); });
    }
    state.refreshing = true;
    refreshPromise = api.load().then(function (data) {
      if (!state.loggedIn) return;
      applyData(data);
      render();
    }).catch(function (err) {
      if (err && err.code === 'auth') {
        stopSession();
        showAccessDenied('Phiên đăng nhập đã hết. Đăng nhập lại nhé.');
      } else if (!silent) {
        toast((err && err.message) || 'Không tải được dữ liệu.', true);
      }
    }).finally(function () {
      state.refreshing = false;
      refreshPromise = null;
    });
    return refreshPromise;
  }

  function stopSession() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    api.logout();
  }

  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(function () {
      if (document.visibilityState === 'visible' && state.loggedIn && !state.refreshing) refreshData(false);
    }, 20000);
  }

  async function startSession() {
    enterApp(true);
    try {
      var data = await api.load();
      applyData(data);
      render();
      startPolling();
    } catch (err) {
      if (err && err.code === 'auth') {
        stopSession();
        resetState();
        showLogin();
        return;
      }
      state.loading = false;
      showAccessDenied((err && err.message) || 'Không tải được dữ liệu từ Google Sheet.');
    }
  }
  function bindEvents() {
    $$('dialog.sheet').forEach(function (d) {
      d.addEventListener('click', function (ev) {
        if (state.busy) return;
        if (ev.target === d) d.close();
      });
      d.addEventListener('cancel', function (ev) {
        if (state.busy) ev.preventDefault();
      });
      d.addEventListener('close', function () {
        if (!$$('dialog.sheet[open]').length) document.body.classList.remove('sheet-open');
      });
    });

    var loginForm = $('#loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var email = $('#loginEmail').value.trim();
        var pass = $('#loginPass').value;
        var alertBox = $('#loginAlert');
        var btn = $('#loginBtn');
        alertBox.hidden = true;
        if (btn.disabled) return;
        if (!email || !pass) {
          alertBox.textContent = 'Vui lòng nhập email và mật khẩu.';
          alertBox.hidden = false;
          (email ? $('#loginPass') : $('#loginEmail')).focus();
          return;
        }
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span>Đang đăng nhập…';
        try {
          await api.login(email, pass);
          await startSession();
        } catch (err) {
          alertBox.textContent = (err && err.message) || 'Email hoặc mật khẩu không đúng.';
          alertBox.hidden = false;
          $('#loginPass').focus();
          $('#loginPass').select();
        } finally {
          btn.disabled = false;
          btn.innerHTML = 'Đăng nhập';
        }
      });
    }

    var forgotForm = $('#forgotForm');
    if (forgotForm) {
      forgotForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        sendForgotEmail();
      });
    }
    var forgotEmail = $('#forgotEmail');
    if (forgotEmail) {
      forgotEmail.addEventListener('input', function () {
        this.setAttribute('aria-invalid', 'false');
        var err = $('#forgotEmailErr');
        if (err) {
          err.textContent = '';
          err.hidden = true;
        }
      });
    }

    var incomeForm = $('#incomeForm');
    if (incomeForm) {
      incomeForm.addEventListener('submit', function (ev) { ev.preventDefault(); addIncome(); });
    }
    var expenseForm = $('#expenseForm');
    if (expenseForm) {
      expenseForm.addEventListener('submit', function (ev) { ev.preventDefault(); createExpense(); });
    }

    var incAmount = $('#incAmount');
    if (incAmount) {
      incAmount.addEventListener('input', function () {
        var digits = this.value.replace(/[^\d]/g, '');
        this.value = digits ? Number(digits).toLocaleString('de-DE') : '';
        this.setAttribute('aria-invalid', 'false');
        var f = this.closest('.amount-field');
        if (f) f.classList.remove('is-error');
        $('#incAmountErr').hidden = true;
      });
    }
    var expAmount = $('#expAmount');
    if (expAmount) {
      expAmount.addEventListener('input', function () {
        var digits = this.value.replace(/[^\d]/g, '');
        this.value = digits ? Number(digits).toLocaleString('de-DE') : '';
        this.setAttribute('aria-invalid', 'false');
        var f = this.closest('.amount-field');
        if (f) f.classList.remove('is-error');
        $('#expAmountErr').hidden = true;
      });
    }
    ['#expTitle', '#expReason'].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener('input', function () {
        this.setAttribute('aria-invalid', 'false');
        var err = $(sel + 'Err');
        if (err) err.hidden = true;
      });
    });

    ['#filterFrom', '#filterTo'].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener('change', onFilterDateChange);
    });
    var filterSheet = $('#filterSheet');
    if (filterSheet) {
      filterSheet.addEventListener('close', function () { state.filterDraft = null; });
    }

    document.addEventListener('click', function (ev) {
      if (state.busy) return;
      if (ev.target.closest('[data-close]')) {
        var d = ev.target.closest('dialog');
        if (d) d.close();
        return;
      }

      var trigger = ev.target.closest('[data-act]');
      if (!trigger) {
        var card = ev.target.closest('.req-card[data-open]');
        if (card && !ev.target.closest('button, a, input, textarea')) openDetail(card.getAttribute('data-open'));
        return;
      }

      var act = trigger.getAttribute('data-act');
      var id = trigger.getAttribute('data-id');

      switch (act) {
        case 'nav': go(trigger.getAttribute('data-view')); break;
        case 'open-income': openIncomeForm(); break;
        case 'open-expense': openExpenseForm(); break;
        case 'income-menu': openIncomeMenu(id); break;
        case 'edit-income':
          closeDialog($('#incomeMenu'));
          var editIncome = findIncome(id);
          if (editIncome) openIncomeForm(editIncome);
          break;
        case 'edit-expense':
          var editExpense = findExpense(id);
          if (editExpense) openExpenseForm(editExpense);
          break;
        case 'open-request': openDetail(id); break;
        case 'open-account': openAccount(); break;
        case 'pick-member':
          state.incomeMember = trigger.getAttribute('data-member');
          $$('#incMember .seg-btn').forEach(function (b) {
            b.setAttribute('aria-pressed', b === trigger ? 'true' : 'false');
          });
          break;
        case 'filter':
          state.filter = trigger.getAttribute('data-filter');
          render();
          break;
        case 'open-filter': openFilterSheet(); break;
        case 'filter-person':
          if (state.filterDraft) {
            state.filterDraft.person = trigger.getAttribute('data-person');
            syncFilterSheet();
          }
          break;
        case 'filter-preset':
          if (state.filterDraft) {
            var preset = trigger.getAttribute('data-preset');
            var range = presetRange(preset);
            state.filterDraft.preset = preset;
            state.filterDraft.from = range.from;
            state.filterDraft.to = range.to;
            syncFilterSheet();
          }
          break;
        case 'filter-reset': resetFilterDraft(); break;
        case 'filter-apply': applyFilterDraft(); break;
        case 'clear-filter': clearFilter(state.view, false); break;
        case 'clear-all-filters': clearFilter(state.view, true); break;
        case 'approve': approve(id, trigger); break;
        case 'reject': reject(id, trigger); break;
        case 'ask-buy': openPurchase(id); break;
        case 'confirm-buy': confirmBuy(id, trigger); break;
        case 'cancel': askCancel(id); break;
        case 'delete-req': askDeleteExpense(id); break;
        case 'delete-income': closeDialog($('#incomeMenu')); askDeleteIncome(id); break;
        case 'save-name':
          var nameInput = $('#accName');
          var roleInput = $('#accRole');
          if (nameInput) {
            var next = nameInput.value.trim();
            if (!next) { nameInput.focus(); break; }
            runBusy(trigger, 'Đang lưu…', async function () {
              try {
                var role = roleInput ? roleInput.value.trim() : '';
                await api.saveMember({ name: next, role: role });
                state.profile.name = next;
                state.profile.role = role;
                var mine = findMember(state.user);
                if (mine) { mine.name = next; mine.role = role; }
                closeDialog($('#accountSheet'));
                render();
                toast('Đã lưu thông tin');
              } catch (err) {
                fail(err);
              }
            });
          }
          break;
        case 'logout':
          closeDialog($('#accountSheet'));
          stopSession();
          resetState();
          showLogin();
          toast('Đã đăng xuất');
          break;
        case 'forgot': openForgotSheet(); break;
        default: break;
      }
    });

    var confirmSheet = $('#confirmSheet');
    if (confirmSheet) {
      confirmSheet.addEventListener('close', function () { confirmAction = null; });
    }

    var confirmBtn = $('#confirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async function () {
        if (state.busy) return;
        var fn = confirmAction;
        if (!fn) return;
        confirmAction = null;
        var done = setBusy(confirmBtn, confirmBusyLabel);
        try {
          await fn();
        } finally {
          done();
        }
      });
    }
  }

  function init() {
    bindEvents();

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && state.loggedIn) refreshData(false);
    });

    if (!api.isConfigured()) {
      showLogin();
      var alertBox = $('#loginAlert');
      if (alertBox) {
        alertBox.textContent = 'Chưa dán URL Apps Script. Mở assets/api.js và thay PASTE_APPS_SCRIPT_EXEC_URL bằng URL /exec sau khi deploy.';
        alertBox.hidden = false;
      }
      var btn = $('#loginBtn');
      if (btn) btn.disabled = true;
      return;
    }

    showLogin();
    if (api.hasToken()) startSession();
  }

  if (document.getElementById('appView')) init();
})();
