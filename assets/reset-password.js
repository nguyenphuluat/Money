(function () {
  'use strict';

  var $ = function (selector) { return document.querySelector(selector); };
  var params = new URLSearchParams(window.location.search);
  var token = (params.get('token') || '').trim();
  var endpoint = (document.body.getAttribute('data-reset-endpoint') || '').trim();
  var resetForm = $('#resetForm');
  var resetTitle = $('#resetTitle');
  var resetSub = $('#resetSub');
  var resetInvalid = $('#resetInvalid');
  var resetSuccess = $('#resetSuccess');
  var resetLoginLink = $('#resetLoginLink');
  var password = $('#resetPassword');
  var confirm = $('#resetConfirm');
  var passwordErr = $('#resetPasswordErr');
  var confirmErr = $('#resetConfirmErr');
  var serverErr = $('#resetServerErr');
  var submit = $('#resetSubmit');

  function setError(input, error, message) {
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  }

  function clearErrors() {
    [password, confirm].forEach(function (input) {
      if (input) input.setAttribute('aria-invalid', 'false');
    });
    [passwordErr, confirmErr].forEach(function (error) {
      if (error) {
        error.textContent = '';
        error.hidden = true;
      }
    });
    if (serverErr) {
      serverErr.hidden = true;
      var text = serverErr.querySelector('span');
      if (text) text.textContent = '';
    }
  }

  function showServerError(message) {
    if (!serverErr) return;
    var text = serverErr.querySelector('span');
    if (text) text.textContent = message;
    serverErr.hidden = false;
  }

  function showInvalid() {
    if (resetForm) resetForm.hidden = true;
    if (resetSuccess) resetSuccess.hidden = true;
    if (resetInvalid) resetInvalid.hidden = false;
    if (resetTitle) resetTitle.textContent = 'Liên kết không hợp lệ';
    if (resetSub) resetSub.textContent = 'Liên kết đã hết hạn hoặc đã được sử dụng.';
    if (resetLoginLink) resetLoginLink.textContent = 'Quay lại đăng nhập';
    if (resetTitle) resetTitle.focus();
  }

  function showSuccess() {
    if (resetForm) resetForm.hidden = true;
    if (resetInvalid) resetInvalid.hidden = true;
    if (resetSuccess) resetSuccess.hidden = false;
    if (resetTitle) resetTitle.textContent = 'Đặt lại mật khẩu thành công';
    if (resetSub) resetSub.textContent = 'Mật khẩu mới đã được lưu cho tài khoản của bạn.';
    if (resetLoginLink) resetLoginLink.textContent = 'Đăng nhập';
    if (password) password.value = '';
    if (confirm) confirm.value = '';
    if (resetSuccess) resetSuccess.focus();
  }

  function showForm() {
    if (resetInvalid) resetInvalid.hidden = true;
    if (resetSuccess) resetSuccess.hidden = true;
    if (resetForm) resetForm.hidden = false;
    if (resetTitle) resetTitle.textContent = 'Đặt lại mật khẩu';
    if (resetSub) resetSub.textContent = 'Tạo mật khẩu mới cho tài khoản của bạn.';
    if (resetLoginLink) resetLoginLink.textContent = 'Quay lại đăng nhập';
  }

  function setBusy(busy) {
    if (!submit) return;
    submit.disabled = busy;
    submit.innerHTML = busy
      ? '<span class="btn-spinner" aria-hidden="true"></span>Đang lưu…'
      : 'Lưu mật khẩu mới';
  }

  function submitReset() {
    if (!password || !confirm) return;
    clearErrors();
    var next = password.value;
    var again = confirm.value;
    var valid = true;

    if (next.length < 8) {
      setError(password, passwordErr, 'Mật khẩu mới cần ít nhất 8 ký tự.');
      valid = false;
    }
    if (!again) {
      setError(confirm, confirmErr, 'Nhập lại mật khẩu mới.');
      valid = false;
    } else if (again !== next) {
      setError(confirm, confirmErr, 'Hai mật khẩu chưa giống nhau.');
      valid = false;
    }
    if (!valid) return;

    setBusy(true);

    if (!endpoint) {
      if (token === 'demo') {
        setTimeout(function () {
          setBusy(false);
          showSuccess();
        }, 650);
      } else {
        setBusy(false);
        showServerError('Trang đặt lại chưa được kết nối với Apps Script. Hãy cấu hình endpoint trước khi dùng liên kết thật.');
      }
      return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'resetPassword', token: token, password: next })
    }).then(function (response) {
      return response.text().then(function (raw) {
        var data = null;
        try { data = JSON.parse(raw); } catch (err) { /* ignore */ }
        if (!response.ok || !data || data.ok !== true) {
          throw new Error((data && data.error) || 'Không đặt lại được mật khẩu. Liên kết có thể đã hết hạn.');
        }
        setBusy(false);
        showSuccess();
      });
    }).catch(function (error) {
      setBusy(false);
      showServerError((error && error.message) || 'Không kết nối được dịch vụ đặt lại mật khẩu.');
    });
  }

  document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
    button.addEventListener('click', function () {
      var input = $('#' + button.getAttribute('data-password-toggle'));
      if (!input) return;
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.setAttribute('aria-pressed', showing ? 'false' : 'true');
      button.setAttribute('aria-label', showing ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
      var open = button.querySelector('.eye-open');
      var closed = button.querySelector('.eye-off');
      if (open) open.hidden = !showing;
      if (closed) closed.hidden = showing;
    });
  });

  [password, confirm].forEach(function (input) {
    if (!input) return;
    input.addEventListener('input', function () {
      input.setAttribute('aria-invalid', 'false');
      var error = input === password ? passwordErr : confirmErr;
      if (error) {
        error.textContent = '';
        error.hidden = true;
      }
    });
  });

  if (resetForm) {
    resetForm.addEventListener('submit', function (event) {
      event.preventDefault();
      submitReset();
    });
  }

  if (!token || token === 'expired' || token === 'invalid') {
    showInvalid();
  } else {
    showForm();
  }
})();
