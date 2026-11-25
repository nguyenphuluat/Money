/* Sổ Chi Tiêu Gia Đình — giao diện OpenDesign, dữ liệu Google Sheet qua Apps Script */
import * as api from './api.js?v=20261127a';

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

  var EXPENSE_CATEGORIES = [
    { id: 'home', label: 'Nhà ở', group: 'spend', color: 'var(--chart-1)' },
    { id: 'utilities', label: 'Hóa đơn & tiện ích', group: 'spend', color: 'var(--chart-9)' },
    { id: 'food', label: 'Ăn uống', group: 'spend', color: 'var(--chart-2)' },
    { id: 'transport', label: 'Đi lại', group: 'spend', color: 'var(--chart-3)' },
    { id: 'shopping', label: 'Mua sắm', group: 'spend', color: 'var(--chart-8)' },
    { id: 'pets', label: 'Thú cưng', group: 'spend', color: 'var(--chart-7)' },
    { id: 'health', label: 'Sức khỏe', group: 'spend', color: 'var(--chart-5)' },
    { id: 'education', label: 'Giáo dục', group: 'spend', color: 'var(--chart-4)' },
    { id: 'gifts', label: 'Quà tặng & hiếu hỉ', group: 'spend', color: 'var(--chart-10)' },
    { id: 'entertainment', label: 'Giải trí', group: 'spend', color: 'var(--chart-11)' },
    { id: 'travel', label: 'Du lịch', group: 'spend', color: 'var(--chart-12)' },
    { id: 'other', label: 'Khác', group: 'spend', color: 'var(--chart-6)' },
    { id: 'lend', label: 'Cho vay', group: 'debt', color: 'var(--chart-10)', auto: true },
    { id: 'repay', label: 'Trả nợ', group: 'debt', color: 'var(--chart-12)', auto: true },
    { id: 'loan_interest', label: 'Lãi đi vay', group: 'debt', color: 'var(--chart-5)', auto: true }
  ];

  var INCOME_CATEGORIES = [
    { id: 'salary', label: 'Lương', group: 'income', color: 'var(--chart-1)' },
    { id: 'bonus', label: 'Thưởng', group: 'income', color: 'var(--chart-2)' },
    { id: 'business', label: 'Kinh doanh / làm thêm', group: 'income', color: 'var(--chart-3)' },
    { id: 'interest', label: 'Lãi, đầu tư & cho thuê', group: 'income', color: 'var(--chart-4)' },
    { id: 'gift', label: 'Được tặng / biếu', group: 'income', color: 'var(--chart-5)' },
    { id: 'other_income', label: 'Thu nhập khác', group: 'income', color: 'var(--chart-6)' },
    { id: 'refund', label: 'Hoàn tiền', group: 'other', color: 'var(--chart-7)' },
    { id: 'collect', label: 'Thu nợ', group: 'other', color: 'var(--chart-8)', auto: true },
    { id: 'borrow', label: 'Đi vay', group: 'other', color: 'var(--chart-9)', auto: true },
    { id: 'loan_interest', label: 'Lãi cho vay', group: 'income', color: 'var(--chart-4)', auto: true }
  ];

  var CATEGORY_GROUP_LABELS = {
    spend: 'Chi tiêu',
    debt: 'Nợ & tài sản',
    income: 'Thu nhập',
    other: 'Tiền vào khác'
  };

  function categoryList(kind) {
    return kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  }

  function manualCategoryList(kind) {
    return categoryList(kind).filter(function (c) { return !c.auto; });
  }

  function categoryMeta(id, kind) {
    var list = categoryList(kind);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    var fallback = kind === 'income' ? 'other_income' : 'other';
    for (var j = 0; j < list.length; j++) {
      if (list[j].id === fallback) return list[j];
    }
    return list[list.length - 1];
  }

  function categoryGroup(id, kind) {
    return categoryMeta(id, kind).group;
  }

  function categoryLabel(id, kind) {
    return categoryMeta(id, kind).label;
  }

  function isAutoCategory(id, kind) {
    return categoryMeta(id, kind).auto === true;
  }

  function isConsumptionExpense(e) {
    return categoryGroup(e.category || 'other', 'expenses') === 'spend';
  }

  function isDebtExpense(e) {
    return categoryGroup(e.category || 'other', 'expenses') === 'debt';
  }

  function isRealIncome(i) {
    return categoryGroup(i.category || 'other_income', 'income') === 'income';
  }

  function isOtherIncome(i) {
    return categoryGroup(i.category || 'other_income', 'income') === 'other';
  }

  function normText(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase();
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
    cart: '<path d="M5 8h14l-1.1 12H6.1L5 8Z"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8"/>',
    trash: '<path d="M4 7h16"/><path d="M9.2 7V4.4h5.6V7"/><path d="M6.4 7l.8 13h9.6l.8-13"/><path d="M10 11v5M14 11v5"/>',
    pencil: '<path d="M4 20h4L19.2 8.8a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.6 6.4 4 4"/>',
    more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    alert: '<path d="M12 4 3.2 20h17.6L12 4Z"/><path d="M12 10.2v4"/><path d="M12 17.3v.1"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5.2 20c.8-3.5 3.5-5.4 6.8-5.4s6 1.9 6.8 5.4"/>',
    logout: '<path d="M14 5H6.5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1H14"/><path d="M17 8.4 20.6 12 17 15.6"/><path d="M10.2 12h10.2"/>',
    info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5"/><path d="M12 8.1v.1"/>',
    coin: '<ellipse cx="12" cy="7.5" rx="6.5" ry="3"/><path d="M5.5 7.5v4c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3v-4"/><path d="M5.5 11.5v4c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3v-4"/>',
    arrowRight: '<path d="M9 6l6 6-6 6"/>',
    arrowLeft: '<path d="M15 6l-6 6 6 6"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="m15.6 15.6 4.4 4.4"/>',
    bolt: '<path d="M13 2.5 4.5 14H11l-1 7.5L19.5 10H13z"/>',
    loan: '<path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h13.5v15H6A2.5 2.5 0 0 1 3.5 17z"/><path d="M20 10h-5.5a2 2 0 0 0 0 4H20"/>',
    report: '<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>',
    download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/>',
    eye: '<path d="M2.8 12S6.4 5.6 12 5.6 21.2 12 21.2 12 17.6 18.4 12 18.4 2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="3.1"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2"/><path d="M9.9 6.5A10 10 0 0 1 12 6.2c5.6 0 9.2 5.8 9.2 5.8a17.5 17.5 0 0 1-3.4 4.1"/><path d="M6.6 6.6C3.9 8.4 2.8 12 2.8 12s3.6 6.4 9.2 6.4c1.8 0 3.2-.4 4.4-1.1"/>'
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
    data: { incomes: [], expenses: [], loans: [], loanPayments: [], budgets: [] },
    view: 'overview',
    filter: 'all',
    filters: {
      income: { person: 'all', preset: 'all', from: '', to: '', category: 'all', q: '' },
      expenses: { person: 'all', preset: 'all', from: '', to: '', category: 'all', q: '' }
    },
    filterDraft: null,
    loading: true,
    loggedIn: false,
    busy: false,
    editingIncome: null,
    editingExpense: null,
    incomeMember: null,
    editingLoan: null,
    payingLoan: null,
    interestLoan: null,
    interestEntry: null,
    interestMode: 'pay',
    loanType: 'lend',
    loanTerm: 'open',
    loanFilter: 'all',
    reportMonth: monthKey(new Date().toISOString()),
    searchTimer: null,
    balanceVisible: false,
    balanceTimer: null,
    pollTimer: null,
    refreshing: false,
    lastSync: 0,
    version: null,
    checking: false
  };

  var BALANCE_REVEAL_MS = 20000;

  function maskedMoney() {
    return '<span class="money-mask" aria-hidden="true">••••••</span>' +
      '<span class="sr-only">Đang ẩn</span>';
  }

  function balanceValueHtml(value, format) {
    if (!state.balanceVisible) return maskedMoney();
    return format === 'signed' ? signedMoney(value) : money(value);
  }

  function balanceEyeButton(modifier) {
    var label = state.balanceVisible ? 'Ẩn số dư' : 'Hiện số dư';
    var cls = 'balance-eye' + (modifier ? ' ' + modifier : '');
    return '<button class="' + cls + '" type="button" data-act="toggle-balance" ' +
      'aria-pressed="' + (state.balanceVisible ? 'true' : 'false') + '" ' +
      'aria-label="' + label + '" title="' + label + '">' +
      icon(state.balanceVisible ? 'eyeOff' : 'eye', modifier ? 16 : 18) + '</button>';
  }

  function paintBalanceDom() {
    $$('[data-balance-amount]').forEach(function (el) {
      var value = Number(el.getAttribute('data-value') || 0);
      var format = el.getAttribute('data-format') || 'plain';
      el.innerHTML = balanceValueHtml(value, format);
      el.classList.toggle('is-masked', !state.balanceVisible);
    });

    $$('[data-balance-warning]').forEach(function (el) {
      el.hidden = !state.balanceVisible;
    });

    $$('[data-act="toggle-balance"]').forEach(function (btn) {
      var label = state.balanceVisible ? 'Ẩn số dư' : 'Hiện số dư';
      btn.setAttribute('aria-pressed', state.balanceVisible ? 'true' : 'false');
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.innerHTML = icon(
        state.balanceVisible ? 'eyeOff' : 'eye',
        btn.classList.contains('balance-eye--stat') ? 16 : 18
      );
    });
  }

  function setBalanceVisible(visible) {
    state.balanceVisible = !!visible;
    if (state.balanceTimer) {
      clearTimeout(state.balanceTimer);
      state.balanceTimer = null;
    }
    if (state.balanceVisible) {
      state.balanceTimer = setTimeout(function () {
        state.balanceTimer = null;
        state.balanceVisible = false;
        paintBalanceDom();
      }, BALANCE_REVEAL_MS);
    }
    paintBalanceDom();
  }

  function toggleBalance() {
    setBalanceVisible(!state.balanceVisible);
  }

  function compute() {
    var data = state.data;
    var purchased = data.expenses.filter(function (e) { return e.status === 'purchased'; });
    var spend = purchased.filter(isConsumptionExpense);
    var debt = purchased.filter(isDebtExpense);
    var totalIn = data.incomes.reduce(function (s, i) { return s + i.amount; }, 0);
    var totalOut = purchased.reduce(function (s, e) { return s + e.amount; }, 0);
    var pending = data.expenses.filter(function (e) { return e.status === 'pending'; }).reduce(function (s, e) { return s + e.amount; }, 0);
    var approved = data.expenses.filter(function (e) { return e.status === 'approved'; }).reduce(function (s, e) { return s + e.amount; }, 0);
    var now = new Date();
    var sameMonth = function (value) {
      var d = toDate(value);
      return !!d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    var monthIncome = data.incomes.filter(function (i) { return sameMonth(i.date); });
    var monthExpenses = purchased.filter(function (e) { return sameMonth(e.purchasedAt); });
    var monthIn = monthIncome.filter(isRealIncome).reduce(function (s, i) { return s + i.amount; }, 0);
    var monthOtherIn = monthIncome.filter(isOtherIncome).reduce(function (s, i) { return s + i.amount; }, 0);
    var monthOut = monthExpenses.filter(isConsumptionExpense).reduce(function (s, e) { return s + e.amount; }, 0);
    var monthDebt = monthExpenses.filter(isDebtExpense).reduce(function (s, e) { return s + e.amount; }, 0);
    var me = state.user;
    var urgentNeedAck = purchased.filter(function (e) {
      return e.urgent && !e.urgentAck && e.urgentBy && e.urgentBy !== me;
    }).length;
    var urgentDisputed = purchased.filter(function (e) {
      return e.urgent && e.urgentAck === 'no' && e.urgentBy === me;
    }).length;
    return {
      totalIn: totalIn, totalOut: totalOut, balance: totalIn - totalOut,
      pending: pending, approved: approved,
      monthIn: monthIn, monthOtherIn: monthOtherIn, monthOut: monthOut, monthDebt: monthDebt,
      monthInCount: monthIncome.filter(isRealIncome).length,
      monthOutCount: monthExpenses.filter(isConsumptionExpense).length,
      monthDebtCount: monthExpenses.filter(isDebtExpense).length,
      urgentNeedAck: urgentNeedAck, urgentDisputed: urgentDisputed
    };
  }

  function todoList() {
    var me = state.user;
    return state.data.expenses.filter(function (e) {
      if (e.status === 'pending') return e.requester !== me && e.agreed[me] !== true;
      if (e.status === 'approved') return true;
      if (e.status === 'purchased' && e.urgent && !e.urgentAck && e.urgentBy && e.urgentBy !== me) return true;
      return false;
    }).sort(function (a, b) { return atTime(b.created) - atTime(a.created); });
  }
  var toastTimer = null;
  var toastHideTimer = null;
  function toast(message, isError) {
    var el = $('#toast');
    if (!el) return;
    clearTimeout(toastTimer);
    clearTimeout(toastHideTimer);
    el.innerHTML = icon(isError ? 'alert' : 'check', 16) + '<span>' + esc(message) + '</span>';
    el.classList.toggle('is-error', Boolean(isError));
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
      toastHideTimer = setTimeout(function () { el.hidden = true; }, 220);
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
      { id: 'expenses', label: 'Chi tiêu', icon: 'expenses', badge: todoList().length },
      { id: 'loans', label: 'Vay nợ', icon: 'loan', badge: loanDueCount() },
      { id: 'report', label: 'Báo cáo', icon: 'report' }
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

  function urgentPill(e) {
    if (!e.urgent) return '';
    return '<span class="pill pill--urgent">' + icon('bolt', 12) + 'Chi gấp</span>';
  }

  function urgentStateText(e) {
    if (!e.urgent) return '';
    var acker = e.urgentBy ? otherOf(e.urgentBy) : null;
    var isBuyer = e.urgentBy === state.user;
    var who = acker ? nameOf(acker) : 'người còn lại';
    if (!e.urgentAck) return isBuyer ? 'Chờ ' + who + ' xác nhận' : 'Bạn cần xác nhận khoản gấp';
    if (e.urgentAck === 'ok') return isBuyer ? who + ' đã xác nhận' : 'Bạn đã xác nhận khoản gấp';
    return isBuyer ? who + ' phản đối' : 'Bạn đã phản đối khoản gấp';
  }

  function actionButtons(e) {
    var me = state.user;
    var out = [];
    var delBtn = '<button class="btn-icon btn-icon--danger" type="button" data-act="delete-req" data-id="' + e.id + '" aria-label="Xoá yêu cầu ' + esc(e.title) + '">' + icon('trash', 20) + '</button>';
    var canEdit = e.requester === me && ['pending', 'approved', 'purchased'].indexOf(e.status) !== -1 && !e.loanId;
    var editBtn = canEdit ? '<button class="btn btn--ghost btn--sm" type="button" data-act="edit-expense" data-id="' + e.id + '" aria-label="Sửa yêu cầu ' + esc(e.title) + '">Sửa</button>' : '';
    var urgentBtn = '<button class="btn btn--urgent btn--sm" type="button" data-act="urgent" data-id="' + e.id + '" aria-label="Chi gấp ' + esc(e.title) + '">' + icon('bolt', 15) + 'Chi gấp</button>';

    if (e.loanId) {
      out.push('<span class="req-stamp">Khoản tự sinh từ sổ vay</span>');
      out.push('<button class="btn btn--ghost btn--sm" type="button" data-act="open-loan" data-id="' + e.loanId + '">Mở sổ vay</button>');
      return out.join('');
    }

    if (e.status === 'pending') {
      if (e.requester !== me && e.agreed[me] !== true) {
        out.push('<button class="btn btn--accept" type="button" data-act="approve" data-id="' + e.id + '">Đồng ý</button>');
        out.push('<button class="btn btn--reject" type="button" data-act="reject" data-id="' + e.id + '">Từ chối</button>');
        out.push(urgentBtn);
      } else if (e.requester === me) {
        var waitingId = otherOf(me);
        var waitingName = waitingId ? nameOf(waitingId) : 'người còn lại';
        var joined = state.members.length >= 2;
        out.push('<span class="req-stamp">Bạn đã đồng ý · ' + (joined ? 'chờ ' + esc(waitingName) : 'chờ ' + esc(waitingName) + ' tham gia') + '</span>');
        out.push(urgentBtn);
        out.push(editBtn);
        out.push('<button class="btn btn--ghost btn--sm" type="button" data-act="cancel" data-id="' + e.id + '">Huỷ</button>');
      }
    } else if (e.status === 'approved') {
      out.push('<button class="btn btn--buy" type="button" data-act="ask-buy" data-id="' + e.id + '">Đã mua</button>');
      if (canEdit) out.push(editBtn);
      out.push('<button class="btn btn--ghost btn--sm" type="button" data-act="cancel" data-id="' + e.id + '">Huỷ</button>');
    } else if (e.status === 'purchased') {
      if (e.urgent) {
        if (e.urgentBy !== me) {
          if (!e.urgentAck) {
            out.push('<button class="btn btn--accept" type="button" data-act="urgent-ack-yes" data-id="' + e.id + '">Xác nhận</button>');
            out.push('<button class="btn btn--reject" type="button" data-act="urgent-ack-no" data-id="' + e.id + '">Có vấn đề</button>');
          } else if (e.urgentAck === 'ok') {
            out.push('<button class="btn btn--ghost btn--sm" type="button" data-act="urgent-ack-no" data-id="' + e.id + '">Phản đối</button>');
          } else {
            out.push('<button class="btn btn--ghost btn--sm" type="button" data-act="urgent-ack-yes" data-id="' + e.id + '">Xác nhận lại</button>');
          }
        }
      } else {
        out.push('<span class="req-stamp">Đã mua ' + fmtDate(e.purchasedAt) + '</span>');
      }
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
    var meta = categoryMeta(e.category || 'other', 'expenses');
    var html = '<article class="req-card' + (closed ? ' is-closed' : '') + (e.urgent ? ' is-urgent' : '') + '" data-open="' + e.id + '">';
    html += '<div class="req-head"><div class="req-title-wrap">' +
      '<button class="req-title req-open" type="button" data-act="open-request" data-id="' + e.id + '">' + esc(e.title) + '</button>' +
      pill(e.status) + urgentPill(e) + '</div>' +
      '<span class="req-amount">' + money(e.amount) + '</span></div>';
    html += '<p class="req-reason od-clamp-2">' + esc(e.reason) + '</p>';
    html += '<div class="req-meta"><span>' + esc(nameOf(e.requester)) + ' gửi · ' + relTime(e.created) + '</span>' +
      '<span class="req-cat"><span class="cat-dot" style="background:' + meta.color + '" aria-hidden="true"></span>' + esc(meta.label) + '</span></div>';

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
    } else if (e.status === 'purchased' && e.urgent) {
      html += '<p class="req-note is-urgent">' + icon('bolt', 14) + esc(urgentStateText(e)) +
        (e.urgentAckNote ? ' · ' + esc(e.urgentAckNote) : '') + '</p>';
    }
    if (e.status === 'rejected' && e.rejectNote) {
      html += '<p class="req-note is-bad">' + icon('x', 14) + 'Lý do: ' + esc(e.rejectNote) + '</p>';
    }
    if (e.status === 'cancelled' && e.cancelReason) {
      html += '<p class="req-note">' + icon('slash', 14) + 'Lý do huỷ: ' + esc(e.cancelReason) + '</p>';
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
      if (e.status === 'purchased' && e.urgent) {
        items.push({
          at: e.urgentAt || e.purchasedAt, tone: 'expense',
          text: '<b>' + esc(nameOf(e.urgentBy)) + '</b> đã chi gấp “' + esc(e.title) + '”',
          amount: e.amount
        });
        if (e.urgentAck) {
          items.push({
            at: e.urgentAckAt, tone: '',
            text: '<b>' + esc(nameOf(otherOf(e.urgentBy))) + '</b> ' +
              (e.urgentAck === 'ok' ? 'đã xác nhận' : 'phản đối') + ' khoản chi gấp “' + esc(e.title) + '”' +
              (e.urgentAckNote ? ': ' + esc(e.urgentAckNote) : ''),
            amount: null
          });
        }
      } else if (e.loanId) {
        if (e.status === 'purchased') {
          items.push({ at: e.purchasedAt, tone: 'expense', text: 'Đã ghi nhận khoản vay “' + esc(e.title) + '”', amount: e.amount });
        }
      } else {
        if (e.status === 'approved' || e.status === 'purchased') {
          items.push({ at: e.approvedAt || e.purchasedAt, tone: '', text: 'Hai người đã duyệt “' + esc(e.title) + '”', amount: null });
        }
        if (e.status === 'purchased') {
          items.push({ at: e.purchasedAt, tone: 'expense', text: 'Đã ghi nhận chi tiêu “' + esc(e.title) + '”', amount: e.amount });
        }
      }
      if (e.status === 'rejected') {
        items.push({
          at: e.rejectedAt, tone: '',
          text: '<b>' + esc(nameOf(e.rejectedBy)) + '</b> từ chối “' + esc(e.title) + '”' +
            (e.rejectNote ? ': ' + esc(e.rejectNote) : ''),
          amount: e.amount
        });
      }
      if (e.status === 'cancelled') {
        items.push({
          at: e.cancelledAt, tone: '',
          text: '<b>' + esc(nameOf(e.cancelledBy || e.requester)) + '</b> đã huỷ “' + esc(e.title) + '”' +
            (e.cancelReason ? ': ' + esc(e.cancelReason) : ''),
          amount: null
        });
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
      return i.member === member && isRealIncome(i) &&
        d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
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
      if (!isConsumptionExpense(e)) return;
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

  function urgentBannerHtml() {
    var me = state.user;
    var need = state.data.expenses.filter(function (e) {
      return e.status === 'purchased' && e.urgent && !e.urgentAck && e.urgentBy && e.urgentBy !== me;
    });
    var disputed = state.data.expenses.filter(function (e) {
      return e.status === 'purchased' && e.urgent && e.urgentAck === 'no' && e.urgentBy === me;
    });
    var out = '';
    if (need.length) {
      var first = need[0];
      out += '<div class="banner banner--urgent"><span class="banner-icon">' + icon('bolt', 17) + '</span>' +
        '<div class="banner-copy"><p class="banner-title">' + esc(nameOf(first.urgentBy)) + ' vừa chi gấp ' + money(first.amount) + '</p>' +
        '<p class="banner-text">' + esc(first.title) +
        (need.length > 1 ? ' · và ' + (need.length - 1) + ' khoản khác' : '') +
        ' · chờ bạn xác nhận.</p></div>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="view-urgent">Xem</button></div>';
    }
    if (disputed.length) {
      var second = disputed[0];
      out += '<div class="banner banner--danger"><span class="banner-icon">' + icon('alert', 17) + '</span>' +
        '<div class="banner-copy"><p class="banner-title">' + esc(nameOf(otherOf(second.urgentBy))) + ' phản đối khoản chi gấp</p>' +
        '<p class="banner-text">' + esc(second.title) + ' · ' + money(second.amount) +
        (second.urgentAckNote ? ' · ' + esc(second.urgentAckNote) : '') +
        (disputed.length > 1 ? ' · và ' + (disputed.length - 1) + ' khoản khác' : '') + '</p></div>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="view-urgent">Xem</button></div>';
    }
    return out;
  }

  function loanOverviewCard() {
    var totals = loanTotals();
    if (!totals.count) return '';
    var due = totals.overdue ? totals.overdue + ' quá hạn' : (totals.soon ? totals.soon + ' sắp đến hạn' : '');
    return '<div class="section"><div class="section-head"><div class="section-title-row">' +
      '<h2 class="section-title">Vay &amp; nợ</h2>' +
      (due ? '<span class="pill pill--urgent">' + icon('clock', 12) + due + '</span>' : '') +
      '</div><button class="section-link" type="button" data-act="nav" data-view="loans">Mở sổ vay</button></div>' +
      '<div class="card card-pad loan-summary-card">' +
      '<div class="loan-summary-row"><span>Cho vay còn thu</span><b>' + money(totals.receivable) + '</b></div>' +
      '<div class="loan-summary-row"><span>Đi vay còn trả</span><b>' + money(totals.payable) + '</b></div>' +
      '</div></div>';
  }

  function budgetOverviewCard() {
    var budgets = state.data.budgets.filter(function (b) { return b.amount > 0; });
    if (!budgets.length) return '';
    var spent = {};
    state.data.expenses.forEach(function (e) {
      if (e.status !== 'purchased' || !isConsumptionExpense(e) || !inThisMonth(e.purchasedAt)) return;
      spent[e.category] = (spent[e.category] || 0) + e.amount;
    });
    var rows = budgets.map(function (b) {
      var used = spent[b.category] || 0;
      return { category: b.category, limit: b.amount, used: used, ratio: b.amount ? used / b.amount : 0 };
    }).sort(function (a, b) { return b.ratio - a.ratio; }).slice(0, 3);
    var html = '<div class="section"><div class="section-head"><h2 class="section-title">Ngân sách tháng này</h2>' +
      '<button class="section-link" type="button" data-act="nav" data-view="report">Xem báo cáo</button></div>' +
      '<div class="card card-pad budget-mini">';
    rows.forEach(function (r) {
      var meta = categoryMeta(r.category, 'expenses');
      var pct = Math.round(r.ratio * 100);
      var cls = pct >= 100 ? ' is-over' : (pct >= 80 ? ' is-warn' : '');
      html += '<div class="budget-mini-row"><div class="budget-mini-head"><span class="budget-mini-name">' +
        '<span class="cat-dot" style="background:' + meta.color + '"></span>' + esc(meta.label) + '</span>' +
        '<span class="budget-mini-value' + cls + '">' + money(r.used) + ' / ' + money(r.limit) + '</span></div>' +
        '<div class="budget-bar"><span class="budget-fill' + cls + '" style="width:' + Math.min(100, pct) + '%"></span></div></div>';
    });
    html += '</div></div>';
    return html;
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

    html += urgentBannerHtml();

    html += '<div class="stat-row" style="margin-top:16px">';
    html += '<section class="balance-card' + (isNeg ? ' is-negative' : '') + '" aria-labelledby="balLabel">' +
      '<div class="balance-head"><span class="balance-label" id="balLabel">Số dư hiện tại</span>' +
      '<div class="balance-tools">' +
      (isNeg ? '<span class="pill pill--loan">' + icon('alert', 13) + 'Chi vượt thu</span>' : '') +
      balanceEyeButton() +
      '</div></div>' +
      '<span class="balance-amount' + (state.balanceVisible ? '' : ' is-masked') + '" data-balance-amount data-value="' + c.balance + '" data-format="signed">' +
      balanceValueHtml(c.balance, 'signed') + '</span>' +
      (isNeg ? '<p class="balance-warn" data-balance-warning' + (state.balanceVisible ? '' : ' hidden') + '>' +
        icon('alert', 15) + 'Chi vượt thu <span data-balance-amount data-value="' + c.balance + '" data-format="plain">' +
        balanceValueHtml(c.balance, 'plain') + '</span></p>' : '') +
      (c.pending + c.approved
        ? '<div class="balance-split">' +
          '<div><span class="split-label">Chờ duyệt</span><span class="split-value">' + money(c.pending) + '</span></div>' +
          '<div><span class="split-label">Đã duyệt, chưa mua</span><span class="split-value">' + money(c.approved) + '</span></div>' +
          '</div><p class="balance-foot">Tổng chưa trừ vào số dư: ' + money(c.pending + c.approved) + '</p>'
        : '<p class="balance-foot">Không có khoản nào đang chờ duyệt.</p>') +
      '</section>';

    html += '<article class="stat-card"><span class="stat-label">Thu tháng này</span>' +
      '<span class="stat-value is-income">' + money(c.monthIn) + '</span>' +
      '<span class="stat-sub">' + c.monthInCount + ' khoản' +
      (c.monthOtherIn ? ' · vào khác ' + money(c.monthOtherIn) : '') + '</span></article>';
    html += '<article class="stat-card"><span class="stat-label">Chi tháng này</span>' +
      '<span class="stat-value is-expense">' + money(c.monthOut) + '</span>' +
      '<span class="stat-sub">' + c.monthOutCount + ' khoản đã mua' +
      (c.monthDebt ? ' · nợ ' + money(c.monthDebt) : '') + '</span></article>';
    html += '</div>';

    html += loanOverviewCard();
    html += budgetOverviewCard();

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

  function passesFilter(item, filter, dateField, personField, kind) {
    if (filter.person !== 'all' && item[personField] !== filter.person) return false;
    if (filter.category && filter.category !== 'all') {
      var cat = item.category || (kind === 'income' ? 'other_income' : 'other');
      if (cat !== filter.category) return false;
    }
    if (filter.q) {
      var hay = [
        item.title, item.reason, item.note, item.rejectNote, item.cancelReason,
        item.urgentAckNote, nameOf(item[personField]),
        categoryLabel(item.category || (kind === 'income' ? 'other_income' : 'other'), kind)
      ].join(' ');
      if (normText(hay).indexOf(normText(filter.q)) === -1) return false;
    }
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
    return filter.person !== 'all' || filter.preset !== 'all' || !!filter.from || !!filter.to ||
      filter.category !== 'all' || !!filter.q;
  }

  function filterLabel(kind) { return kind === 'income' ? 'Người kiếm' : 'Người gửi'; }

  function filterCategoryLabel(kind, id) {
    return id === 'all' ? 'Tất cả' : categoryLabel(id, kind);
  }

  function searchBar(kind) {
    var q = state.filters[kind].q || '';
    return '<div class="search-field">' +
      '<span class="search-icon" aria-hidden="true">' + icon('search', 18) + '</span>' +
      '<input class="input search-input" id="searchInput" type="search" value="' + esc(q) + '" ' +
      'placeholder="' + (kind === 'income' ? 'Tìm khoản thu, ghi chú…' : 'Tìm món, lý do, người gửi…') + '" ' +
      'autocomplete="off" aria-label="Tìm kiếm">' +
      (q ? '<button class="search-clear" type="button" data-act="clear-search" aria-label="Xoá tìm kiếm">' + icon('x', 15) + '</button>' : '') +
      '</div>';
  }

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
    var cat = filterCategoryLabel(kind, filter.category);
    return '<div class="filter-bar" role="group" aria-label="Bộ lọc">' +
      '<button class="filter-trigger' + (filter.person !== 'all' ? ' is-active' : '') + '" type="button" data-act="open-filter" aria-haspopup="dialog" aria-label="' + filterLabel(kind) + ': ' + esc(person) + '">' +
        '<span class="filter-trigger-label">' + filterLabel(kind) + '</span>' +
        '<span class="filter-trigger-value" title="' + esc(person) + '">' + esc(person) + '</span></button>' +
      '<button class="filter-trigger' + (filter.preset !== 'all' || filter.from || filter.to ? ' is-active' : '') + '" type="button" data-act="open-filter" aria-haspopup="dialog" aria-label="Thời gian: ' + esc(time) + '">' +
        '<span class="filter-trigger-label">Thời gian</span>' +
        '<span class="filter-trigger-value" title="' + esc(time) + '">' + esc(time) + '</span></button>' +
      '<button class="filter-trigger' + (filter.category !== 'all' ? ' is-active' : '') + '" type="button" data-act="open-filter" aria-haspopup="dialog" aria-label="Nhóm: ' + esc(cat) + '">' +
        '<span class="filter-trigger-label">Nhóm</span>' +
        '<span class="filter-trigger-value" title="' + esc(cat) + '">' + esc(cat) + '</span></button>' +
      (active ? '<button class="filter-clear" type="button" data-act="clear-filter" aria-label="Xoá bộ lọc">Xoá</button>' : '') +
      '</div>';
  }

  function clearFilter(kind, includeStatus) {
    if (kind !== 'income' && kind !== 'expenses') return;
    state.filters[kind] = { person: 'all', preset: 'all', from: '', to: '', category: 'all', q: '' };
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
    if (sub) sub.textContent = isIncome
      ? 'Theo người kiếm, ngày nhận và nhóm thu.'
      : 'Theo người gửi, ngày tạo và nhóm chi.';
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
    renderFilterCategories();
  }

  function renderFilterCategories() {
    var wrap = $('#filterCategories');
    var draft = state.filterDraft;
    if (!wrap || !draft) return;
    var kind = draft.target;
    var groups = kind === 'income' ? ['income', 'other'] : ['spend', 'debt'];
    var html = '<div class="cat-chips"><button class="seg-btn is-mini cat-chip" type="button" data-act="filter-category" data-category="all" aria-pressed="' +
      (draft.category === 'all' ? 'true' : 'false') + '">Tất cả</button></div>';

    groups.forEach(function (group) {
      var cats = categoryList(kind).filter(function (c) { return c.group === group; });
      if (!cats.length) return;
      html += '<p class="filter-group-label">' + esc(CATEGORY_GROUP_LABELS[group] || group) + '</p>' +
        '<div class="cat-chips">' + cats.map(function (c) {
          return '<button class="seg-btn is-mini cat-chip" type="button" data-act="filter-category" data-category="' + esc(c.id) + '" aria-pressed="' +
            (draft.category === c.id ? 'true' : 'false') + '">' +
            '<span class="cat-dot" style="background:' + c.color + '" aria-hidden="true"></span>' + esc(c.label) + '</button>';
        }).join('') + '</div>';
    });

    wrap.innerHTML = html;
  }

  function openFilterSheet() {
    if (state.view !== 'income' && state.view !== 'expenses') return;
    var filter = state.filters[state.view];
    state.filterDraft = {
      target: state.view, person: filter.person, preset: filter.preset,
      from: filter.from, to: filter.to, category: filter.category, q: filter.q
    };
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
    state.filterDraft.category = 'all';
    state.filterDraft.q = '';
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
    state.filters[draft.target] = {
      person: draft.person, preset: preset, from: from, to: to,
      category: draft.category || 'all', q: draft.q || ''
    };
    state.filterDraft = null;
    closeDialog($('#filterSheet'));
    render();
  }

  function renderIncome() {
    var all = state.data.incomes.slice().sort(function (a, b) { return atTime(b.date) - atTime(a.date); });
    var incomes = all.filter(function (i) { return passesFilter(i, state.filters.income, 'date', 'member', 'income'); });
    var total = incomes.reduce(function (s, i) { return s + i.amount; }, 0);
    var html = pageHead('Thu nhập', incomes.length + ' khoản · tổng tiền vào ' + money(total),
      '<button class="btn btn--primary" type="button" data-act="open-income">' + icon('plus', 18) + 'Thêm thu nhập</button>');

    html += searchBar('income');
    html += filterBar('income');

    if (!incomes.length) {
      if (all.length) {
        return html + emptyState({
          icon: 'income',
          title: 'Không có khoản thu phù hợp',
          text: 'Thử đổi người, thời gian, nhóm hoặc từ khoá tìm kiếm.',
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
        var meta = categoryMeta(i.category || 'other_income', 'income');
        html += '<div class="income-row">' +
          '<div class="income-who">' + avatar(i.member, 'avatar--sm') + '<span class="income-name">' + esc(nameOf(i.member)) + '</span></div>' +
          '<div class="income-info"><span class="income-note">' + esc(i.note || 'Không ghi chú') + '</span>' +
          '<span class="income-cat"><span class="cat-dot" style="background:' + meta.color + '" aria-hidden="true"></span>' + esc(meta.label) +
          (i.loanId ? ' · <b>Khoản vay</b>' : '') + '</span></div>' +
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
    { id: 'urgent', label: 'Chi gấp' },
    { id: 'other', label: 'Khác' }
  ];

  function filterCount(id, source) {
    source = source || state.data.expenses;
    return source.filter(function (e) {
      if (id === 'all') return true;
      if (id === 'other') return e.status === 'rejected' || e.status === 'cancelled';
      if (id === 'urgent') return !!e.urgent;
      return e.status === id;
    }).length;
  }

  function renderExpenses() {
    var order = { pending: 0, approved: 1, purchased: 2, rejected: 3, cancelled: 4 };
    var base = state.data.expenses.filter(function (e) {
      return passesFilter(e, state.filters.expenses, 'created', 'requester', 'expenses');
    });
    var list = base.slice().sort(function (a, b) {
      var d = (order[a.status] || 0) - (order[b.status] || 0);
      return d !== 0 ? d : atTime(b.created) - atTime(a.created);
    });
    if (state.filter !== 'all') {
      list = list.filter(function (e) {
        if (state.filter === 'other') return e.status === 'rejected' || e.status === 'cancelled';
        if (state.filter === 'urgent') return !!e.urgent;
        return e.status === state.filter;
      });
    }

    var openCount = base.filter(function (e) { return e.status === 'pending' || e.status === 'approved'; }).length;
    var html = pageHead('Chi tiêu', openCount ? openCount + ' khoản đang chờ xử lý' : 'Không có khoản nào đang chờ',
      '<button class="btn btn--primary" type="button" data-act="open-expense">' + icon('plus', 18) + 'Tạo yêu cầu chi</button>');

    html += searchBar('expenses');
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
            ? 'Thử đổi người, thời gian, nhóm hoặc từ khoá tìm kiếm.'
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
    else if (view === 'loans') content.innerHTML = renderLoans();
    else if (view === 'report') content.innerHTML = renderReport();
    else content.innerHTML = renderOverview();
  }

  function go(view) {
    if (['overview', 'income', 'expenses', 'loans', 'report'].indexOf(view) === -1) view = 'overview';
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
    } else if (e.status === 'purchased' && e.urgent) {
      items.push({ cls: 'is-done', icon: 'bolt', title: nameOf(e.urgentBy) + ' đã chi gấp', time: fmtDate(e.urgentAt || e.purchasedAt) });
      if (e.urgentAck) {
        items.push({
          cls: e.urgentAck === 'ok' ? 'is-done' : 'is-bad',
          icon: e.urgentAck === 'ok' ? 'check' : 'x',
          title: nameOf(otherOf(e.urgentBy)) + (e.urgentAck === 'ok' ? ' đã xác nhận' : ' phản đối') +
            (e.urgentAckNote ? ': ' + e.urgentAckNote : ''),
          time: fmtDate(e.urgentAckAt)
        });
      } else {
        items.push({ cls: 'is-wait', icon: 'clock', title: 'Chờ ' + nameOf(otherOf(e.urgentBy)) + ' xác nhận', time: '' });
      }
    } else if (e.status === 'purchased') {
      items.push({ cls: 'is-done', icon: 'cart', title: 'Đã mua', time: fmtDate(e.purchasedAt) });
    } else if (e.status === 'rejected') {
      items.push({
        cls: 'is-bad', icon: 'x',
        title: nameOf(e.rejectedBy) + ' từ chối' + (e.rejectNote ? ': ' + e.rejectNote : ''),
        time: relTime(e.rejectedAt)
      });
    } else if (e.status === 'cancelled') {
      items.push({
        cls: 'is-bad', icon: 'slash',
        title: nameOf(e.cancelledBy || e.requester) + ' đã huỷ' + (e.cancelReason ? ': ' + e.cancelReason : ''),
        time: relTime(e.cancelledAt || e.created)
      });
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

  function urgentApproverCards(e) {
    return '<div class="approver-cards">' + memberIds().map(function (id) {
      var cls = '';
      var label = '';
      var ic = 'clock';
      if (id === e.urgentBy) {
        cls = 'is-ok'; label = 'Đã chi gấp'; ic = 'bolt';
      } else if (!e.urgentAck) {
        cls = 'is-wait'; label = 'Chờ xác nhận'; ic = 'clock';
      } else if (e.urgentAck === 'ok') {
        cls = 'is-ok'; label = 'Đã xác nhận'; ic = 'check';
      } else {
        cls = 'is-no'; label = 'Phản đối'; ic = 'x';
      }
      return '<div class="approver-card ' + cls + '"><div class="approver-card-top">' + avatar(id, 'avatar--sm') +
        '<span class="approver-card-name">' + esc(nameOf(id)) + '</span></div>' +
        '<span class="approver-card-state">' + icon(ic, 14) + esc(label) + '</span></div>';
    }).join('') + '</div>';
  }

  function urgentDetailBanner(e) {
    if (!e.urgent) return '';
    var acker = e.urgentBy ? otherOf(e.urgentBy) : null;
    var isBuyer = e.urgentBy === state.user;
    var who = acker ? nameOf(acker) : 'người còn lại';
    if (!e.urgentAck) {
      return '<div class="banner banner--urgent"><span class="banner-icon">' + icon('bolt', 17) + '</span>' +
        '<div class="banner-copy"><p class="banner-title">Khoản này đã chi gấp</p>' +
        '<p class="banner-text">Không chờ duyệt trước. ' + esc(nameOf(e.urgentBy)) + ' đã chi ' + money(e.amount) +
        (isBuyer ? ' và đang chờ ' + esc(who) + ' xác nhận sau.' : ' và đang chờ bạn xác nhận.') +
        '</p></div></div>';
    }
    if (e.urgentAck === 'ok') {
      return '<div class="banner banner--urgent"><span class="banner-icon">' + icon('check', 17) + '</span>' +
        '<div class="banner-copy"><p class="banner-title">Chi gấp đã được xác nhận</p>' +
        '<p class="banner-text">' + (isBuyer ? esc(who) + ' đã xác nhận' : 'Bạn đã xác nhận') +
        ' khoản chi gấp này' + (e.urgentAckAt ? ' · ' + fmtDate(e.urgentAckAt) : '') + '.</p></div></div>';
    }
    return '<div class="banner banner--danger"><span class="banner-icon">' + icon('alert', 17) + '</span>' +
      '<div class="banner-copy"><p class="banner-title">Khoản chi gấp bị phản đối</p>' +
      '<p class="banner-text">' + (isBuyer ? esc(who) + ' phản đối' : 'Bạn đã phản đối') +
      (e.urgentAckNote ? ': ' + esc(e.urgentAckNote) : '.') + ' Tiền vẫn đã trừ vì đã chi thật.</p></div></div>';
  }

  function openDetail(id) {
    var e = findExpense(id);
    if (!e) return;
    var sheet = $('#detailSheet');
    var body = $('#detailBody');
    if (!sheet || !body) return;

    var s = STATUS[e.status];
    var meta = categoryMeta(e.category || 'other', 'expenses');
    body.innerHTML = urgentDetailBanner(e) +
      '<div class="detail-hero"><span class="detail-amount">' + money(e.amount) + '</span>' +
      '<span class="detail-title">' + esc(e.title) + '</span>' +
      (e.urgent ? urgentPill(e) : '') +
      '<p class="detail-reason">' + esc(e.reason) + '</p></div>' +
      '<dl class="detail-facts">' +
      '<div class="fact"><dt>Người gửi</dt><dd>' + esc(nameOf(e.requester)) + '</dd></div>' +
      '<div class="fact"><dt>Nhóm chi</dt><dd><span class="cat-dot" style="background:' + meta.color + '"></span> ' + esc(meta.label) + '</dd></div>' +
      '<div class="fact"><dt>Thời gian tạo</dt><dd>' + fmtDate(e.created) + '</dd></div>' +
      (e.loanId ? '<div class="fact"><dt>Nguồn</dt><dd>Khoản tự sinh từ sổ vay</dd></div>' : '') +
      (e.urgent ? '<div class="fact"><dt>Chi gấp bởi</dt><dd>' + esc(nameOf(e.urgentBy)) + ' · ' + fmtDate(e.urgentAt) + '</dd></div>' : '') +
      (e.urgent && e.urgentAck ? '<div class="fact"><dt>Xác nhận sau</dt><dd>' +
        esc(urgentStateText(e)) + (e.urgentAckAt ? ' · ' + fmtDate(e.urgentAckAt) : '') +
        (e.urgentAckNote ? '<br>Lý do: ' + esc(e.urgentAckNote) : '') + '</dd></div>' : '') +
      (e.status === 'purchased' ? '<div class="fact"><dt>Đã mua</dt><dd>' + fmtDate(e.purchasedAt) + '</dd></div>' : '') +
      (e.status === 'rejected' ? '<div class="fact"><dt>Từ chối bởi</dt><dd>' + esc(nameOf(e.rejectedBy)) + ' · ' + fmtDate(e.rejectedAt) +
        (e.rejectNote ? '<br>Lý do: ' + esc(e.rejectNote) : '') + '</dd></div>' : '') +
      (e.status === 'cancelled' ? '<div class="fact"><dt>Huỷ bởi</dt><dd>' + esc(nameOf(e.cancelledBy || e.requester)) + ' · ' + fmtDate(e.cancelledAt) +
        (e.cancelReason ? '<br>Lý do: ' + esc(e.cancelReason) : '') + '</dd></div>' : '') +
      '</dl>' +
      (e.loanId
        ? '<div class="banner"><span class="banner-icon">' + icon('info', 17) + '</span>' +
          '<div class="banner-copy"><p class="banner-title">Khoản tự sinh từ sổ vay</p>' +
          '<p class="banner-text">Sửa hoặc xoá trong tab Vay nợ để sổ thu/chi và số dư khớp nhau.</p></div></div>'
        : '<div><p class="block-label">Dòng thời gian</p>' + timelineHtml(e) + '</div>' +
          '<div><p class="block-label">' + (e.urgent ? 'Chi gấp &amp; xác nhận' : 'Người duyệt') + '</p>' +
          (e.urgent ? urgentApproverCards(e) : approverCards(e)) + '</div>');

    var waitingIds = e.status === 'pending'
      ? memberIds().filter(function (id) { return e.agreed[id] !== true; })
      : [];
    if (e.status === 'pending') {
      $('#detailSub').textContent = waitingIds.length ? 'Đang chờ ' + nameOf(waitingIds[0]) + ' duyệt' : 'Đang chờ đủ người duyệt';
    } else if (e.status === 'purchased' && e.urgent) {
      $('#detailSub').textContent = urgentStateText(e);
    } else if (e.loanId) {
      $('#detailSub').textContent = 'Khoản tự sinh từ sổ vay';
    } else {
      $('#detailSub').textContent = s.label;
    }

    var actions = actionButtons(e);
    $('#detailActions').innerHTML = actions || '<button class="btn btn--secondary btn--block" type="button" data-close>Đóng</button>';
    openDialog(sheet, '#detailBody [data-act], #detailBody button');
  }

  function openPurchase(id, urgentMode) {
    var e = findExpense(id);
    if (!e) return;
    if (urgentMode) {
      if (e.status !== 'pending') return;
    } else if (e.status !== 'approved') {
      return;
    }
    closeDialog($('#detailSheet'));

    var c = compute();
    var other = otherOf(state.user);
    var otherName = other ? nameOf(other) : 'người còn lại';
    var after = c.balance - e.amount;
    var body = $('#purchaseBody');
    var foot = $('#purchaseFoot');
    var title = $('#purchaseTitle');
    var sub = $('#purchaseSub');
    if (!body || !foot) return;

    if (title) title.textContent = urgentMode ? 'Chi gấp khoản này?' : 'Xác nhận đã mua';
    if (sub) sub.textContent = urgentMode
      ? 'Không cần chờ duyệt. Số dư trừ ngay, gắn nhãn Đã chi gấp.'
      : 'Số dư sẽ được trừ ngay sau khi xác nhận.';

    body.innerHTML =
      '<p class="purchase-q">' + (urgentMode ? 'Chi gấp' : 'Xác nhận đã mua') + ' <b>' + esc(e.title) + '</b>?</p>' +
      '<p class="purchase-amount">' + money(e.amount) + '</p>' +
      '<div class="purchase-balance' + (after < 0 ? ' is-neg' : '') + '">' +
      '<span>Số dư sau khi chi</span><b>' + signedMoney(after) + '</b></div>' +
      (urgentMode
        ? '<p class="purchase-warn is-urgent">' + icon('bolt', 16) +
          'Khoản này sẽ chờ ' + esc(otherName) + ' xác nhận sau. Nếu số dư âm, sổ sẽ ghi Chi vượt thu.</p>'
        : (after < 0
          ? '<p class="purchase-warn">' + icon('alert', 16) + 'Sau khi mua, bạn sẽ chi vượt thu ' + money(after) + '.</p>'
          : '<p class="purchase-note">Khoản này sẽ bị trừ vào số dư chung ngay khi bạn xác nhận.</p>'));

    foot.innerHTML = '<button class="btn btn--secondary" type="button" data-close>Huỷ</button>' +
      (urgentMode
        ? '<button class="btn btn--urgent" type="button" data-act="confirm-urgent" data-id="' + e.id + '">' + icon('bolt', 17) + 'Chi gấp ngay</button>'
        : '<button class="btn btn--primary" type="button" data-act="confirm-buy" data-id="' + e.id + '">' + icon('check', 17) + 'Đã mua</button>');
    openDialog($('#purchaseSheet'), '#purchaseSheet [data-close]');
  }

  var confirmAction = null;
  var confirmBusyLabel = 'Đang xử lý…';
  var confirmReasonRequired = false;
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

    var reasonCfg = opts.reason || null;
    var reasonWrap = $('#confirmReasonField');
    var reasonEl = $('#confirmReason');
    var reasonLabel = $('#confirmReasonLabel');
    var reasonErr = $('#confirmReasonErr');
    confirmReasonRequired = Boolean(reasonCfg && reasonCfg.required);
    if (reasonWrap) reasonWrap.hidden = !reasonCfg;
    if (reasonCfg) {
      if (reasonLabel) reasonLabel.textContent = reasonCfg.label || 'Lý do';
      if (reasonEl) {
        reasonEl.value = '';
        reasonEl.placeholder = reasonCfg.placeholder || '';
        reasonEl.setAttribute('aria-invalid', 'false');
      }
      if (reasonErr) { reasonErr.hidden = true; reasonErr.textContent = ''; }
    }
    openDialog(sheet, reasonCfg && reasonCfg.required ? '#confirmReason' : '#confirmCancel');
  }

  function afterMutation() {
    closeDialog($('#detailSheet'));
    closeDialog($('#confirmSheet'));
    closeDialog($('#incomeSheet'));
    closeDialog($('#incomeMenu'));
    closeDialog($('#expenseSheet'));
    closeDialog($('#purchaseSheet'));
    state.version = api.currentVersion() || state.version;
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

  function renderIncomeCategorySelect(selected) {
    var el = $('#incCategory');
    if (!el) return;
    var groups = [
      { id: 'income', label: 'Thu nhập' },
      { id: 'other', label: 'Tiền vào khác' }
    ];
    el.innerHTML = groups.map(function (group) {
      var cats = manualCategoryList('income').filter(function (c) { return c.group === group.id; });
      if (!cats.length) return '';
      return '<optgroup label="' + esc(group.label) + '">' + cats.map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    el.value = selected || 'other_income';
    if (!el.value) el.value = 'other_income';
  }

  function openIncomeForm(income) {
    var form = $('#incomeForm');
    if (!form) return;
    if (income && (income.loanId || isAutoCategory(income.category, 'income'))) return;
    var editing = !!income;
    state.editingIncome = editing ? income.id : null;
    state.incomeMember = editing ? income.member : state.user;

    $('#incomeTitle').textContent = editing ? 'Sửa khoản thu' : 'Thêm thu nhập';
    $('#incomeSheetSub').textContent = editing
      ? 'Cập nhật số tiền, ngày, người kiếm hoặc nhóm thu.'
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
    renderIncomeCategorySelect(editing ? (income.category || 'other_income') : 'other_income');
    openDialog($('#incomeSheet'), '#incAmount');
  }

  function openExpenseForm(expense) {
    var form = $('#expenseForm');
    if (!form) return;
    if (expense && (expense.requester !== state.user || ['pending', 'approved', 'purchased'].indexOf(expense.status) === -1)) return;
    if (expense && (expense.loanId || isAutoCategory(expense.category, 'expenses'))) return;

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
    var category = editing ? (expense.category || 'other') : 'other';
    if (isAutoCategory(category, 'expenses')) category = 'other';
    $('#expCategory').value = category;
    if (!$('#expCategory').value) $('#expCategory').value = 'other';

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
      note: $('#incNote').value.trim(),
      category: $('#incCategory') ? $('#incCategory').value : 'other_income'
    };

    runBusy($('#incomeSubmit'), 'Đang lưu…', async function () {
      try {
        if (editing) {
          await api.updateIncome(Object.assign({ id: editing.id }, values));
          editing.amount = values.amount;
          editing.date = values.date;
          editing.member = values.member;
          editing.note = values.note;
          editing.category = values.category;
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
            category: values.category,
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
            if (editing.urgent) {
              editing.urgentAck = '';
              editing.urgentAckAt = null;
              editing.urgentAckNote = '';
              toast('Đã cập nhật chi tiêu · cần xác nhận lại khoản gấp');
            } else {
              toast('Đã cập nhật chi tiêu · số dư đã tính lại');
            }
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

  function askReject(id) {
    var e = findExpense(id);
    if (!e || e.status !== 'pending') return;
    openConfirm({
      title: 'Từ chối yêu cầu?',
      message: '<b>' + esc(e.title) + '</b> · ' + money(e.amount) + '. Yêu cầu sẽ dừng ở trạng thái Từ chối.',
      confirmLabel: 'Từ chối',
      busyLabel: 'Đang từ chối…',
      reason: {
        required: false,
        label: 'Lý do từ chối (không bắt buộc)',
        placeholder: 'Ví dụ: đắt quá, chưa cần mua…'
      },
      onConfirm: async function (reason) {
        try {
          var res = await api.reject(id, reason);
          e.status = 'rejected';
          e.rejectedBy = state.user;
          e.rejectedAt = res.rejectedAt || new Date().toISOString();
          e.rejectNote = res.rejectNote || reason;
          e.agreed[state.user] = false;
          toast('Đã từ chối yêu cầu');
          afterMutation();
        } catch (err) {
          fail(err);
        }
      }
    });
  }

  function askCancel(id) {
    var e = findExpense(id);
    if (!e) return;
    var can = (e.status === 'pending' && e.requester === state.user) || e.status === 'approved';
    if (!can) return;
    var required = e.status === 'approved';
    openConfirm({
      title: 'Huỷ yêu cầu?',
      message: '<b>' + esc(e.title) + '</b> · ' + money(e.amount) + '. ' +
        (required
          ? 'Cả hai đã duyệt nhưng chưa mua. Huỷ sẽ không trừ số dư.'
          : 'Yêu cầu sẽ dừng ở trạng thái Đã huỷ và không trừ số dư.'),
      confirmLabel: 'Huỷ yêu cầu',
      busyLabel: 'Đang huỷ…',
      reason: required
        ? { required: true, label: 'Lý do huỷ', placeholder: 'Vì sao không cần mua nữa?' }
        : { required: false, label: 'Lý do huỷ (không bắt buộc)', placeholder: 'Không bắt buộc' },
      onConfirm: async function (reason) {
        try {
          var res = await api.cancel(id, reason);
          e.status = 'cancelled';
          e.cancelledBy = state.user;
          e.cancelledAt = res.cancelledAt || new Date().toISOString();
          e.cancelReason = res.cancelReason || reason;
          toast('Đã huỷ yêu cầu');
          afterMutation();
        } catch (err) {
          fail(err);
        }
      }
    });
  }

  function confirmUrgent(id, button) {
    if (state.busy) return;
    var e = findExpense(id);
    if (!e || e.status !== 'pending') return;
    var other = otherOf(state.user);

    runBusy(button, 'Đang chi gấp…', async function () {
      try {
        var res = await api.urgentPurchase(id);
        e.status = 'purchased';
        e.purchasedAt = res.purchasedAt || new Date().toISOString();
        e.urgent = true;
        e.urgentAt = res.urgentAt || e.purchasedAt;
        e.urgentBy = state.user;
        e.urgentAck = '';
        e.urgentAckAt = '';
        e.urgentAckNote = '';
        e.agreed[state.user] = true;
        toast('Đã chi gấp · chờ ' + (other ? nameOf(other) : 'người còn lại') + ' xác nhận');
        afterMutation();
      } catch (err) {
        fail(err);
      }
    });
  }

  function askUrgentAck(id, ok) {
    var e = findExpense(id);
    if (!e || !e.urgent || e.status !== 'purchased' || e.urgentBy === state.user) return;

    if (ok) {
      openConfirm({
        title: 'Xác nhận khoản chi gấp?',
        message: '<b>' + esc(e.title) + '</b> · ' + money(e.amount) + '. Xác nhận rằng khoản này đã chi đúng mục đích.',
        confirmLabel: 'Xác nhận',
        busyLabel: 'Đang xác nhận…',
        danger: false,
        onConfirm: async function () {
          try {
            var res = await api.urgentAck(id, true, '');
            e.urgentAck = 'ok';
            e.urgentAckAt = res.urgentAckAt || new Date().toISOString();
            e.urgentAckNote = '';
            e.agreed[state.user] = true;
            toast('Đã xác nhận khoản chi gấp');
            afterMutation();
          } catch (err) {
            fail(err);
          }
        }
      });
      return;
    }

    openConfirm({
      title: 'Có vấn đề với khoản chi gấp?',
      message: '<b>' + esc(e.title) + '</b> · ' + money(e.amount) + '. Tiền đã trừ; phản hồi này để hai người trao đổi lại.',
      confirmLabel: 'Gửi phản hồi',
      busyLabel: 'Đang gửi…',
      reason: { required: true, label: 'Lý do', placeholder: 'Vì sao khoản này chưa ổn?' },
      onConfirm: async function (reason) {
        try {
          var res = await api.urgentAck(id, false, reason);
          e.urgentAck = 'no';
          e.urgentAckAt = res.urgentAckAt || new Date().toISOString();
          e.urgentAckNote = res.urgentAckNote || reason;
          e.agreed[state.user] = false;
          toast('Đã gửi phản hồi');
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
    if (inc.loanId || isAutoCategory(inc.category, 'income')) return;
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
    var meta = categoryMeta(income.category || 'other_income', 'income');
    $('#incomeMenuTitle').textContent = income.note || 'Khoản thu';
    $('#incomeMenuSub').textContent = nameOf(income.member) + ' · ' + money(income.amount) + ' · ' + fmtDate(income.date) + ' · ' + meta.label;
    if (income.loanId || isAutoCategory(income.category, 'income')) {
      $('#incomeMenuBody').innerHTML =
        '<p class="menu-note">Khoản này tự sinh từ sổ vay. Sửa hoặc xoá trong tab Vay nợ để số liệu khớp.</p>' +
        (income.loanId ? '<button class="menu-row" type="button" data-act="open-loan" data-id="' + income.loanId + '">' + icon('loan', 20) + '<span>Mở sổ vay</span></button>' : '');
      openDialog(sheet, '#incomeMenuBody .menu-row');
      return;
    }
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
    var resetLink = $('#forgotResetLink');
    if (title) title.textContent = 'Quên mật khẩu';
    if (sub) sub.textContent = 'Liên kết đặt lại mật khẩu sẽ được gửi đến đúng email của tài khoản.';
    if (fields) fields.hidden = false;
    if (done) done.hidden = true;
    if (resetLink) {
      resetLink.hidden = true;
      resetLink.setAttribute('href', 'reset-password.html');
    }
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
      submit.innerHTML = 'Gửi liên kết';
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

  function syncForgotSent(member, resetUrl) {
    var fields = $('#forgotFields');
    var done = $('#forgotDone');
    var title = $('#forgotTitle');
    var sub = $('#forgotSub');
    var text = $('#forgotDoneText');
    var email = $('#forgotEmail');
    var err = $('#forgotEmailErr');
    var submit = $('#forgotSubmit');
    var close = $('#forgotClose');
    var resetLink = $('#forgotResetLink');
    if (fields) fields.hidden = true;
    if (done) done.hidden = false;
    if (title) title.textContent = 'Kiểm tra email';
    if (sub) sub.textContent = 'Liên kết đặt lại mật khẩu đã được gửi đến đúng tài khoản.';
    if (text) text.innerHTML = 'Liên kết đặt lại mật khẩu của tài khoản <b>' + esc(member.name) + '</b> đã được gửi đến <b>' + esc(member.email) + '</b>.';
    if (email) email.setAttribute('aria-invalid', 'false');
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
    if (submit) submit.hidden = true;
    if (resetLink) {
      resetLink.hidden = !resetUrl;
      if (resetUrl) resetLink.setAttribute('href', resetUrl);
    }
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
        syncForgotSent(res.member, res.resetUrl);
      } catch (e) {
        showForgotError((e && e.message) || 'Không gửi được email.');
      }
    });
  }

  function enterApp(withSkeleton) {
    var hashView = (location.hash || '').replace('#', '');
    state.view = ['overview', 'income', 'expenses', 'loans', 'report'].indexOf(hashView) !== -1 ? hashView : 'overview';
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
    state.data = { incomes: [], expenses: [], loans: [], loanPayments: [], budgets: [] };
    state.loading = true;
    state.loggedIn = false;
    state.busy = false;
    state.editingIncome = null;
    state.editingExpense = null;
    state.incomeMember = null;
    state.editingLoan = null;
    state.payingLoan = null;
    state.interestLoan = null;
    state.interestEntry = null;
    state.interestMode = 'pay';
    state.loanType = 'lend';
    state.loanTerm = 'open';
    state.loanFilter = 'all';
    state.balanceVisible = false;
    if (state.balanceTimer) {
      clearTimeout(state.balanceTimer);
      state.balanceTimer = null;
    }
    state.filter = 'all';
    state.refreshing = false;
    state.version = null;
    state.checking = false;
    state.reportMonth = monthKey(new Date().toISOString());
    state.filters = {
      income: { person: 'all', preset: 'all', from: '', to: '', category: 'all', q: '' },
      expenses: { person: 'all', preset: 'all', from: '', to: '', category: 'all', q: '' }
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
    state.data.loans = data.loans || [];
    state.data.loanPayments = data.loanPayments || [];
    state.data.budgets = data.budgets || [];
    state.loading = false;
    state.lastSync = Date.now();
    if (data.v !== undefined) state.version = String(data.v);
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

  function startVersionWatch() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(function () {
      if (document.visibilityState === 'visible' && state.loggedIn && !state.refreshing && !state.busy) {
        checkForChanges(false);
      }
    }, 60000);
  }

  async function checkForChanges(force) {
    if (!state.loggedIn || state.checking || state.loading) return;
    state.checking = true;
    try {
      var res = await api.version();
      if (force || String(res.v) !== String(state.version)) {
        await refreshData(false);
      }
    } catch (err) {
      if (err && err.code === 'auth') {
        stopSession();
        showAccessDenied('Phiên đăng nhập đã hết. Đăng nhập lại nhé.');
      }
    } finally {
      state.checking = false;
    }
  }

  async function startSession() {
    enterApp(true);
    try {
      var data = await api.load();
      applyData(data);
      render();
      startVersionWatch();
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
  /* ============================ LOANS ============================ */

  function findLoan(id) {
    return state.data.loans.filter(function (l) { return l.id === id; })[0];
  }

  function loanPaymentsFor(id) {
    return state.data.loanPayments
      .filter(function (p) { return p.loanId === id; })
      .sort(function (a, b) { return atTime(b.date) - atTime(a.date); });
  }

  function loanInterestEntries(loan) {
    var list = Array.isArray(loan.interests) ? loan.interests.slice() : [];
    if (loan.interest) {
      list.push({
        id: loan.interest.id || 'legacy-' + loan.id,
        amount: Number(loan.interest.amount) || 0,
        date: loan.interest.date || '',
        note: loan.interest.note || '',
        mode: 'pay',
        cashId: loan.interest.cashId || ''
      });
    }
    return list.sort(function (a, b) { return atTime(b.date) - atTime(a.date); });
  }

  function sumLoanInterest(entries, mode) {
    return entries
      .filter(function (entry) { return (entry.mode || 'pay') === mode; })
      .reduce(function (sum, entry) { return sum + (Number(entry.amount) || 0); }, 0);
  }

  function loanStats(loan) {
    var payments = loanPaymentsFor(loan.id);
    var paid = payments.reduce(function (s, p) { return s + p.amount; }, 0);
    var interests = loanInterestEntries(loan);
    var interestPaid = sumLoanInterest(interests, 'pay');
    var interestCapitalized = sumLoanInterest(interests, 'capitalize');
    var principal = (Number(loan.amount) || 0) + interestCapitalized;
    var remaining = Math.max(0, principal - paid);
    var closed = remaining <= 0;
    var dueState = '';
    var dueText = closed ? 'Đã tất toán' : (loan.dueDate ? 'Hạn ' + fmtDate(loan.dueDate) : 'Không kỳ hạn');

    if (!closed && loan.dueDate) {
      var due = toDate(loan.dueDate);
      if (due) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        var diff = Math.round((due.getTime() - today.getTime()) / 86400000);
        if (diff < 0) { dueState = 'overdue'; dueText = 'Quá hạn ' + Math.abs(diff) + ' ngày'; }
        else if (diff === 0) { dueState = 'soon'; dueText = 'Đến hạn hôm nay'; }
        else if (diff <= 7) { dueState = 'soon'; dueText = 'Còn ' + diff + ' ngày'; }
      }
    }
    return {
      payments: payments, paid: paid, principal: principal, remaining: remaining, closed: closed,
      interests: interests, interestPaid: interestPaid, interestCapitalized: interestCapitalized,
      interestTotal: interestPaid + interestCapitalized,
      dueState: dueState, dueText: dueText
    };
  }

  function loanTotals() {
    var out = { count: 0, receivable: 0, payable: 0, soon: 0, overdue: 0, closed: 0 };
    state.data.loans.forEach(function (loan) {
      var s = loanStats(loan);
      out.count++;
      if (s.closed) { out.closed++; return; }
      if (loan.type === 'borrow') out.payable += s.remaining;
      else out.receivable += s.remaining;
      if (s.dueState === 'overdue') out.overdue++;
      else if (s.dueState === 'soon') out.soon++;
    });
    return out;
  }

  function loanDueCount() {
    var t = loanTotals();
    return t.overdue + t.soon;
  }

  function allAgreedLocal() {
    var agreed = {};
    memberIds().forEach(function (id) { agreed[id] = true; });
    return agreed;
  }

  function addLoanCashLocal(loan) {
    var me = state.user;
    var now = loan.createdAt || new Date().toISOString();
    if (loan.type === 'borrow') {
      if (state.data.incomes.some(function (i) { return i.id === loan.cashId; })) return;
      state.data.incomes.push({
        id: loan.cashId, amount: loan.amount, date: loan.date, member: me,
        note: 'Vay ' + loan.person + (loan.note ? ' · ' + loan.note : ''),
        createdBy: me, createdAt: now, category: 'borrow', loanId: loan.id
      });
      return;
    }
    if (state.data.expenses.some(function (e) { return e.id === loan.cashId; })) return;
    state.data.expenses.push({
      id: loan.cashId, title: 'Cho ' + loan.person + ' vay', amount: loan.amount,
      category: 'lend', reason: loan.note || 'Khoản cho vay', requester: me,
      created: now, status: 'purchased', agreed: allAgreedLocal(), approvedAt: '',
      purchasedAt: loan.date, rejectedBy: '', rejectedAt: '', rejectNote: '',
      cancelledBy: '', cancelledAt: '', cancelReason: '',
      urgent: false, urgentAt: '', urgentBy: '', urgentAck: '', urgentAckAt: '', urgentAckNote: '',
      loanId: loan.id
    });
  }

  function updateLoanCashLocal(loan) {
    if (loan.type === 'borrow') {
      var inc = state.data.incomes.filter(function (i) { return i.id === loan.cashId; })[0];
      if (inc) {
        inc.amount = loan.amount;
        inc.date = loan.date;
        inc.note = 'Vay ' + loan.person + (loan.note ? ' · ' + loan.note : '');
      }
      return;
    }
    var exp = state.data.expenses.filter(function (e) { return e.id === loan.cashId; })[0];
    if (exp) {
      exp.title = 'Cho ' + loan.person + ' vay';
      exp.reason = loan.note || 'Khoản cho vay';
      exp.amount = loan.amount;
      exp.purchasedAt = loan.date;
    }
  }

  function addPaymentCashLocal(loan, payment) {
    var me = state.user;
    var now = payment.createdAt || new Date().toISOString();
    if (loan.type === 'borrow') {
      if (state.data.expenses.some(function (e) { return e.id === payment.cashId; })) return;
      state.data.expenses.push({
        id: payment.cashId, title: 'Trả nợ ' + loan.person, amount: payment.amount,
        category: 'repay', reason: payment.note || 'Trả nợ', requester: me,
        created: now, status: 'purchased', agreed: allAgreedLocal(), approvedAt: '',
        purchasedAt: payment.date, rejectedBy: '', rejectedAt: '', rejectNote: '',
        cancelledBy: '', cancelledAt: '', cancelReason: '',
        urgent: false, urgentAt: '', urgentBy: '', urgentAck: '', urgentAckAt: '', urgentAckNote: '',
        loanId: loan.id
      });
      return;
    }
    if (state.data.incomes.some(function (i) { return i.id === payment.cashId; })) return;
    state.data.incomes.push({
      id: payment.cashId, amount: payment.amount, date: payment.date, member: me,
      note: 'Thu nợ ' + loan.person + (payment.note ? ' · ' + payment.note : ''),
      createdBy: me, createdAt: now, category: 'collect', loanId: loan.id
    });
  }

  function removeCashLocal(ids) {
    state.data.expenses = state.data.expenses.filter(function (e) { return ids.indexOf(e.id) === -1; });
    state.data.incomes = state.data.incomes.filter(function (i) { return ids.indexOf(i.id) === -1; });
  }

  function loanCard(loan) {
    var s = loanStats(loan);
    var isBorrow = loan.type === 'borrow';
    var pct = s.principal ? Math.round(Math.min(1, s.paid / s.principal) * 100) : 0;
    var dueCls = s.dueState === 'overdue' ? ' is-overdue' : (s.dueState === 'soon' ? ' is-soon' : '');
    return '<article class="loan-card' + (s.closed ? ' is-closed' : '') + '" data-open-loan="' + loan.id + '">' +
      '<div class="loan-card-head"><div class="loan-card-title">' +
      '<span class="pill ' + (isBorrow ? 'pill--borrow' : 'pill--lend') + '">' + (isBorrow ? 'Đi vay' : 'Cho vay') + '</span>' +
      '<span class="loan-person">' + esc(loan.person) + '</span></div>' +
      '<span class="loan-card-amount">' + money(s.remaining) + '</span></div>' +
      '<div class="loan-card-meta"><span>' + (isBorrow ? 'Còn phải trả' : 'Còn phải thu') + '</span>' +
      '<span>Vay ' + fmtDate(loan.date) + '</span></div>' +
      '<div class="loan-bar"><span style="width:' + pct + '%"></span></div>' +
      '<div class="loan-card-foot"><span>Đã ' + (isBorrow ? 'trả' : 'thu') + ' ' + money(s.paid) + ' / ' + money(s.principal) + '</span>' +
      '<span class="loan-due' + dueCls + '">' + esc(s.dueText) + '</span></div>' +
      (s.interestPaid
        ? '<div class="loan-interest-mini"><span>Lãi đã ' + (isBorrow ? 'trả' : 'nhận') + '</span>' +
          '<b class="' + (isBorrow ? 'is-expense' : 'is-income') + '">' + money(s.interestPaid) + '</b></div>'
        : '') +
      (s.interestCapitalized
        ? '<div class="loan-interest-mini"><span>Lãi cộng vào gốc</span>' +
          '<b class="' + (isBorrow ? 'is-expense' : 'is-income') + '">' + money(s.interestCapitalized) + '</b></div>'
        : '') +
      '</article>';
  }

  function renderLoans() {
    var totals = loanTotals();
    var html = pageHead('Vay nợ',
      totals.count
        ? (totals.count - totals.closed) + ' khoản đang mở · cần thu ' + money(totals.receivable) + ' · cần trả ' + money(totals.payable)
        : 'Chưa có khoản vay nào',
      '<button class="btn btn--primary" type="button" data-act="add-loan">' + icon('plus', 18) + 'Thêm khoản vay</button>');

    if (!state.data.loans.length) {
      return html + emptyState({
        icon: 'loan',
        title: 'Sổ vay còn trống',
        text: 'Ghi lại khoản cho vay hoặc đi vay để biết còn phải thu, phải trả bao nhiêu.',
        actions: '<button class="btn btn--primary" type="button" data-act="add-loan">' + icon('plus', 18) + 'Thêm khoản vay</button>'
      });
    }

    html += '<div class="stat-row">' +
      '<article class="stat-card"><span class="stat-label">Cho vay còn thu</span>' +
      '<span class="stat-value is-income">' + money(totals.receivable) + '</span>' +
      '<span class="stat-sub">' + (totals.count - totals.closed) + ' khoản đang mở</span></article>' +
      '<article class="stat-card"><span class="stat-label">Đi vay còn trả</span>' +
      '<span class="stat-value is-expense">' + money(totals.payable) + '</span>' +
      '<span class="stat-sub">' + (totals.overdue ? totals.overdue + ' quá hạn' : (totals.soon ? totals.soon + ' sắp đến hạn' : 'Không có khoản gấp')) +
      '</span></article></div>';

    var filters = [
      { id: 'all', label: 'Tất cả' },
      { id: 'lend', label: 'Cho vay' },
      { id: 'borrow', label: 'Đi vay' },
      { id: 'due', label: 'Đến hạn' }
    ];
    html += '<div class="chip-rail" role="group" aria-label="Lọc khoản vay">' + filters.map(function (f) {
      var count = 0;
      if (f.id === 'all') count = state.data.loans.length;
      else if (f.id === 'due') count = totals.overdue + totals.soon;
      else count = state.data.loans.filter(function (l) { return l.type === f.id; }).length;
      return '<button class="chip" type="button" data-act="loan-filter" data-filter="' + f.id + '" aria-pressed="' +
        (state.loanFilter === f.id ? 'true' : 'false') + '">' + f.label + (count ? '<b>' + count + '</b>' : '') + '</button>';
    }).join('') + '</div>';

    var list = state.data.loans.slice().sort(function (a, b) {
      var sa = loanStats(a), sb = loanStats(b);
      if (sa.closed !== sb.closed) return sa.closed ? 1 : -1;
      var da = sa.dueState === 'overdue' ? 0 : (sa.dueState === 'soon' ? 1 : 2);
      var db = sb.dueState === 'overdue' ? 0 : (sb.dueState === 'soon' ? 1 : 2);
      if (da !== db) return da - db;
      return atTime(b.date) - atTime(a.date);
    });

    if (state.loanFilter !== 'all') {
      list = list.filter(function (l) {
        if (state.loanFilter === 'due') {
          var s = loanStats(l);
          return !s.closed && (s.dueState === 'overdue' || s.dueState === 'soon');
        }
        return l.type === state.loanFilter;
      });
    }

    if (!list.length) {
      html += emptyState({
        icon: 'loan',
        title: 'Không có khoản phù hợp',
        text: 'Thử chọn “Tất cả” để xem các khoản khác.',
        actions: '<button class="btn btn--secondary" type="button" data-act="loan-filter" data-filter="all">Xem tất cả</button>'
      });
      return html;
    }

    html += '<div class="loan-list">' + list.map(loanCard).join('') + '</div>';
    return html;
  }

  function openLoanDetail(id) {
    var loan = findLoan(id);
    if (!loan) return;
    var s = loanStats(loan);
    var isBorrow = loan.type === 'borrow';
    var body = $('#loanDetailBody');
    var actions = $('#loanDetailActions');
    if (!body || !actions) return;
    closeDialog($('#detailSheet'));
    closeDialog($('#incomeMenu'));

    $('#loanDetailTitle').textContent = loan.person;
    $('#loanDetailSub').textContent = (isBorrow ? 'Đi vay' : 'Cho vay') + ' · ' +
      (s.closed ? 'Đã tất toán' : (isBorrow ? 'còn phải trả ' : 'còn phải thu ') + money(s.remaining));

    var payments = s.payments.map(function (p) {
      return '<div class="payment-row"><div class="payment-main">' +
        '<span class="payment-amount">' + money(p.amount) + '</span>' +
        '<span class="payment-date">' + fmtDate(p.date) + (p.note ? ' · ' + esc(p.note) : '') + '</span></div>' +
        '<button class="btn-icon btn-icon--danger" type="button" data-act="delete-loan-payment" data-id="' + p.id + '" aria-label="Xoá lần trả">' + icon('trash', 18) + '</button></div>';
    }).join('') || '<p class="section-empty">Chưa có lần ' + (isBorrow ? 'trả' : 'thu') + ' nào.</p>';

    var interestRows = s.interests.length ? s.interests.map(function (entry) {
      var isCapitalize = (entry.mode || 'pay') === 'capitalize';
      var modeLabel = isCapitalize
        ? 'Cộng vào gốc'
        : (isBorrow ? 'Lãi đã trả' : 'Lãi đã nhận');
      return '<div class="payment-row interest-row"><div class="payment-main">' +
        '<span class="payment-amount">' + money(entry.amount) + '</span>' +
        '<span class="payment-date">' + modeLabel + ' · ' + fmtDate(entry.date) +
        (entry.note ? ' · ' + esc(entry.note) : '') + '</span></div>' +
        '<div class="interest-actions">' +
        '<button class="btn-icon" type="button" data-act="edit-loan-interest" data-id="' + loan.id + '" data-interest-id="' + entry.id + '" aria-label="Sửa lần lãi ' + fmtDate(entry.date) + '">' + icon('pencil', 18) + '</button>' +
        '<button class="btn-icon btn-icon--danger" type="button" data-act="delete-loan-interest" data-id="' + loan.id + '" data-interest-id="' + entry.id + '" aria-label="Xoá lần lãi ' + fmtDate(entry.date) + '">' + icon('trash', 18) + '</button>' +
        '</div></div>';
    }).join('') : '<p class="section-empty">Chưa ghi lãi. Có thể ghi nhiều kỳ: trả lãi hoặc cộng vào gốc.</p>';

    var interestHtml = '<div class="loan-interest">' +
      '<div class="loan-interest-head"><span class="loan-interest-label">Lãi khoản vay</span>' +
      '<button class="btn btn--secondary btn--sm" type="button" data-act="add-loan-interest" data-id="' + loan.id + '">' +
      icon('plus', 16) + 'Ghi lãi</button></div>' +
      (s.interestTotal
        ? '<p class="loan-interest-meta">Đã ' + (isBorrow ? 'trả' : 'nhận') + ' lãi ' + money(s.interestPaid) +
          ' · Lãi cộng gốc ' + money(s.interestCapitalized) + '</p>'
        : '') +
      '<div class="payment-list">' + interestRows + '</div></div>';

    body.innerHTML =
      '<div class="loan-hero"><span class="loan-hero-label">' + (isBorrow ? 'Còn phải trả' : 'Còn phải thu') + '</span>' +
      '<span class="loan-hero-amount">' + money(s.remaining) + '</span>' +
      '<p class="loan-hero-sub">Gốc ' + money(loan.amount) +
      (s.interestCapitalized ? ' · lãi gộp ' + money(s.interestCapitalized) : '') +
      ' · đã ' + (isBorrow ? 'trả gốc ' : 'thu gốc ') + money(s.paid) + '</p></div>' +
      '<dl class="detail-facts">' +
      '<div class="fact"><dt>Ngày vay</dt><dd>' + fmtDate(loan.date) + '</dd></div>' +
      '<div class="fact"><dt>Hạn trả</dt><dd>' +
        (loan.dueDate
          ? fmtDate(loan.dueDate) + (s.closed ? ' · Đã tất toán' : (s.dueState ? ' · ' + esc(s.dueText) : ''))
          : esc(s.dueText)) +
        '</dd></div>' +
      (loan.note ? '<div class="fact"><dt>Ghi chú</dt><dd>' + esc(loan.note) + '</dd></div>' : '') +
      '<div class="fact"><dt>Người tạo</dt><dd>' + esc(nameOf(loan.createdBy)) + '</dd></div>' +
      '</dl>' +
      interestHtml +
      '<div><p class="block-label">Lịch sử ' + (isBorrow ? 'trả nợ' : 'thu nợ') + '</p>' +
      '<div class="payment-list">' + payments + '</div></div>';

    actions.innerHTML =
      (s.closed ? '<span class="req-stamp">' + icon('check', 15) + 'Đã tất toán</span>' : '') +
      (!s.closed
        ? '<button class="btn btn--primary btn--block" type="button" data-act="add-loan-payment" data-id="' + loan.id + '">' +
          icon('check', 17) + (isBorrow ? 'Ghi nhận trả nợ' : 'Ghi nhận thu nợ') + '</button>' +
          '<div class="detail-actions-row"><button class="btn btn--secondary" type="button" data-act="edit-loan" data-id="' + loan.id + '">Sửa</button>' +
          '<button class="btn btn--danger" type="button" data-act="delete-loan" data-id="' + loan.id + '">Xoá khoản vay</button></div>'
        : '<div class="detail-actions-row"><button class="btn btn--secondary" type="button" data-act="edit-loan" data-id="' + loan.id + '">Sửa</button>' +
          '<button class="btn btn--danger" type="button" data-act="delete-loan" data-id="' + loan.id + '">Xoá khoản vay</button></div>');
    openDialog($('#loanDetailSheet'), '#loanDetailActions button');
  }

  function renderLoanTypeSeg() {
    var wrap = $('#loanTypeSeg');
    if (!wrap) return;
    var editing = !!state.editingLoan;
    wrap.innerHTML = [
      { id: 'lend', label: 'Cho vay', sub: 'Mình cho người khác vay' },
      { id: 'borrow', label: 'Đi vay', sub: 'Mình mượn của người khác' }
    ].map(function (t) {
      return '<button class="seg-btn loan-type-btn" type="button" data-act="pick-loan-type" data-type="' + t.id + '" aria-pressed="' +
        (state.loanType === t.id ? 'true' : 'false') + '"' + (editing ? ' disabled' : '') + '>' +
        '<span class="loan-type-label">' + t.label + '</span><span class="loan-type-sub">' + t.sub + '</span></button>';
    }).join('');
  }

  function renderLoanTermSeg() {
    var wrap = $('#loanTermSeg');
    if (!wrap) return;
    wrap.innerHTML = [
      { id: 'open', label: 'Không kỳ hạn', sub: 'Trả khi thu xếp được' },
      { id: 'fixed', label: 'Có ngày hẹn', sub: 'Có hạn trả cụ thể' }
    ].map(function (t) {
      return '<button class="seg-btn loan-type-btn" type="button" data-act="pick-loan-term" data-term="' + t.id + '" aria-pressed="' +
        (state.loanTerm === t.id ? 'true' : 'false') + '">' +
        '<span class="loan-type-label">' + t.label + '</span><span class="loan-type-sub">' + t.sub + '</span></button>';
    }).join('');
  }

  function syncLoanTerm() {
    var open = state.loanTerm === 'open';
    var dates = $('#loanDates');
    var wrap = $('#loanDueWrap');
    var due = $('#loanDue');
    if (dates) dates.classList.toggle('is-single', open);
    if (wrap) wrap.hidden = open;
    if (due) {
      due.disabled = open;
      if (open) due.value = '';
      due.setAttribute('aria-invalid', 'false');
    }
    var dueErr = $('#loanDueErr');
    if (dueErr) {
      dueErr.hidden = true;
      dueErr.textContent = '';
    }
  }

  function openLoanForm(loan) {
    var form = $('#loanForm');
    if (!form) return;
    var editing = !!loan;
    state.editingLoan = editing ? loan.id : null;
    state.loanType = editing ? loan.type : 'lend';
    state.loanTerm = editing ? (loan.dueDate ? 'fixed' : 'open') : 'open';
    var hasPayments = editing && loanPaymentsFor(loan.id).length > 0;

    $('#loanTitle').textContent = editing ? 'Sửa khoản vay' : 'Thêm khoản vay';
    $('#loanSheetSub').textContent = editing
      ? 'Sửa người, kỳ hạn hoặc ghi chú.'
      : 'Khoản vay sẽ tự ghi vào sổ thu/chi và tính vào số dư.';
    $('#loanSubmit').textContent = editing ? 'Lưu thay đổi' : 'Thêm khoản vay';
    $('#loanPerson').value = editing ? loan.person : '';
    $('#loanAmount').value = editing ? Number(loan.amount).toLocaleString('de-DE') : '';
    $('#loanDate').value = dateInputValue(editing ? loan.date : new Date().toISOString());
    $('#loanDue').value = editing ? (loan.dueDate || '') : '';
    $('#loanNote').value = editing ? (loan.note || '') : '';
    $('#loanAmount').disabled = hasPayments;
    $('#loanDate').disabled = hasPayments;
    $('#loanAmountErr').hidden = true;
    $('#loanAmountErr').textContent = '';
    $('#loanPersonErr').hidden = true;
    $('#loanPersonErr').textContent = '';
    $('#loanNotice').innerHTML = hasPayments
      ? icon('info', 16) + '<span>Đã có lần ' + (loan.type === 'borrow' ? 'trả' : 'thu') + ' nên không sửa được số tiền hoặc ngày vay. Xoá khoản vay rồi tạo lại nếu cần.</span>'
      : icon('info', 16) + '<span>' + (editing ? 'Số tiền/ngày chỉ sửa được khi chưa có lần trả nào.' : (state.loanType === 'borrow' ? 'Tiền vay sẽ cộng vào số dư.' : 'Tiền cho vay sẽ trừ khỏi số dư.')) + '</span>';
    renderLoanTypeSeg();
    renderLoanTermSeg();
    syncLoanTerm();
    closeDialog($('#detailSheet'));
    closeDialog($('#loanDetailSheet'));
    openDialog($('#loanSheet'), '#loanPerson');
  }

  function saveLoan() {
    var loan = state.editingLoan ? findLoan(state.editingLoan) : null;
    var person = $('#loanPerson').value.trim();
    var amount = Number(($('#loanAmount').value || '').replace(/[^\d]/g, ''));
    var date = $('#loanDate').value;
    var due = $('#loanDue').value;
    var note = $('#loanNote').value.trim();
    var ok = true;
    var dueErr = $('#loanDueErr');
    if (dueErr) {
      dueErr.hidden = true;
      dueErr.textContent = '';
    }
    $('#loanDue').setAttribute('aria-invalid', 'false');

    if (!person) {
      $('#loanPersonErr').textContent = 'Nhập tên người vay / cho vay.';
      $('#loanPersonErr').hidden = false;
      $('#loanPerson').setAttribute('aria-invalid', 'true');
      ok = false;
    }
    if (!loan || !$('#loanAmount').disabled) {
      if (!amount) {
        $('#loanAmountErr').textContent = 'Nhập số tiền lớn hơn 0.';
        $('#loanAmountErr').hidden = false;
        $('#loanAmount').setAttribute('aria-invalid', 'true');
        ok = false;
      }
    }
    if ((!loan || !$('#loanDate').disabled) && !date) {
      $('#loanDate').focus();
      ok = false;
    }
    if (state.loanTerm === 'fixed' && !due) {
      if (dueErr) {
        dueErr.textContent = 'Chọn hạn trả hoặc chuyển sang không kỳ hạn.';
        dueErr.hidden = false;
      }
      $('#loanDue').setAttribute('aria-invalid', 'true');
      $('#loanDue').focus();
      ok = false;
    }
    if (!ok) return;
    if (state.loanTerm === 'open') due = '';

    var values = { person: person, dueDate: due, note: note };
    if (!loan || !$('#loanAmount').disabled) values.amount = amount;
    if (!loan || !$('#loanDate').disabled) values.date = date;

    runBusy($('#loanSubmit'), 'Đang lưu…', async function () {
      try {
        var res = loan
          ? await api.updateLoan(Object.assign({ id: loan.id }, values))
          : await api.addLoan(Object.assign({ id: newId(), type: state.loanType }, values));
        var saved = res && res.loan ? res.loan : null;

        if (saved) {
          if (loan) {
            for (var i = 0; i < state.data.loans.length; i++) {
              if (state.data.loans[i].id === saved.id) state.data.loans[i] = saved;
            }
            updateLoanCashLocal(saved);
            toast('Đã cập nhật khoản vay');
          } else {
            state.data.loans.push(saved);
            addLoanCashLocal(saved);
            toast('Đã thêm khoản vay');
          }
        } else {
          toast('Khoản vay đã được lưu trước đó');
        }

        closeDialog($('#loanSheet'));
        state.version = null;
        render();
        if (saved) openLoanDetail(saved.id);
        refreshData(true);
      } catch (err) {
        fail(err);
      }
    });
  }

  function openLoanPaymentForm(id) {
    var loan = findLoan(id);
    if (!loan) return;
    var s = loanStats(loan);
    if (s.closed) return;
    state.payingLoan = loan.id;
    var isBorrow = loan.type === 'borrow';

    $('#loanPayTitle').textContent = isBorrow ? 'Ghi nhận trả nợ' : 'Ghi nhận thu nợ';
    $('#loanPaySub').textContent = loan.person + ' · còn ' + money(s.remaining);
    $('#loanPayAmount').value = Number(s.remaining).toLocaleString('de-DE');
    $('#loanPayDate').value = dateInputValue(new Date().toISOString());
    $('#loanPayNote').value = '';
    $('#loanPayAmountErr').hidden = true;
    $('#loanPayAmountErr').textContent = '';
    $('#loanPayAmount').setAttribute('aria-invalid', 'false');
    $('#loanPaySubmit').textContent = isBorrow ? 'Xác nhận trả' : 'Xác nhận thu';
    closeDialog($('#loanDetailSheet'));
    openDialog($('#loanPaymentSheet'), '#loanPayAmount');
  }

  function saveLoanPayment() {
    var loan = state.payingLoan ? findLoan(state.payingLoan) : null;
    if (!loan) return;
    var s = loanStats(loan);
    var amount = Number(($('#loanPayAmount').value || '').replace(/[^\d]/g, ''));
    var date = $('#loanPayDate').value;
    var note = $('#loanPayNote').value.trim();

    if (!amount || amount > s.remaining) {
      $('#loanPayAmountErr').textContent = 'Nhập số tiền từ 1 đến ' + money(s.remaining) + '.';
      $('#loanPayAmountErr').hidden = false;
      $('#loanPayAmount').setAttribute('aria-invalid', 'true');
      $('#loanPayAmount').focus();
      return;
    }
    if (!date) {
      $('#loanPayDate').focus();
      return;
    }

    runBusy($('#loanPaySubmit'), 'Đang lưu…', async function () {
      try {
        var res = await api.addLoanPayment({ id: newId(), loanId: loan.id, amount: amount, date: date, note: note });
        var saved = res && res.payment ? res.payment : null;
        if (saved) {
          if (!state.data.loanPayments.some(function (p) { return p.id === saved.id; })) {
            state.data.loanPayments.push(saved);
          }
          addPaymentCashLocal(loan, saved);
          toast(amount >= s.remaining ? 'Đã tất toán khoản vay' : 'Đã ghi nhận ' + (loan.type === 'borrow' ? 'trả nợ' : 'thu nợ'));
        } else {
          toast('Lần trả đã được lưu trước đó');
        }
        closeDialog($('#loanPaymentSheet'));
        state.version = null;
        render();
        if (saved) openLoanDetail(loan.id);
        var pending = refreshData(true);
        if (!saved) pending.then(function () { openLoanDetail(loan.id); });
      } catch (err) {
        fail(err);
      }
    });
  }

  function renderLoanInterestModeSeg() {
    var wrap = $('#loanInterestModeSeg');
    if (!wrap) return;
    var loan = state.interestLoan ? findLoan(state.interestLoan) : null;
    var isBorrow = loan && loan.type === 'borrow';
    wrap.innerHTML = [
      { id: 'pay', label: isBorrow ? 'Trả lãi' : 'Thu lãi', sub: 'Ghi vào sổ thu/chi' },
      { id: 'capitalize', label: 'Cộng vào gốc', sub: 'Tăng số còn phải ' + (isBorrow ? 'trả' : 'thu') }
    ].map(function (m) {
      return '<button class="seg-btn loan-type-btn" type="button" data-act="pick-interest-mode" data-mode="' + m.id + '" aria-pressed="' +
        (state.interestMode === m.id ? 'true' : 'false') + '">' +
        '<span class="loan-type-label">' + m.label + '</span><span class="loan-type-sub">' + m.sub + '</span></button>';
    }).join('');
  }

  function syncLoanInterestNotice() {
    var loan = state.interestLoan ? findLoan(state.interestLoan) : null;
    if (!loan) return;
    var isBorrow = loan.type === 'borrow';
    var notice = $('#loanInterestNotice');
    if (!notice) return;
    var s = loanStats(loan);
    var reopen = s.closed && state.interestMode === 'capitalize';
    notice.innerHTML = icon('info', 16) + '<span>' +
      (state.interestMode === 'capitalize'
        ? 'Lãi sẽ cộng vào gốc, làm tăng số còn phải ' + (isBorrow ? 'trả' : 'thu') + ' và không tạo giao dịch tiền mặt.'
        : 'Lãi ' + (isBorrow ? 'trả' : 'thu') + ' theo kỳ được ghi vào sổ thu/chi và không giảm gốc vay.') +
      (reopen ? ' Khoản đã tất toán; lãi cộng gốc sẽ mở lại khoản vay.' : '') +
      '</span>';
    var label = $('#loanInterestDateLabel');
    if (label) {
      label.textContent = state.interestMode === 'capitalize'
        ? 'Ngày ghi nhận lãi'
        : (isBorrow ? 'Ngày trả lãi' : 'Ngày nhận lãi');
    }
  }

  function openLoanInterestForm(id, interestId) {
    var loan = findLoan(id);
    if (!loan) return;
    var entries = loanInterestEntries(loan);
    var entry = interestId ? entries.filter(function (item) { return item.id === interestId; })[0] : null;
    if (interestId && !entry) return;
    state.interestLoan = loan.id;
    state.interestEntry = entry ? entry.id : null;
    state.interestMode = entry ? (entry.mode || 'pay') : 'pay';
    var isBorrow = loan.type === 'borrow';
    var editing = !!entry;

    $('#loanInterestTitle').textContent = (editing ? 'Sửa lãi ' : 'Ghi lãi ') + (isBorrow ? 'đi vay' : 'cho vay');
    $('#loanInterestSub').textContent = editing
      ? 'Cập nhật lần lãi cho ' + loan.person + '.'
      : 'Ghi một kỳ lãi cho ' + loan.person + '. Có thể ghi nhiều lần.';
    $('#loanInterestAmount').value = editing ? Number(entry.amount).toLocaleString('de-DE') : '';
    $('#loanInterestDate').value = editing
      ? (entry.date || dateInputValue(new Date().toISOString()))
      : dateInputValue(new Date().toISOString());
    $('#loanInterestNote').value = editing ? (entry.note || '') : '';
    $('#loanInterestAmountErr').hidden = true;
    $('#loanInterestAmountErr').textContent = '';
    $('#loanInterestDateErr').hidden = true;
    $('#loanInterestDateErr').textContent = '';
    $('#loanInterestAmount').setAttribute('aria-invalid', 'false');
    $('#loanInterestDate').setAttribute('aria-invalid', 'false');
    $('#loanInterestSubmit').textContent = editing ? 'Lưu thay đổi' : 'Lưu lãi';

    renderLoanInterestModeSeg();
    syncLoanInterestNotice();
    closeDialog($('#loanDetailSheet'));
    openDialog($('#loanInterestSheet'), '#loanInterestAmount');
  }

  function saveLoanInterest() {
    var loan = state.interestLoan ? findLoan(state.interestLoan) : null;
    if (!loan) return;
    var amount = Number(($('#loanInterestAmount').value || '').replace(/[^\d]/g, ''));
    var date = $('#loanInterestDate').value;
    var note = $('#loanInterestNote').value.trim();

    $('#loanInterestAmountErr').hidden = true;
    $('#loanInterestAmountErr').textContent = '';
    $('#loanInterestDateErr').hidden = true;
    $('#loanInterestDateErr').textContent = '';
    $('#loanInterestAmount').setAttribute('aria-invalid', 'false');
    $('#loanInterestDate').setAttribute('aria-invalid', 'false');

    if (!amount) {
      $('#loanInterestAmountErr').textContent = 'Nhập số lãi lớn hơn 0.';
      $('#loanInterestAmountErr').hidden = false;
      $('#loanInterestAmount').setAttribute('aria-invalid', 'true');
      $('#loanInterestAmount').focus();
      return;
    }
    if (!date) {
      $('#loanInterestDateErr').textContent = 'Chọn ngày ghi nhận lãi.';
      $('#loanInterestDateErr').hidden = false;
      $('#loanInterestDate').setAttribute('aria-invalid', 'true');
      $('#loanInterestDate').focus();
      return;
    }

    var editId = state.interestEntry;
    var mode = state.interestMode;
    runBusy($('#loanInterestSubmit'), 'Đang lưu…', async function () {
      try {
        await api.saveLoanInterest({
          loanId: loan.id,
          id: editId || undefined,
          amount: amount,
          date: date,
          note: note,
          mode: mode
        });
        state.interestLoan = null;
        state.interestEntry = null;
        closeDialog($('#loanInterestSheet'));
        await refreshData(true);
        openLoanDetail(loan.id);
        toast(editId
          ? 'Đã cập nhật lần lãi'
          : (mode === 'capitalize' ? 'Đã cộng lãi vào gốc' : 'Đã ghi lãi ' + (loan.type === 'borrow' ? 'đi vay' : 'cho vay')));
      } catch (err) {
        fail(err);
      }
    });
  }

  function askDeleteLoanInterest(id, interestId) {
    var loan = findLoan(id);
    if (!loan) return;
    var entry = loanInterestEntries(loan).filter(function (item) { return item.id === interestId; })[0];
    if (!entry) return;
    var isCapitalize = (entry.mode || 'pay') === 'capitalize';
    openConfirm({
      title: 'Xoá lần lãi?',
      message: isCapitalize
        ? 'Lãi ' + money(entry.amount) + ' đang cộng vào gốc sẽ bị xoá; số còn lại sẽ tính lại.'
        : 'Lãi ' + (loan.type === 'borrow' ? 'đã trả ' : 'đã nhận ') + money(entry.amount) +
          ' sẽ bị xoá khỏi khoản vay và khỏi sổ thu/chi.',
      confirmLabel: 'Xoá lãi',
      busyLabel: 'Đang xoá…',
      onConfirm: async function () {
        try {
          await api.deleteLoanInterest(loan.id, entry.id);
          closeDialog($('#confirmSheet'));
          closeDialog($('#loanDetailSheet'));
          await refreshData(true);
          openLoanDetail(loan.id);
          toast('Đã xoá lần lãi');
        } catch (err) {
          fail(err);
        }
      }
    });
  }

  function askDeleteLoan(id) {
    var loan = findLoan(id);
    if (!loan) return;
    var s = loanStats(loan);
    openConfirm({
      title: 'Xoá khoản vay?',
      message: '<b>' + esc(loan.person) + '</b> · ' + money(loan.amount) + '. Sẽ xoá luôn ' +
        (s.payments.length ? s.payments.length + ' lần ' + (loan.type === 'borrow' ? 'trả' : 'thu') + ', ' : '') +
        (s.interests.length ? s.interests.length + ' lần lãi và ' : '') +
        'các khoản tiền đã ghi trong sổ. Số dư sẽ tính lại.',
      confirmLabel: 'Xoá khoản vay',
      busyLabel: 'Đang xoá…',
      onConfirm: async function () {
        try {
          var cashIds = [loan.cashId]
            .concat(s.payments.map(function (p) { return p.cashId; }))
            .concat(s.interests.map(function (entry) { return entry.cashId; }))
            .filter(function (id) { return !!id; });
          await api.deleteLoan(loan.id);
          state.data.loans = state.data.loans.filter(function (l) { return l.id !== loan.id; });
          state.data.loanPayments = state.data.loanPayments.filter(function (p) { return p.loanId !== loan.id; });
          removeCashLocal(cashIds);
          closeDialog($('#confirmSheet'));
          closeDialog($('#loanDetailSheet'));
          state.version = null;
          render();
          refreshData(true);
          toast('Đã xoá khoản vay');
        } catch (err) {
          fail(err);
        }
      }
    });
  }

  function askDeleteLoanPayment(id) {
    var payment = state.data.loanPayments.filter(function (p) { return p.id === id; })[0];
    if (!payment) return;
    var loan = findLoan(payment.loanId);
    if (!loan) return;
    openConfirm({
      title: 'Xoá lần ' + (loan.type === 'borrow' ? 'trả' : 'thu') + '?',
      message: money(payment.amount) + ' · ' + fmtDate(payment.date) + '. Khoản tiền tương ứng trong sổ cũng bị xoá.',
      confirmLabel: 'Xoá',
      busyLabel: 'Đang xoá…',
      onConfirm: async function () {
        try {
          await api.deleteLoanPayment(payment.id);
          state.data.loanPayments = state.data.loanPayments.filter(function (p) { return p.id !== payment.id; });
          removeCashLocal([payment.cashId]);
          closeDialog($('#confirmSheet'));
          closeDialog($('#loanDetailSheet'));
          state.version = null;
          render();
          openLoanDetail(loan.id);
          refreshData(true);
          toast('Đã xoá lần ' + (loan.type === 'borrow' ? 'trả' : 'thu'));
        } catch (err) {
          fail(err);
        }
      }
    });
  }

  /* ============================ REPORT =========================== */

  function currentMonthKey() {
    return monthKey(new Date().toISOString());
  }

  function shiftMonth(key, delta) {
    var parts = String(key || currentMonthKey()).split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1 + delta, 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  function monthBounds(key) {
    var parts = String(key).split('-');
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) };
  }

  function monthTotals(key) {
    var incomes = state.data.incomes.filter(function (i) { return monthKey(i.date) === key; });
    var expenses = state.data.expenses.filter(function (e) {
      return e.status === 'purchased' && monthKey(e.purchasedAt) === key;
    });
    var realIncome = incomes.filter(isRealIncome);
    var otherIncome = incomes.filter(isOtherIncome);
    var spend = expenses.filter(isConsumptionExpense);
    var debt = expenses.filter(isDebtExpense);
    var incomeBy = {};
    var spendBy = {};
    var flows = { collect: 0, borrow: 0, refund: 0, lend: 0, repay: 0, interestIn: 0, interestOut: 0 };

    realIncome.forEach(function (i) {
      var id = i.category || 'other_income';
      incomeBy[id] = (incomeBy[id] || 0) + i.amount;
    });
    spend.forEach(function (e) {
      var id = e.category || 'other';
      spendBy[id] = (spendBy[id] || 0) + e.amount;
    });
    incomes.forEach(function (i) {
      if (i.category === 'loan_interest') flows.interestIn += i.amount;
      else if (flows[i.category] !== undefined) flows[i.category] += i.amount;
    });
    expenses.forEach(function (e) {
      if (e.category === 'loan_interest') flows.interestOut += e.amount;
      else if (flows[e.category] !== undefined) flows[e.category] += e.amount;
    });

    return {
      key: key,
      realIn: realIncome.reduce(function (s, i) { return s + i.amount; }, 0),
      otherIn: otherIncome.reduce(function (s, i) { return s + i.amount; }, 0),
      spend: spend.reduce(function (s, e) { return s + e.amount; }, 0),
      debt: debt.reduce(function (s, e) { return s + e.amount; }, 0),
      countIn: realIncome.length,
      countOut: spend.length,
      incomeBy: incomeBy,
      spendBy: spendBy,
      flows: flows
    };
  }

  function endBalance(key) {
    var bounds = monthBounds(key);
    var totalIn = state.data.incomes.reduce(function (s, i) {
      var d = toDate(i.date);
      return d && d <= bounds.end ? s + i.amount : s;
    }, 0);
    var totalOut = state.data.expenses.reduce(function (s, e) {
      if (e.status !== 'purchased') return s;
      var d = toDate(e.purchasedAt);
      return d && d <= bounds.end ? s + e.amount : s;
    }, 0);
    return totalIn - totalOut;
  }

  function shortMoney(n) {
    var v = Math.round(Math.abs(Number(n) || 0));
    if (v >= 1000000000) return (v / 1000000000).toFixed(v >= 10000000000 ? 0 : 1).replace('.', ',') + ' tỷ';
    if (v >= 1000000) return (v / 1000000).toFixed(v >= 10000000 ? 0 : 1).replace('.', ',') + ' tr';
    if (v >= 1000) return Math.round(v / 1000) + ' k';
    return String(v);
  }

  function deltaText(current, prev) {
    if (!prev) return current ? 'mới' : '—';
    var pct = Math.round((current - prev) / prev * 100);
    return (pct > 0 ? '+' : '') + pct + '%';
  }

  function breakdownRows(map, kind) {
    return Object.keys(map).map(function (id) {
      var meta = categoryMeta(id, kind);
      return { id: id, label: meta.label, color: meta.color, value: map[id] };
    }).filter(function (r) { return r.value > 0; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  function breakdownCard(title, rows, total, emptyText) {
    var body;
    if (!rows.length) {
      body = '<p class="section-empty">' + esc(emptyText) + '</p>';
    } else {
      body = '<div class="report-breakdown">' + rows.map(function (r) {
        var pct = total ? Math.round(r.value / total * 100) : 0;
        return '<div class="report-break-row"><div class="report-break-head">' +
          '<span class="report-break-name"><span class="cat-dot" style="background:' + r.color + '"></span>' + esc(r.label) + '</span>' +
          '<span class="report-break-value">' + money(r.value) + ' <small>' + pct + '%</small></span></div>' +
          '<div class="report-break-bar"><span style="width:' + pct + '%;background:' + r.color + '"></span></div></div>';
      }).join('') + '</div>';
    }
    return '<div class="card card-pad report-card"><div class="report-card-head"><h3 class="report-card-title">' + esc(title) + '</h3>' +
      '<span class="report-card-total">' + money(total) + '</span></div>' + body + '</div>';
  }

  function budgetMap() {
    var map = {};
    state.data.budgets.forEach(function (b) { map[b.category] = b.amount; });
    return map;
  }

  function budgetSpent(key) {
    var spent = {};
    state.data.expenses.forEach(function (e) {
      if (e.status !== 'purchased' || !isConsumptionExpense(e) || monthKey(e.purchasedAt) !== key) return;
      spent[e.category] = (spent[e.category] || 0) + e.amount;
    });
    return spent;
  }

  function budgetSection(key) {
    var map = budgetMap();
    var categories = Object.keys(map).filter(function (c) { return map[c] > 0; });
    var head = '<div class="section-head"><h2 class="section-title">Ngân sách tháng</h2>' +
      '<button class="section-link" type="button" data-act="edit-budgets">' + (categories.length ? 'Sửa' : 'Đặt ngân sách') + '</button></div>';

    if (!categories.length) {
      return '<div class="section">' + head +
        '<div class="card card-pad"><p class="section-empty">Chưa đặt ngân sách. Đặt hạn mức cho Ăn uống, Đi lại… để biết tháng này đã dùng bao nhiêu.</p></div></div>';
    }

    var spent = budgetSpent(key);
    var totalLimit = 0;
    var totalSpent = 0;
    var rows = categories.map(function (cat) {
      var limit = map[cat];
      var used = spent[cat] || 0;
      totalLimit += limit;
      totalSpent += used;
      return { cat: cat, limit: limit, used: used, ratio: limit ? used / limit : 0 };
    }).sort(function (a, b) { return b.ratio - a.ratio; });

    var html = '<div class="section">' + head + '<div class="card card-pad budget-list">' +
      '<div class="budget-total-row"><span>Tổng đã dùng</span><b>' + money(totalSpent) + ' / ' + money(totalLimit) + '</b></div>';
    rows.forEach(function (r) {
      var meta = categoryMeta(r.cat, 'expenses');
      var pct = Math.round(r.ratio * 100);
      var cls = pct >= 100 ? ' is-over' : (pct >= 80 ? ' is-warn' : '');
      html += '<div class="budget-row"><div class="budget-row-head">' +
        '<span class="budget-row-name"><span class="cat-dot" style="background:' + meta.color + '"></span>' + esc(meta.label) + '</span>' +
        '<span class="budget-row-value' + cls + '">' + money(r.used) + ' / ' + money(r.limit) + '</span></div>' +
        '<div class="budget-bar"><span class="budget-fill' + cls + '" style="width:' + Math.min(100, pct) + '%"></span></div>' +
        '<span class="budget-pct' + cls + '">' + pct + '%</span></div>';
    });
    html += '</div></div>';
    return html;
  }

  function trendCard(key) {
    var months = [];
    for (var i = 5; i >= 0; i--) months.push(shiftMonth(key, -i));
    var data = months.map(function (m) {
      var t = monthTotals(m);
      return { key: m, income: t.realIn, spend: t.spend };
    });
    var max = 1;
    data.forEach(function (d) { max = Math.max(max, d.income, d.spend); });

    var rows = data.map(function (d) {
      var parts = d.key.split('-');
      var label = 'T' + Number(parts[1]) + '/' + parts[0].slice(2);
      return '<div class="trend-row"><span class="trend-label">' + label + '</span>' +
        '<div class="trend-bars">' +
        '<span class="trend-bar is-in" style="width:' + (d.income ? Math.max(2, Math.round(d.income / max * 100)) : 0) + '%"></span>' +
        '<span class="trend-bar is-out" style="width:' + (d.spend ? Math.max(2, Math.round(d.spend / max * 100)) : 0) + '%"></span>' +
        '</div><span class="trend-values"><b class="is-income">' + shortMoney(d.income) + '</b><b class="is-expense">' + shortMoney(d.spend) + '</b></span></div>';
    }).join('');

    return '<div class="section"><div class="section-head"><h2 class="section-title">Xu hướng 6 tháng</h2>' +
      '<span class="chart-period">Thu nhập thực · Chi tiêu</span></div>' +
      '<div class="card card-pad trend-card"><div class="trend-legend">' +
      '<span><i class="trend-key is-in"></i>Thu nhập</span><span><i class="trend-key is-out"></i>Chi tiêu</span></div>' +
      rows + '</div></div>';
  }

  function perPersonCard(key) {
    var rows = state.members.map(function (m) {
      var income = state.data.incomes.filter(function (i) {
        return i.member === m.id && isRealIncome(i) && monthKey(i.date) === key;
      }).reduce(function (s, i) { return s + i.amount; }, 0);
      var spent = state.data.expenses.filter(function (e) {
        return e.requester === m.id && e.status === 'purchased' && isConsumptionExpense(e) && monthKey(e.purchasedAt) === key;
      }).reduce(function (s, e) { return s + e.amount; }, 0);
      return '<div class="person-report-row">' + avatar(m.id, 'avatar--sm') +
        '<div class="person-text"><p class="person-name">' + esc(m.name || 'Thành viên') + '</p>' +
        '<p class="person-role">Thu nhập · chi tiêu</p></div>' +
        '<div class="person-report-values"><span class="is-income">+' + money(income) + '</span>' +
        '<span class="is-expense">−' + money(spent) + '</span></div></div>';
    }).join('');
    return '<div class="section"><div class="section-head"><h2 class="section-title">Theo người</h2></div>' +
      '<div class="card card-pad">' + rows +
      '<p class="section-foot">Chi tiêu tính theo người gửi yêu cầu, không phải người trả tiền.</p></div></div>';
  }

  function loanReportCard() {
    var totals = loanTotals();
    if (!totals.count) return '';
    return '<div class="section"><div class="section-head"><h2 class="section-title">Vay &amp; nợ hiện tại</h2>' +
      '<button class="section-link" type="button" data-act="nav" data-view="loans">Mở sổ vay</button></div>' +
      '<div class="card card-pad loan-summary-card">' +
      '<div class="loan-summary-row"><span>Cho vay còn thu</span><b class="is-income">' + money(totals.receivable) + '</b></div>' +
      '<div class="loan-summary-row"><span>Đi vay còn trả</span><b class="is-expense">' + money(totals.payable) + '</b></div>' +
      (totals.overdue ? '<div class="loan-summary-row"><span>Quá hạn</span><b class="is-expense">' + totals.overdue + ' khoản</b></div>' : '') +
      '</div></div>';
  }

  function renderReport() {
    var current = currentMonthKey();
    var key = /^\d{4}-\d{2}$/.test(state.reportMonth || '') ? state.reportMonth : current;
    state.reportMonth = key;
    var t = monthTotals(key);
    var prev = monthTotals(shiftMonth(key, -1));
    var endBal = endBalance(key);
    var prevEnd = endBalance(shiftMonth(key, -1));
    var diff = t.realIn - t.spend;
    var prevDiff = prev.realIn - prev.spend;

    var html = pageHead('Báo cáo', 'Tháng ' + Number(key.split('-')[1]) + '/' + key.split('-')[0] +
      ' · số dư cuối tháng <span data-balance-amount data-value="' + endBal + '" data-format="signed">' +
      balanceValueHtml(endBal, 'signed') + '</span>',
      '<button class="btn btn--secondary" type="button" data-act="open-export">' + icon('download', 17) + 'Xuất CSV</button>');

    html += '<div class="report-month card"><button class="btn-icon" type="button" data-act="report-prev" aria-label="Tháng trước">' +
      icon('arrowLeft', 20) + '</button>' +
      '<div class="report-month-copy"><span>Kỳ báo cáo</span><b>Tháng ' + Number(key.split('-')[1]) + '/' + key.split('-')[0] + '</b></div>' +
      '<button class="btn-icon" type="button" data-act="report-next" aria-label="Tháng sau"' + (key >= current ? ' disabled' : '') + '>' +
      icon('arrowRight', 20) + '</button>' +
      (key !== current ? '<button class="btn btn--ghost btn--sm" type="button" data-act="report-current">Tháng này</button>' : '') +
      '</div>';

    html += '<div class="stat-row">' +
      '<article class="stat-card"><span class="stat-label">Thu nhập thực</span>' +
      '<span class="stat-value is-income">' + money(t.realIn) + '</span>' +
      '<span class="stat-sub">' + t.countIn + ' khoản' + (t.otherIn ? ' · vào khác ' + money(t.otherIn) : '') + '</span></article>' +
      '<article class="stat-card"><span class="stat-label">Chi tiêu</span>' +
      '<span class="stat-value is-expense">' + money(t.spend) + '</span>' +
      '<span class="stat-sub">' + t.countOut + ' khoản' + (t.debt ? ' · nợ ' + money(t.debt) : '') + '</span></article>' +
      '<article class="stat-card"><span class="stat-label">Chênh lệch</span>' +
      '<span class="stat-value ' + (diff < 0 ? 'is-expense' : 'is-income') + '">' + signedMoney(diff) + '</span>' +
      '<span class="stat-sub">Thu nhập thực − chi tiêu</span></article>' +
      '<article class="stat-card"><span class="stat-label">Số dư cuối tháng' + balanceEyeButton('balance-eye--stat') + '</span>' +
      '<span class="stat-value' + (state.balanceVisible ? '' : ' is-masked') + '" data-balance-amount data-value="' + endBal + '" data-format="signed">' +
      balanceValueHtml(endBal, 'signed') + '</span>' +
      '<span class="stat-sub">So cuối tháng trước ' + deltaText(endBal, prevEnd) + '</span></article>' +
      '</div>';

    html += '<div class="card card-pad report-compare">' +
      '<div class="report-compare-row"><span>Thu nhập</span><b>' + money(prev.realIn) + ' → ' + money(t.realIn) + '</b><em class="' +
        (t.realIn >= prev.realIn ? 'is-income' : 'is-expense') + '">' + deltaText(t.realIn, prev.realIn) + '</em></div>' +
      '<div class="report-compare-row"><span>Chi tiêu</span><b>' + money(prev.spend) + ' → ' + money(t.spend) + '</b><em class="' +
        (t.spend <= prev.spend ? 'is-income' : 'is-expense') + '">' + deltaText(t.spend, prev.spend) + '</em></div>' +
      '<div class="report-compare-row"><span>Chênh lệch</span><b>' + signedMoney(prevDiff) + ' → ' + signedMoney(diff) + '</b><em class="' +
        (diff >= prevDiff ? 'is-income' : 'is-expense') + '">' + deltaText(diff, prevDiff) + '</em></div>' +
      '</div>';

    html += '<div class="report-grid">' +
      breakdownCard('Thu nhập theo nhóm', breakdownRows(t.incomeBy, 'income'), t.realIn, 'Chưa có thu nhập thực trong tháng.') +
      breakdownCard('Chi tiêu theo nhóm', breakdownRows(t.spendBy, 'expenses'), t.spend, 'Chưa có chi tiêu trong tháng.') +
      '</div>';

    var flowRows = [
      { label: 'Thu nợ', value: t.flows.collect, kind: 'in' },
      { label: 'Đi vay', value: t.flows.borrow, kind: 'in' },
      { label: 'Hoàn tiền', value: t.flows.refund, kind: 'in' },
      { label: 'Cho vay', value: t.flows.lend, kind: 'out' },
      { label: 'Trả nợ', value: t.flows.repay, kind: 'out' },
      { label: 'Lãi cho vay', value: t.flows.interestIn, kind: 'in' },
      { label: 'Lãi đi vay', value: t.flows.interestOut, kind: 'out' }
    ].filter(function (r) { return r.value > 0; });
    html += '<div class="card card-pad report-card"><div class="report-card-head"><h3 class="report-card-title">Dòng tiền vay &amp; khác</h3>' +
      '<span class="report-card-total">' + money(t.otherIn + t.debt + t.flows.interestIn) + '</span></div>' +
      (flowRows.length
        ? '<div class="flow-list">' + flowRows.map(function (r) {
            return '<div class="flow-row"><span>' + esc(r.label) + '</span><b class="' +
              (r.kind === 'in' ? 'is-income' : 'is-expense') + '">' + (r.kind === 'in' ? '+' : '−') + money(r.value) + '</b></div>';
          }).join('') + '</div>'
        : '<p class="section-empty">Không có phát sinh vay, trả nợ, lãi hoặc hoàn tiền.</p>') +
      '</div>';

    html += budgetSection(key);
    html += trendCard(key);
    html += perPersonCard(key);
    html += loanReportCard();
    return html;
  }

  /* =========================== BUDGETS ========================== */

  function openBudgetForm() {
    var wrap = $('#budgetRows');
    if (!wrap) return;
    var map = budgetMap();
    wrap.innerHTML = EXPENSE_CATEGORIES.filter(function (c) { return c.group === 'spend'; }).map(function (c) {
      return '<label class="budget-edit-row"><span class="budget-edit-name">' +
        '<span class="cat-dot" style="background:' + c.color + '"></span>' + esc(c.label) + '</span>' +
        '<input class="input budget-input" data-cat="' + c.id + '" inputmode="numeric" autocomplete="off" ' +
        'value="' + (map[c.id] ? Number(map[c.id]).toLocaleString('de-DE') : '') + '" placeholder="0"></label>';
    }).join('');
    openDialog($('#budgetSheet'), '#budgetRows .budget-input');
  }

  function saveBudgetsFromForm() {
    var list = $$('#budgetRows .budget-input').map(function (el) {
      var amount = Number((el.value || '').replace(/[^\d]/g, ''));
      return { category: el.getAttribute('data-cat'), amount: amount };
    }).filter(function (b) { return b.amount > 0; });

    runBusy($('#budgetSubmit'), 'Đang lưu…', async function () {
      try {
        var res = await api.saveBudgets(list);
        state.data.budgets = res.budgets || [];
        state.version = api.currentVersion() || state.version;
        closeDialog($('#budgetSheet'));
        render();
        toast('Đã lưu ngân sách');
      } catch (err) {
        fail(err);
      }
    });
  }

  /* ============================ CSV ============================= */

  function csvCell(value) {
    var s = String(value == null ? '' : value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function downloadCsv(filename, header, rows) {
    var lines = [header.map(csvCell).join(',')];
    rows.forEach(function (row) { lines.push(row.map(csvCell).join(',')); });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function statusLabel(status) {
    return STATUS[status] ? STATUS[status].label : status;
  }

  function exportIncomes() {
    var header = ['Ngày', 'Số tiền', 'Người', 'Nhóm', 'Ghi chú', 'Từ sổ vay'];
    var rows = state.data.incomes.slice().sort(function (a, b) { return atTime(b.date) - atTime(a.date); })
      .map(function (i) {
        return [
          i.date, i.amount, nameOf(i.member), categoryLabel(i.category || 'other_income', 'income'),
          i.note || '', i.loanId ? 'Có' : ''
        ];
      });
    downloadCsv('so-chi-tieu-thu-nhap-' + dateInputValue(new Date().toISOString()) + '.csv', header, rows);
    closeDialog($('#exportSheet'));
    toast('Đã tải file thu nhập');
  }

  function exportExpenses() {
    var header = ['Tạo lúc', 'Mua lúc', 'Tên', 'Số tiền', 'Nhóm', 'Lý do', 'Người gửi', 'Trạng thái',
      'Chi gấp', 'Xác nhận gấp', 'Ghi chú gấp', 'Lý do từ chối', 'Lý do huỷ', 'Từ sổ vay'];
    var rows = state.data.expenses.slice().sort(function (a, b) { return atTime(b.created) - atTime(a.created); })
      .map(function (e) {
        var ack = e.urgentAck === 'ok' ? 'Đã xác nhận' : (e.urgentAck === 'no' ? 'Phản đối' : (e.urgent ? 'Chờ xác nhận' : ''));
        return [
          e.created, e.purchasedAt, e.title, e.amount, categoryLabel(e.category || 'other', 'expenses'),
          e.reason, nameOf(e.requester), statusLabel(e.status), e.urgent ? 'Có' : '', ack,
          e.urgentAckNote || '', e.rejectNote || '', e.cancelReason || '', e.loanId ? 'Có' : ''
        ];
      });
    downloadCsv('so-chi-tieu-chi-tieu-' + dateInputValue(new Date().toISOString()) + '.csv', header, rows);
    closeDialog($('#exportSheet'));
    toast('Đã tải file chi tiêu');
  }

  function exportLoans() {
    var header = ['Loại bản ghi', 'Chiều', 'Người', 'Số tiền', 'Ngày', 'Hạn trả', 'Ghi chú',
      'Đã trả/thu', 'Còn lại', 'Lãi đã trả/nhận', 'Lãi cộng gốc', 'Tổng gốc + lãi gộp', 'Trạng thái'];
    var rows = [];
    state.data.loans.forEach(function (loan) {
      var s = loanStats(loan);
      rows.push([
        'Khoản vay', loan.type === 'borrow' ? 'Đi vay' : 'Cho vay', loan.person, loan.amount,
        loan.date, loan.dueDate || 'Không kỳ hạn', loan.note || '', s.paid, s.remaining,
        s.interestPaid, s.interestCapitalized, s.principal,
        s.closed ? 'Đã tất toán' : 'Đang mở'
      ]);
      s.payments.slice().reverse().forEach(function (p) {
        rows.push([
          'Thanh toán', loan.type === 'borrow' ? 'Trả nợ' : 'Thu nợ', loan.person, p.amount,
          p.date, '', p.note || '', '', '', '', '', '', ''
        ]);
      });
      s.interests.slice().reverse().forEach(function (entry) {
        rows.push([
          'Lần lãi', (entry.mode || 'pay') === 'capitalize' ? 'Cộng vào gốc' : (loan.type === 'borrow' ? 'Trả lãi' : 'Thu lãi'),
          loan.person, entry.amount, entry.date, '', entry.note || '', '', '', '', '', '', ''
        ]);
      });
    });
    downloadCsv('so-chi-tieu-vay-no-' + dateInputValue(new Date().toISOString()) + '.csv', header, rows);
    closeDialog($('#exportSheet'));
    toast('Đã tải file vay nợ');
  }

  function openExportSheet() {
    openDialog($('#exportSheet'), '#exportBody .menu-row');
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
    var loanForm = $('#loanForm');
    if (loanForm) {
      loanForm.addEventListener('submit', function (ev) { ev.preventDefault(); saveLoan(); });
    }
    var loanDue = $('#loanDue');
    if (loanDue) {
      loanDue.addEventListener('input', function () {
        this.setAttribute('aria-invalid', 'false');
        var err = $('#loanDueErr');
        if (err) {
          err.textContent = '';
          err.hidden = true;
        }
      });
    }
    var loanPaymentForm = $('#loanPaymentForm');
    if (loanPaymentForm) {
      loanPaymentForm.addEventListener('submit', function (ev) { ev.preventDefault(); saveLoanPayment(); });
    }
    var loanInterestForm = $('#loanInterestForm');
    if (loanInterestForm) {
      loanInterestForm.addEventListener('submit', function (ev) { ev.preventDefault(); saveLoanInterest(); });
    }
    var budgetForm = $('#budgetForm');
    if (budgetForm) {
      budgetForm.addEventListener('submit', function (ev) { ev.preventDefault(); saveBudgetsFromForm(); });
    }
    var budgetRows = $('#budgetRows');
    if (budgetRows) {
      budgetRows.addEventListener('input', function (ev) {
        if (!ev.target || !ev.target.classList.contains('budget-input')) return;
        var digits = ev.target.value.replace(/[^\d]/g, '');
        ev.target.value = digits ? Number(digits).toLocaleString('de-DE') : '';
      });
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
    ['#loanAmount', '#loanPayAmount', '#loanInterestAmount'].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      el.addEventListener('input', function () {
        var digits = this.value.replace(/[^\d]/g, '');
        this.value = digits ? Number(digits).toLocaleString('de-DE') : '';
        this.setAttribute('aria-invalid', 'false');
        var err = sel === '#loanAmount' ? $('#loanAmountErr')
          : (sel === '#loanPayAmount' ? $('#loanPayAmountErr') : $('#loanInterestAmountErr'));
        if (err) err.hidden = true;
      });
    });
    var loanInterestDate = $('#loanInterestDate');
    if (loanInterestDate) {
      loanInterestDate.addEventListener('input', function () {
        this.setAttribute('aria-invalid', 'false');
        var err = $('#loanInterestDateErr');
        if (err) err.hidden = true;
      });
    }
    var loanPerson = $('#loanPerson');
    if (loanPerson) {
      loanPerson.addEventListener('input', function () {
        this.setAttribute('aria-invalid', 'false');
        var err = $('#loanPersonErr');
        if (err) err.hidden = true;
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

    var contentEl = $('#content');
    if (contentEl) {
      contentEl.addEventListener('input', function (ev) {
        if (!ev.target || ev.target.id !== 'searchInput') return;
        if (state.view !== 'income' && state.view !== 'expenses') return;
        state.filters[state.view].q = ev.target.value;
        var pos = ev.target.selectionStart || 0;
        if (state.searchTimer) clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(function () {
          render();
          var input = $('#searchInput');
          if (input) {
            input.focus({ preventScroll: true });
            try { input.setSelectionRange(pos, pos); } catch (err) { /* ignore */ }
          }
        }, 180);
      });
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
        var loanCardEl = ev.target.closest('.loan-card[data-open-loan]');
        if (loanCardEl && !ev.target.closest('button, a')) openLoanDetail(loanCardEl.getAttribute('data-open-loan'));
        return;
      }

      var act = trigger.getAttribute('data-act');
      var id = trigger.getAttribute('data-id');
      var interestId = trigger.getAttribute('data-interest-id');

      switch (act) {
        case 'nav': go(trigger.getAttribute('data-view')); break;
        case 'report-prev':
          state.reportMonth = shiftMonth(state.reportMonth, -1);
          render();
          break;
        case 'report-next':
          if (state.reportMonth < currentMonthKey()) {
            state.reportMonth = shiftMonth(state.reportMonth, 1);
            render();
          }
          break;
        case 'report-current':
          state.reportMonth = currentMonthKey();
          render();
          break;
        case 'edit-budgets': openBudgetForm(); break;
        case 'open-export': openExportSheet(); break;
        case 'toggle-balance': toggleBalance(); break;
        case 'export-income': exportIncomes(); break;
        case 'export-expense': exportExpenses(); break;
        case 'export-loans': exportLoans(); break;
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
        case 'add-loan': openLoanForm(); break;
        case 'edit-loan':
          var editLoan = findLoan(id);
          if (editLoan) openLoanForm(editLoan);
          break;
        case 'open-loan': openLoanDetail(id); break;
        case 'add-loan-payment': openLoanPaymentForm(id); break;
        case 'add-loan-interest': openLoanInterestForm(id); break;
        case 'edit-loan-interest': openLoanInterestForm(id, interestId); break;
        case 'delete-loan-interest': askDeleteLoanInterest(id, interestId); break;
        case 'delete-loan': askDeleteLoan(id); break;
        case 'delete-loan-payment': askDeleteLoanPayment(id); break;
        case 'loan-filter':
          state.loanFilter = trigger.getAttribute('data-filter') || 'all';
          render();
          break;
        case 'pick-loan-type':
          if (!state.editingLoan) {
            state.loanType = trigger.getAttribute('data-type') || 'lend';
            renderLoanTypeSeg();
            var loanNotice = $('#loanNotice');
            if (loanNotice) {
              loanNotice.innerHTML = icon('info', 16) + '<span>' +
                (state.loanType === 'borrow' ? 'Tiền vay sẽ cộng vào số dư.' : 'Tiền cho vay sẽ trừ khỏi số dư.') +
                '</span>';
            }
          }
          break;
        case 'pick-loan-term':
          state.loanTerm = trigger.getAttribute('data-term') === 'fixed' ? 'fixed' : 'open';
          renderLoanTermSeg();
          syncLoanTerm();
          break;
        case 'pick-interest-mode':
          state.interestMode = trigger.getAttribute('data-mode') === 'capitalize' ? 'capitalize' : 'pay';
          renderLoanInterestModeSeg();
          syncLoanInterestNotice();
          break;
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
        case 'filter-category':
          if (state.filterDraft) {
            state.filterDraft.category = trigger.getAttribute('data-category') || 'all';
            syncFilterSheet();
          }
          break;
        case 'clear-search':
          if (state.view === 'income' || state.view === 'expenses') state.filters[state.view].q = '';
          render();
          var searchInput = $('#searchInput');
          if (searchInput) searchInput.focus();
          break;
        case 'filter-reset': resetFilterDraft(); break;
        case 'filter-apply': applyFilterDraft(); break;
        case 'clear-filter': clearFilter(state.view, false); break;
        case 'clear-all-filters': clearFilter(state.view, true); break;
        case 'approve': approve(id, trigger); break;
        case 'reject': askReject(id); break;
        case 'ask-buy': openPurchase(id, false); break;
        case 'confirm-buy': confirmBuy(id, trigger); break;
        case 'urgent': openPurchase(id, true); break;
        case 'confirm-urgent': confirmUrgent(id, trigger); break;
        case 'urgent-ack-yes': askUrgentAck(id, true); break;
        case 'urgent-ack-no': askUrgentAck(id, false); break;
        case 'view-urgent':
          state.filter = 'urgent';
          go('expenses');
          break;
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
                state.version = api.currentVersion() || state.version;
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
      confirmSheet.addEventListener('close', function () {
        confirmAction = null;
        confirmReasonRequired = false;
      });
    }

    var confirmReason = $('#confirmReason');
    if (confirmReason) {
      confirmReason.addEventListener('input', function () {
        this.setAttribute('aria-invalid', 'false');
        var err = $('#confirmReasonErr');
        if (err) { err.hidden = true; err.textContent = ''; }
      });
    }

    var confirmBtn = $('#confirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async function () {
        if (state.busy) return;
        var fn = confirmAction;
        if (!fn) return;

        var wrap = $('#confirmReasonField');
        var reason = '';
        if (wrap && !wrap.hidden) {
          var reasonEl = $('#confirmReason');
          reason = reasonEl ? reasonEl.value.trim() : '';
          if (confirmReasonRequired && !reason) {
            var err = $('#confirmReasonErr');
            if (err) { err.textContent = 'Nhập lý do trước khi tiếp tục.'; err.hidden = false; }
            if (reasonEl) { reasonEl.setAttribute('aria-invalid', 'true'); reasonEl.focus(); }
            return;
          }
        }

        confirmAction = null;
        var done = setBusy(confirmBtn, confirmBusyLabel);
        try {
          await fn(reason);
        } finally {
          done();
        }
      });
    }
  }

  function init() {
    bindEvents();

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && state.loggedIn) checkForChanges(false);
      else if (state.balanceVisible) setBalanceVisible(false);
    });

    window.addEventListener('focus', function () {
      if (state.loggedIn) checkForChanges(false);
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
