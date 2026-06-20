/* ============================================
   フレカ 閲覧画面ロジック（共通）
   window.FRECA_CONFIG = { folder, appName, gasUrl }
============================================ */
(function () {
  "use strict";

  // テーマ読み込み（即時適用）
  try {
    var savedTheme = localStorage.getItem("freca_theme");
    if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
  } catch(e) {}

  var BOOT = window.FRECA_CONFIG || {};
  if (!BOOT.folder || !BOOT.gasUrl) {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#e06f6f;font-family:sans-serif">設定エラー: folder または gasUrl が指定されていません</div>';
    return;
  }

  var CONFIG = {
    folder:  BOOT.folder,
    appName: BOOT.appName || "フレカ",
    gasUrl:  BOOT.gasUrl,
  };
  var CACHE_KEY = "freca_view_" + BOOT.folder + "_v2";
  var PAGE_SIZE = 20;

  var allData = [], charaList = [], activeFilter = null, searchQ = "", currentPage = 1;

  document.title = CONFIG.appName;
  document.body.className = "pad-bottom-footer";
  document.body.innerHTML = [
    '<header class="header">',
    '  <div class="header-top">',
    '    <div class="header-title" id="header-title">みんな</div>',
    '    <span class="header-updated" id="header-updated"></span>',
    '    <button class="reload-btn" id="reload-btn" aria-label="再読み込み">',
    '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    '    </button>',
    '  </div>',
    '  <div class="search-box">',
    '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    '    <input type="search" id="search" placeholder="検索（現在のタブ内）">',
    '  </div>',
    '</header>',
    '<main>',
    '  <div class="grid" id="grid"><div class="state"><span class="ico"><svg width="36" height="36" viewBox="0 0 24 24" fill="#f9b8d4" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></span>読み込み中…</div></div>',
    '  <div class="pagination" id="pagination"></div>',
    '</main>',
    '<footer class="footer" id="footer"></footer>',
    '<div class="overlay" id="overlay"><div class="modal"><button class="modal-close" id="modal-close">✕</button><div class="modal-img-wrap" id="m-img"></div></div></div>'
  ].join("\n");

  var $ = function (id) { return document.getElementById(id); };

  var HEART_ICO = '<svg width="36" height="36" viewBox="0 0 24 24" fill="#f9b8d4" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  var ALL_ICON  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  var CHAR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

  function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  function thumbUrl(url) {
    return url.replace(/\/upload\/[^\/]+\//, "/upload/c_fill,g_auto,w_400,h_520,q_auto,f_webp/");
  }
  function fullUrl(url) {
    return url.replace(/\/upload\/[^\/]+\//, "/upload/c_limit,w_1100,h_1800,q_auto,f_webp/");
  }

  // ---- 検索正規化 ----
  function normalize(s) {
    return s
      .replace(/[０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[Ａ-Ｚａ-ｚ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  }
  function toHira(s){ return s.replace(/[\u30A1-\u30F6]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0x60); }); }
  function toKata(s){ return s.replace(/[\u3041-\u3096]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) + 0x60); }); }
  function matchSearch(target, q) {
    if (!q) return true;
    var t = normalize(target.toLowerCase());
    var qn = normalize(q.toLowerCase());
    return t.indexOf(qn) !== -1 || t.indexOf(toHira(qn)) !== -1 || t.indexOf(toKata(qn)) !== -1;
  }

  // ---- タブ ----
  function buildNavs() {
    var f = $("footer");
    f.innerHTML = "";
    var allBtn = document.createElement("button");
    allBtn.className = "nav-btn active";
    allBtn.innerHTML = ALL_ICON + "<span>みんな</span>";
    allBtn.onclick = function(){ switchNav(null, "みんな", allBtn); };
    f.appendChild(allBtn);
    charaList.forEach(function(name){
      var b = document.createElement("button");
      b.className = "nav-btn";
      b.innerHTML = CHAR_ICON + "<span>" + esc(name) + "</span>";
      b.onclick = function(){ switchNav(name, name, b); };
      f.appendChild(b);
    });
  }

  function switchNav(filter, label, btnEl) {
    var btns = document.querySelectorAll(".nav-btn");
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
    btnEl.classList.add("active");
    activeFilter = filter;
    $("header-title").textContent = label;
    $("search").value = ""; searchQ = ""; currentPage = 1;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- データ取得 ----
  function buildCharaList(data) {
    var seen = {}, list = [];
    data.forEach(function(d){
      if (d.chara && !seen[d.chara]) { seen[d.chara] = true; list.push(d.chara); }
    });
    return list;
  }

  function applyData(data) {
    allData = data;
    charaList = buildCharaList(data);
    buildNavs();
    render();
  }

  function fetchData(forceReload) {
    var hasCache = false;
    if (!forceReload) {
      try {
        var c = localStorage.getItem(CACHE_KEY);
        if (c) {
          var parsed = JSON.parse(c);
          if (parsed && parsed.data) { applyData(parsed.data); hasCache = true; }
        }
      } catch (e) {}
    }
    if (!hasCache) showState(HEART_ICO, "読み込み中…");

    fetch(CONFIG.gasUrl + "?folder=" + encodeURIComponent(CONFIG.folder))
      .then(function(r){ return r.json(); })
      .then(function(res){
        if (res.status !== "ok") {
          if (!hasCache) showState("⚠", res.message || "読み込み失敗");
          return;
        }
        var fresh = res.rows || [];
        var freshStr = JSON.stringify(fresh);
        var currentStr = JSON.stringify(allData);
        if (forceReload || freshStr !== currentStr) applyData(fresh);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: fresh })); } catch (e) {}
      })
      .catch(function(e){
        if (!hasCache) showState("⚠", "読み込みに失敗しました：" + e.message);
      });
  }

  // ---- フィルタ ----
  function getFiltered() {
    var q = searchQ.toLowerCase();
    return allData.filter(function(d){
      if (activeFilter !== null && d.chara !== activeFilter) return false;
      if (!q) return true;
      return matchSearch(String(d.code || ""), q);
    });
  }

  // ---- 描画 ----
  function render() {
    var list = getFiltered().slice().reverse();
    var total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (currentPage > total) currentPage = 1;
    var page = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    if (!page.length) { showState("⚠", "見つかりません"); return; }

    var frag = document.createDocumentFragment();
    page.forEach(function(d){
      var card = document.createElement("div");
      card.className = "card";
      var imgHtml = d.url
        ? '<img src="' + esc(d.url) + '" alt="' + esc(d.code || "") + '" loading="lazy" decoding="async" onload="this.classList.add(\'loaded\')">'
        : '<div class="no-img">' + HEART_ICO + '</div>';
      card.innerHTML =
        '<div class="card-img">' + imgHtml + '</div>' +
        '<div class="card-body">' +
          '<div class="card-chara">' + esc(d.chara || "") + '</div>' +
          '<div class="card-name">'  + esc(d.code  || "") + '</div>' +
        '</div>';
      card.onclick = function(){ openModal(d); };
      frag.appendChild(card);
    });

    var g = $("grid");
    g.innerHTML = "";
    g.appendChild(frag);
    renderPag(total);

    if (currentPage < total) {
      var next = list.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
      next.forEach(function(d){
        if (d.url) { var im = new Image(); im.src = d.url; }
      });
    }
  }

  function renderPag(total) {
    var pe = $("pagination");
    if (total <= 1) { pe.innerHTML = ""; return; }
    var p = currentPage;
    var html = '<button class="pg-btn arrow" onclick="__gp(' + (p-1) + ')" ' + (p===1?"disabled":"") + '>‹</button>';
    var pages = [];
    if (total <= 7) {
      for (var i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (p > 3) pages.push("...");
      for (var j = Math.max(2, p-1); j <= Math.min(total-1, p+1); j++) pages.push(j);
      if (p < total - 2) pages.push("...");
      pages.push(total);
    }
    pages.forEach(function(v){
      if (v === "...") html += '<span class="pg-ellipsis">…</span>';
      else html += '<button class="pg-btn' + (v===p?" active":"") + '" onclick="__gp(' + v + ')">' + v + '</button>';
    });
    html += '<button class="pg-btn arrow" onclick="__gp(' + (p+1) + ')" ' + (p===total?"disabled":"") + '>›</button>';
    pe.innerHTML = html;
  }
  window.__gp = function(p){ currentPage = p; render(); window.scrollTo({ top: 0, behavior: "smooth" }); };

  function showState(ico, msg) {
    $("grid").innerHTML = '<div class="state"><span class="ico">' + ico + '</span>' + esc(msg) + '</div>';
    $("pagination").innerHTML = "";
  }

  // ---- モーダル ----
  function openModal(d) {
    var iw = $("m-img");
    iw.innerHTML = d.url
      ? '<img src="' + esc(fullUrl(d.url)) + '" alt="' + esc(d.code || "") + '">'
      : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">' + HEART_ICO + '</div>';
    $("overlay").classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal() { $("overlay").classList.remove("open"); document.body.style.overflow = ""; }
  $("modal-close").onclick = closeModal;
  $("overlay").onclick = function(e){ if (e.target === $("overlay")) closeModal(); };
  $("search").addEventListener("input", function(e){ searchQ = e.target.value; currentPage = 1; render(); });
  $("reload-btn").onclick = function(){ try { localStorage.removeItem(CACHE_KEY); } catch(e){} fetchData(true); };

  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/assets/sw.js").catch(function(){});
  }

  fetchData(false);
})();
