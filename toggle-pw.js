(function () {
  var EYE_OPEN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_SHUT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  window.togglePw = function (inputId, btn) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.innerHTML = show ? EYE_SHUT : EYE_OPEN;
    btn.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼');
  };

  window.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.pw-toggle').forEach(function (btn) {
      if (!btn.innerHTML.trim()) btn.innerHTML = EYE_OPEN;
    });
  });
})();
