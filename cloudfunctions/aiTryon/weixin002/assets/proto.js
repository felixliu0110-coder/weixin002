/* 我形我衣 · 小程序原型共享交互 */
(function () {
  "use strict";

  var OD = (window.OD = window.OD || {});

  /* ---------- Toast ---------- */
  OD.toast = function (msg, ms) {
    ms = ms || 1900;
    var el = document.querySelector(".toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(OD._toastTimer);
    OD._toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, ms);
  };

  /* ---------- 屏幕跳转：通知顶层预览器 ---------- */
  OD.nav = function (to) {
    try {
      if (window.top && window.top.location && window.top !== window) {
        window.top.location.hash = "s/" + to;
      } else if (window.location.hash !== "s/" + to) {
        window.location.hash = "s/" + to;
      }
    } catch (e) { /* 跨域时忽略 */ }
    try {
      window.parent.postMessage({ type: "od-nav", to: to }, "*");
    } catch (e) { /* 忽略 */ }
  };

  OD.navAfter = function (to, ms, msg) {
    if (msg) OD.toast(msg, Math.min(ms, 2400));
    setTimeout(function () { OD.nav(to); }, ms);
  };

  /* ---------- 底部弹层 ---------- */
  OD.openSheet = function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.add("show");
  };
  OD.closeSheet = function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove("show");
  };

  /* ---------- 进度环动画 ---------- */
  OD.ring = function (ringEl, numEl, target, duration, done) {
    if (!ringEl) return;
    duration = duration || 3000;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var t = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      var v = Math.round(target * eased);
      ringEl.style.setProperty("--p", v);
      if (numEl) numEl.textContent = v + "%";
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (done) {
        done();
      }
    }
    requestAnimationFrame(step);
  };

  /* ---------- 滑块填充 ---------- */
  OD.slider = function (input) {
    var min = parseFloat(input.min) || 0;
    var max = parseFloat(input.max) || 100;
    var v = parseFloat(input.value) || min;
    var pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
    input.style.setProperty("--fill", pct + "%");
    var out = document.getElementById(input.getAttribute("data-out"));
    if (out) {
      var unit = input.getAttribute("data-unit") || "";
      out.innerHTML = unit ? v + "<small>" + unit + "</small>" : String(v);
    }
  };
  (function initSliders() {
    var inputs = document.querySelectorAll('input[type="range"]');
    for (var i = 0; i < inputs.length; i++) {
      (function (el) {
        OD.slider(el);
        el.addEventListener("input", function () { OD.slider(el); });
      })(inputs[i]);
    }
  })();

  /* ---------- 全局事件委托 ---------- */
  document.addEventListener("click", function (ev) {
    var target = ev.target.closest
      ? ev.target.closest("[data-nav], [data-toast], [data-sheet], [data-close], [data-garment], [data-chip]")
      : null;
    if (!target) return;
    if (target.hasAttribute("data-nav")) {
      ev.preventDefault();
      OD.nav(target.getAttribute("data-nav"));
    }
    if (target.hasAttribute("data-toast")) {
      OD.toast(target.getAttribute("data-toast"));
    }
    if (target.hasAttribute("data-sheet")) {
      OD.openSheet(target.getAttribute("data-sheet"));
    }
    if (target.hasAttribute("data-close")) {
      OD.closeSheet(target.getAttribute("data-close"));
    }
    if (target.hasAttribute("data-garment")) {
      var name = target.getAttribute("data-garment");
      target.classList.toggle("on");
      var count = document.querySelectorAll("[data-garment].on").length;
      if (!target.hasAttribute("data-toast")) {
        OD.toast(count > 0 ? "已选择「" + name + "」" : "已取消选择");
      }
      document.dispatchEvent(new CustomEvent("od:garment", { detail: { count: count } }));
    }
    if (target.hasAttribute("data-chip")) {
      var group = target.getAttribute("data-chip-group");
      if (group) {
        var siblings = document.querySelectorAll('[data-chip-group="' + group + '"]');
        for (var i = 0; i < siblings.length; i++) siblings[i].classList.remove("on");
      }
      target.classList.add("on");
      var label = target.getAttribute("data-chip");
      if (target.hasAttribute("data-chip-toast")) {
        OD.toast(target.getAttribute("data-chip-toast"));
      } else if (label) {
        OD.toast("已选择：" + label);
      }
    }
  });
})();
