/*
 * Lớp gọi API Google Apps Script.
 * Dán URL deployment (/exec) vào API_URL bên dưới.
 */

var API_URL = 'https://script.google.com/macros/s/AKfycbyiD_8tFN_saVuuYvHHkkxs1H2Pw2BCqFQ0Ca7k8va3f6Zv_HLTvRy8lAYhN6cELnTNgg/exec';
var TOKEN_KEY = 'sochitieu.token';

export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ApiError';
    this.code = code || '';
  }
}

export function isConfigured() {
  return /^https?:\/\//.test(API_URL);
}

export function hasToken() {
  try { return Boolean(localStorage.getItem(TOKEN_KEY)); } catch (err) { return false; }
}

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (err) { return ''; }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (err) { /* ignore */ }
}

async function post(action, payload) {
  if (!isConfigured()) {
    throw new ApiError('Chưa dán URL Apps Script vào assets/api.js.', 'config');
  }

  var body = Object.assign({ action: action, token: getToken() }, payload || {});

  var res;
  try {
    // text/plain để tránh CORS preflight với Apps Script.
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
  } catch (err) {
    throw new ApiError('Không kết nối được Google. Kiểm tra mạng rồi thử lại.', 'network');
  }

  var text = await res.text();
  var data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new ApiError('Google trả về dữ liệu không hợp lệ. Kiểm tra lại deployment Apps Script.', 'badresponse');
  }

  if (!data || data.ok !== true) {
    var code = (data && data.code) || '';
    if (code === 'auth') setToken('');
    throw new ApiError((data && data.error) || 'Có lỗi xảy ra.', code);
  }
  return data;
}

export async function login(loginValue, password) {
  var data = await post('login', { login: loginValue, password: password });
  setToken(data.token);
  return data.member;
}

export function logout() {
  setToken('');
}

export function load() {
  return post('list', {});
}

export function addIncome(values) {
  return post('addIncome', values);
}

export function updateIncome(values) {
  return post('updateIncome', values);
}

export function deleteIncome(id) {
  return post('deleteIncome', { id: id });
}

export function addExpense(values) {
  return post('addExpense', values);
}

export function updateExpense(values) {
  return post('updateExpense', values);
}

export function approve(id) {
  return post('approve', { id: id });
}

export function reject(id) {
  return post('reject', { id: id });
}

export function cancel(id) {
  return post('cancel', { id: id });
}

export function purchase(id) {
  return post('purchase', { id: id });
}

export function deleteExpense(id) {
  return post('deleteExpense', { id: id });
}

export function saveMember(values) {
  return post('saveMember', values);
}
