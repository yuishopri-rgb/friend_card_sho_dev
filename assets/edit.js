/* ============================================
   フレカ 編集画面ロジック（共通）
   window.FRECA_CONFIG = { folder, appName, gasUrl } を前提
============================================ */
(function () {
  "use strict";

  // テーマ読み込み（即時適用）
  var THEME_KEY = "freca_theme";
  try {
    var savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
  } catch(e) {}

  var BOOT = window.FRECA_CONFIG || {};
  if (!BOOT.folder || !BOOT.gasUrl) {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#e06f6f;font-family:sans-serif">設定エラー: folder または gasUrl が指定されていません</div>';
    return;
  }

  // 実行時に解決される設定（GASから取得）
  var CONFIG = {
    folder:       BOOT.folder,
    appName:      BOOT.appName || "フレカ登録",
    gasUrl:       BOOT.gasUrl,
    cloudName:    null,
    uploadPreset: null,
    sheetName:    null,
  };
  var AUTH_TOKEN_KEY  = "freca_auth_token_" + BOOT.folder;
  var AUTH_DATE_KEY   = "freca_auth_date_"  + BOOT.folder;
  var LAST_CHARA_KEY  = "freca_last_chara_" + BOOT.folder;
  var SETTINGS_KEY    = "freca_settings_"   + BOOT.folder;

  // ---- 設定管理 ----
  function loadSettings() {
    try {
      var s = localStorage.getItem(SETTINGS_KEY);
      return s ? JSON.parse(s) : { autoChara: true };
    } catch(e) { return { autoChara: true }; }
  }
  function saveSettings(settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch(e) {}
  }
  var settings = loadSettings();

  var cardMap = {};
  var deleteMode = false;
  var selectedIds = {};
  var selectedCount = 0;
  var searchQ = "";
  var combineMode = false;
  var combineSelected = [];
  var MAX_COMBINE = 8;
  var COMMENT_KEY  = "freca_comment_" + BOOT.folder;
  var filterPending = false;
  var PAGE_SIZE_EDIT = 20;
  var pendingPage = 1;
  var donePage = 1;

  // ---- DOM構築 ----
  document.title = CONFIG.appName;
  document.body.className = "pad-bottom";
  document.body.innerHTML = [
    '<div class="full-loading" id="full-loading"><span class="spin" style="font-size:32px"></span><div class="msg" id="full-loading-msg">読み込み中…</div></div>',
    '<div class="auth-screen" id="auth-screen">',
    '  <div class="auth-logo"></div>',
    '  <div class="auth-title" id="auth-app-name"></div>',
    '  <div class="auth-sub">パスワードを入力してね</div>',
    '  <div class="auth-box">',
    '    <div class="auth-label">パスワード</div>',
    '    <input class="auth-input" id="pw-input" type="password" placeholder="••••••••" autocomplete="current-password">',
    '    <button class="auth-btn" id="pw-btn">はいる</button>',
    '    <div class="auth-error" id="pw-error"></div>',
    '  </div>',
    '</div>',
    '<div id="main-content" style="display:none">',
    '  <header class="header">',
    '    <div class="header-top">',
    '      <div class="header-title" id="header-title"></div>',
    '      <a class="header-btn" id="view-page-btn" href="./view.html" target="_blank">閲覧ページ</a>',
    '      <button class="header-btn" id="combine-mode-btn">フレカ結合</button>',
    '      <button class="header-btn" id="delete-mode-btn">削除</button>',
    '      <button class="header-btn" id="settings-btn" aria-label="設定" style="width:32px;height:32px;padding:0;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>',
    '    </div>',
    '    <div class="header-sub">画像を選んでアップロードしてね</div>',
    '    <div class="edit-search-row">',
    '      <div class="search-box">',
    '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    '        <input type="search" id="edit-search" placeholder="コーデ名・キャラ名で検索">',
    '      </div>',
    '      <button class="filter-btn" id="filter-pending-btn">未入力のみ</button>',
    '    </div>',
    '  </header>',
    '  <div class="delete-bar" id="delete-bar">',
    '    <div class="delete-bar-label" id="delete-bar-label">0件選択中</div>',
    '    <button class="delete-cancel-btn" id="delete-cancel-btn">キャンセル</button>',
    '    <button class="delete-exec-btn" id="delete-exec-btn" disabled>削除</button>',
    '  </div>',
    '  <div class="upload-zone" id="upload-zone">',
    '    <input type="file" id="file-input" accept="image/*" multiple>',
    '    ',
    '    <div class="upload-label">画像を選択</div>',
    '    <div class="upload-sub">カメラロールから複数選べます</div>',
    '  </div>',
    '  <div class="progress-wrap" id="progress-wrap">',
    '    <div class="progress-label" id="progress-label">アップロード中… 0 / 0</div>',
    '    <div class="progress-bar-bg"><div class="progress-bar" id="progress-bar"></div></div>',
    '  </div>',
    '  <div id="pending-section" style="display:none">',
    '    <div class="section-title">未入力 <span class="badge" id="pending-badge">0</span></div>',
    '    <div class="grid" id="pending-grid"></div>',
    '  </div>',
    '  <div id="done-section" style="display:none">',
    '    <div class="section-title">登録済み <span class="badge done" id="done-badge">0</span></div>',
    '    <div class="grid" id="done-grid"></div>',
    '  </div>',
    '  <div class="empty-state" id="empty-state" style="display:none"><span class="ico"></span>上の画像ボタンから<br>フレカ写真を選んでね</div>',
    '  <div class="loading-sheet" id="loading-sheet"><span class="spin" style="display:inline-block;border:2px solid #f9a8c9;border-top-color:transparent;border-radius:50%;width:18px;height:18px;animation:spin 0.8s linear infinite"></span> 既存データを読み込み中…</div>',
    '</div>',
    '<div class="combine-bar" id="combine-bar">',
    '  <div class="combine-bar-label" id="combine-bar-label">0 / 8 枚選択中</div>',
    '  <button class="combine-cancel-btn" id="combine-cancel-btn">キャンセル</button>',
    '  <button class="combine-exec-btn" id="combine-exec-btn" disabled>結合する</button>',
    '</div>',
    '<div class="overlay" id="combine-overlay">',
    '  <div class="modal combine-modal">',
    '    <button class="modal-close" id="combine-modal-close">✕</button>',
    '    <div class="combine-img-wrap" id="combine-img-wrap"></div>',
    '    <div class="combine-text-area">',
    '      <pre id="combine-text"></pre>',
    '      <button class="combine-copy-btn" id="combine-copy-btn">コーデ名をクリップボードにコピーする</button>',
    '    </div>',
    '    <button class="combine-save-btn" id="combine-save-btn">画像を保存する</button>',
    '  </div>',
    '</div>',

    '<div class="toast" id="toast"></div>',
    '<div class="settings-overlay" id="settings-overlay"></div>',
    '<div class="settings-panel" id="settings-panel">',
    '  <div class="settings-header">',
    '    <div class="settings-header-title">設定</div>',
    '    <button class="settings-close-btn" id="settings-close-btn">×</button>',
    '  </div>',
    '  <div class="settings-body">',
    '    <div class="settings-item" style="flex-direction:column;align-items:flex-start">',
    '      <div class="settings-item-title">テーマカラー</div>',
    '      <div class="theme-picker" id="theme-picker">',
    '        <button class="theme-dot" data-theme="" style="background:linear-gradient(135deg,#f9b8d4,#c9b8f0)" title="ピンク"></button>',
    '        <button class="theme-dot" data-theme="purple" style="background:linear-gradient(135deg,#c9b8f0,#f0b8d4)" title="パープル"></button>',
    '        <button class="theme-dot" data-theme="blue" style="background:linear-gradient(135deg,#a8d0f0,#b8c8f0)" title="ブルー"></button>',
    '        <button class="theme-dot" data-theme="mint" style="background:linear-gradient(135deg,#a0e8d0,#b8e0c8)" title="ミント"></button>',
    '        <button class="theme-dot" data-theme="orange" style="background:linear-gradient(135deg,#f8c8a0,#f0d0a8)" title="オレンジ"></button>',
    '        <button class="theme-dot" data-theme="lavender" style="background:linear-gradient(135deg,#d0b8e8,#e0c0d8)" title="ラベンダー"></button>',
    '      </div>',
    '    </div>',
    '    <div class="settings-item">',
    '      <div class="settings-item-label">',
    '        <div class="settings-item-title">マイキャラ名 自動入力</div>',
    '        <div class="settings-item-desc">最後に入力したマイキャラ名を<br>次回のアップロード時に自動入力する</div>',
    '      </div>',
    '      <label class="toggle">',
    '        <input type="checkbox" id="toggle-auto-chara">',
    '        <span class="toggle-slider"></span>',
    '      </label>',
    '    </div>',
    '    <div class="settings-divider"></div>',
    '    <div class="settings-item" style="flex-direction:column;align-items:flex-start;gap:6px">',
    '      <div class="settings-item-title">コメント（閲覧ページに表示）</div>',
    '      <div style="display:flex;gap:8px;width:100%">',
    '        <input class="input-field" id="comment-input" type="text" placeholder="例：2025年1月更新" style="flex:1;font-size:13px">',
    '        <button class="settings-img-send-btn" id="comment-save-btn">保存</button>',
    '      </div>',
    '      <div class="settings-img-status" id="comment-status"></div>',
    '    </div>',
    '    <div class="settings-divider"></div>',
    '    <div class="settings-img-upload-block">',
    '      <div class="settings-item-title">アプリアイコン（icon.png）</div>',
    '      <div class="settings-img-hint">推奨サイズ：1:1（正方形）</div>',
    '      <div class="settings-img-upload-row">',
    '        <img id="preview-icon" src="icon.png" onerror="this.style.background=\'#f3e6f0\'" style="width:44px;height:44px;border-radius:10px;object-fit:cover;border:1px solid #eee;flex-shrink:0">',
    '        <label class="settings-img-pick-btn" for="input-icon">画像を選ぶ</label>',
    '        <input type="file" id="input-icon" accept="image/*" style="display:none">',
    '        <button class="settings-img-send-btn" id="btn-icon" disabled>アップロード</button>',
    '      </div>',
    '      <div class="settings-img-status" id="status-icon"></div>',
    '    </div>',
    '    <div class="settings-img-upload-block">',
    '      <div class="settings-item-title">OGP画像（ogp.png）</div>',
    '      <div class="settings-img-hint">推奨サイズ：1200×630px</div>',
    '      <img id="preview-ogp" src="ogp.png" onerror="this.style.background=\'#f3e6f0\'" style="width:100%;height:80px;border-radius:6px;object-fit:cover;border:1px solid #eee;margin:6px 0 8px">',
    '      <div class="settings-img-upload-row">',
    '        <input type="file" id="input-ogp" accept="image/*" style="display:none">',
    '        <label class="settings-img-pick-btn" for="input-ogp">画像を選ぶ</label>',
    '        <button class="settings-img-send-btn" id="btn-ogp" disabled>アップロード</button>',
    '      </div>',
    '      <div class="settings-img-status" id="status-ogp"></div>',
    '      <div class="settings-img-hint" style="margin-top:6px">OGP画像がXに反映されるのは1日程度時間がかかる場合があります</div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join("\n");

  var $ = function (id) { return document.getElementById(id); };

  // ---- ユーティリティ ----
  function getToday() { return new Date().toISOString().slice(0, 10); }
  function showToast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    setTimeout(function(){ t.classList.remove("show"); }, 2800);
  }
  function gasPost(body) {
    return fetch(CONFIG.gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
    }).then(function(r){ return r.json(); });
  }
  // 書き込み系（レスポンス不要・no-cors）
  function gasPostFire(body) {
    return fetch(CONFIG.gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      mode: "no-cors",
    });
  }

  // ---- サムネ用URL（軽量） / フル用URL ----
  function thumbUrl(url) {
    // 既に変換済みURLでも c_fill で上書きサムネを作る
    return url.replace(/\/upload\/[^/]*\//, "/upload/c_fill,g_auto,w_400,h_520,q_auto,f_auto/");
  }

  // ================= 認証 =================
  function checkAuthLocal() {
    var token = localStorage.getItem(AUTH_TOKEN_KEY);
    var date  = localStorage.getItem(AUTH_DATE_KEY);
    return !!(token && date === getToday());
  }

  function submitPassword() {
    var pw = $("pw-input").value.trim();
    if (!pw) return;
    var btn = $("pw-btn"), err = $("pw-error");
    btn.disabled = true; btn.textContent = "確認中…"; err.textContent = "";
    gasPost({ action: "auth", folder: CONFIG.folder, password: pw })
      .then(function(data){
        if (data.status === "ok") {
          localStorage.setItem(AUTH_TOKEN_KEY, data.token);
          localStorage.setItem(AUTH_DATE_KEY, getToday());
          enterApp();
        } else {
          err.textContent = data.message || "パスワードが違います";
          btn.disabled = false; btn.textContent = "はいる";
        }
      })
      .catch(function(){
        err.textContent = "通信エラーが発生しました";
        btn.disabled = false; btn.textContent = "はいる";
      });
  }

  function showAuth() {
    $("full-loading").classList.add("hide");
    $("auth-app-name").textContent = CONFIG.appName;
    $("auth-screen").classList.add("show");
    $("pw-btn").addEventListener("click", submitPassword);
    $("pw-input").addEventListener("keydown", function(e){ if (e.key === "Enter") submitPassword(); });
  }

  function enterApp() {
    $("auth-screen").classList.remove("show");
    $("full-loading").classList.add("hide");
    $("main-content").style.display = "";
    $("header-title").textContent =  CONFIG.appName;
    bindUploadEvents();
    loadExistingCards();
  }

  // ================= 起動：設定取得 =================
  function boot() {
    $("full-loading-msg").textContent = "せってい読み込み中…";
    gasPost({ action: "config", folder: CONFIG.folder })
      .then(function(data){
        if (data.status !== "ok") {
          $("full-loading").innerHTML = '<div class="err">設定の取得に失敗しました<br>' + (data.message || "") + '</div>';
          return;
        }
        CONFIG.cloudName    = data.cloudName;
        CONFIG.uploadPreset = data.uploadPreset;
        CONFIG.sheetName    = data.sheetName;
        CONFIG.appName      = data.appName || CONFIG.appName;
        document.title = CONFIG.appName;

        // サーバーからテーマを適用
        if (data.theme) {
          document.documentElement.setAttribute("data-theme", data.theme);
          localStorage.setItem(THEME_KEY, data.theme);
        } else {
          document.documentElement.removeAttribute("data-theme");
          localStorage.removeItem(THEME_KEY);
        }
        // コメントを設定パネルに反映
        if ($("comment-input")) {
          $("comment-input").value = data.comment || "";
          try { localStorage.setItem(COMMENT_KEY, data.comment || ""); } catch(e) {}
        }

        if (!CONFIG.cloudName || !CONFIG.uploadPreset) {
          $("full-loading").innerHTML = '<div class="err">Cloudinary設定が未登録です</div>';
          return;
        }
        if (checkAuthLocal()) enterApp();
        else showAuth();
      })
      .catch(function(e){
        $("full-loading").innerHTML = '<div class="err">通信エラー<br>' + e.message + '</div>';
      });
  }

  // ================= アップロード =================
  function bindUploadEvents() {
    $("file-input").addEventListener("change", function(e){
      handleFiles(Array.prototype.slice.call(e.target.files));
      e.target.value = "";
    });
    var uz = $("upload-zone");
    uz.addEventListener("dragover", function(e){ e.preventDefault(); uz.classList.add("drag-over"); });
    uz.addEventListener("dragleave", function(){ uz.classList.remove("drag-over"); });
    uz.addEventListener("drop", function(e){
      e.preventDefault(); uz.classList.remove("drag-over");
      handleFiles(Array.prototype.slice.call(e.dataTransfer.files).filter(function(f){ return f.type.indexOf("image/") === 0; }));
    });
    $("delete-mode-btn").addEventListener("click", enterDeleteMode);
    $("settings-btn").addEventListener("click", openSettings);
    $("settings-close-btn").addEventListener("click", closeSettings);
    $("settings-overlay").addEventListener("click", closeSettings);
    // テーマ選択
    var themePicker = $("theme-picker");
    if (themePicker) {
      var currentTheme = localStorage.getItem(THEME_KEY) || "";
      themePicker.querySelectorAll(".theme-dot").forEach(function(dot){
        if (dot.getAttribute("data-theme") === currentTheme) dot.classList.add("active");
        dot.addEventListener("click", function(){
          var theme = dot.getAttribute("data-theme");
          themePicker.querySelectorAll(".theme-dot").forEach(function(d){ d.classList.remove("active"); });
          dot.classList.add("active");
          if (theme) {
            document.documentElement.setAttribute("data-theme", theme);
            localStorage.setItem(THEME_KEY, theme);
          } else {
            document.documentElement.removeAttribute("data-theme");
            localStorage.removeItem(THEME_KEY);
          }
          // サーバーに保存（他人のviewにも反映される）
          gasPost({ action: "save_theme", folder: CONFIG.folder, theme: theme });
        });
      });
    }
    var toggleAutoChara = $("toggle-auto-chara");
    toggleAutoChara.checked = settings.autoChara;
    toggleAutoChara.addEventListener("change", function(){
      settings.autoChara = toggleAutoChara.checked;
      saveSettings(settings);
    });
    $("delete-cancel-btn").addEventListener("click", exitDeleteMode);
    $("delete-exec-btn").addEventListener("click", execDelete);
    bindImageUpload("input-icon", "btn-icon", "preview-icon", "status-icon", "icon");
    bindImageUpload("input-ogp",  "btn-ogp",  "preview-ogp",  "status-ogp",  "ogp");
    $("combine-mode-btn").addEventListener("click", function(){
      combineMode ? exitCombineMode() : enterCombineMode();
    });
    $("combine-cancel-btn").addEventListener("click", exitCombineMode);
    $("combine-exec-btn").addEventListener("click", execCombine);
    $("combine-modal-close").addEventListener("click", closeCombineModal);
    $("combine-overlay").addEventListener("click", function(e){
      if (e.target === $("combine-overlay")) closeCombineModal();
    });
    $("combine-copy-btn").addEventListener("click", function(){
      var text = $("combine-text").textContent;
      navigator.clipboard.writeText(text).then(function(){
        $("combine-copy-btn").textContent = "\u2713 コピーしました";
        setTimeout(function(){ $("combine-copy-btn").textContent = "コーデ名をクリップボードにコピーする"; }, 2000);
      }).catch(function(){
        var ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove();
        $("combine-copy-btn").textContent = "\u2713 コピーしました";
        setTimeout(function(){ $("combine-copy-btn").textContent = "コーデ名をクリップボードにコピーする"; }, 2000);
      });
    });

    $("combine-save-btn").addEventListener("click", function(){
      var src = window._combineCurrentImage;
      if (!src) return;
      var w = window.open();
      if (w) {
        w.document.write([
          '<!DOCTYPE html><html><head>',
          '<meta charset="UTF-8">',
          '<meta name="viewport" content="width=device-width,initial-scale=1.0">',
          '<title>フレカ結合画像</title>',
          '<style>',
          'body{margin:0;background:#fdf4fa;display:flex;flex-direction:column;align-items:center;min-height:100vh;font-family:sans-serif;}',
          '.back-btn{position:fixed;top:12px;left:12px;background:#f9b8d4;color:#fff;border:none;border-radius:20px;padding:8px 18px;font-size:14px;font-weight:700;cursor:pointer;z-index:10;}',
          'img{max-width:100%;height:auto;margin-top:56px;}',
          '</style>',
          '</head><body>',
          '<button class="back-btn" onclick="window.close()">← 戻る</button>',
          '<img src="' + src + '">',
          '</body></html>'
        ].join(""));
        w.document.close();
      }
    });
    $("comment-save-btn").addEventListener("click", function(){
      var comment = $("comment-input").value.trim();
      var status  = $("comment-status");
      status.textContent = "保存中…";
      status.style.color = "#aaa";
      gasPost({ action: "save_comment", folder: CONFIG.folder, comment: comment })
        .then(function(data){
          if (data.status === "ok") {
            status.textContent = "✓ 保存しました";
            status.style.color = "#4caf50";
            try { localStorage.setItem(COMMENT_KEY, comment); } catch(e) {}
          } else {
            status.textContent = "エラー";
            status.style.color = "#e06f6f";
          }
        }).catch(function(){
          status.textContent = "通信エラー";
          status.style.color = "#e06f6f";
        });
    });
    $("edit-search").addEventListener("input", function(e){
      searchQ = e.target.value;
      pendingPage = 1; donePage = 1;
      updateSections();
    });
    $("filter-pending-btn").addEventListener("click", function(){
      filterPending = !filterPending;
      $("filter-pending-btn").classList.toggle("active", filterPending);
      pendingPage = 1; donePage = 1;
      updateSections();
    });
  }

  // ===== Canvas経由でPNG変換 → base64 =====
  function convertToPngBase64(file) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      var objUrl = URL.createObjectURL(file);
      img.onload = function() {
        var canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        URL.revokeObjectURL(objUrl);
        var dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = function() { URL.revokeObjectURL(objUrl); reject(new Error("画像読み込み失敗")); };
      img.src = objUrl;
    });
  }

  function bindImageUpload(inputId, btnId, previewId, statusId, imageType) {
    var input   = document.getElementById(inputId);
    var btn     = document.getElementById(btnId);
    var preview = document.getElementById(previewId);
    var status  = document.getElementById(statusId);
    var base64  = null;

    input.addEventListener("change", function(e) {
      var file = e.target.files[0];
      if (!file) return;
      status.textContent = "変換中…";
      status.style.color = "#aaa";
      btn.disabled = true;
      convertToPngBase64(file).then(function(b64) {
        base64 = b64;
        preview.src = "data:image/png;base64," + b64;
        btn.disabled = false;
        status.textContent = "選択済み（アップロードボタンで確定）";
        status.style.color = "#999";
      }).catch(function(err) {
        status.textContent = "変換失敗: " + err.message;
        status.style.color = "#e06f6f";
      });
    });

    btn.addEventListener("click", function() {
      if (!base64) return;
      btn.disabled = true;
      status.textContent = "アップロード中…";
      status.style.color = "#aaa";
      gasPost({
        action:     "upload_image",
        folderName: CONFIG.folder,
        imageType:  imageType,
        base64:     base64,
      }).then(function(data) {
        if (data.status === "ok") {
          status.textContent = "✓ アップロード完了";
          status.style.color = "#4caf50";
          showToast(imageType === "icon" ? "アイコンを更新しました" : "OGP画像を更新しました");
        } else {
          status.textContent = "エラー: " + (data.message || "失敗");
          status.style.color = "#e06f6f";
          btn.disabled = false;
        }
      }).catch(function() {
        status.textContent = "通信エラー";
        status.style.color = "#e06f6f";
        btn.disabled = false;
      });
    });
  }

  function trimByQR(blob) {
    return new Promise(function(resolve){
      var img = new Image();
      var objUrl = URL.createObjectURL(blob);
      img.onload = function(){
        try {
          var canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(objUrl);
          var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          var qr = (typeof jsQR === "function") ? jsQR(imageData.data, imageData.width, imageData.height) : null;
          if (!qr) { resolve(blob); return; }
          var ys = [qr.location.topLeftCorner.y, qr.location.topRightCorner.y, qr.location.bottomLeftCorner.y, qr.location.bottomRightCorner.y];
          var qrTop = Math.min.apply(null, ys), qrBottom = Math.max.apply(null, ys);
          var qrHeight = qrBottom - qrTop;
          var newTop = Math.max(0, Math.round(qrTop - qrHeight * 2.6));
          var newBottom = Math.min(canvas.height, Math.round(qrBottom + qrHeight * 0.6));
          var cropH = newBottom - newTop;
          if (cropH <= 0) { resolve(blob); return; }
          var out = document.createElement("canvas");
          out.width = canvas.width; out.height = cropH;
          out.getContext("2d").drawImage(canvas, 0, newTop, canvas.width, cropH, 0, 0, canvas.width, cropH);
          out.toBlob(function(b){ resolve(b || blob); }, "image/webp", 0.92);
        } catch (err) { resolve(blob); }
      };
      img.onerror = function(){ URL.revokeObjectURL(objUrl); resolve(blob); };
      img.src = objUrl;
    });
  }

  function uploadToCloudinary(blob, filename) {
    var fd = new FormData();
    fd.append("file", blob, filename);
    fd.append("upload_preset", CONFIG.uploadPreset);
    fd.append("folder", CONFIG.folder);
    return fetch("https://api.cloudinary.com/v1_1/" + CONFIG.cloudName + "/image/upload", { method: "POST", body: fd })
      .then(function(res){
        if (!res.ok) throw new Error("Cloudinary " + res.status);
        return res.json();
      })
      .then(function(data){
        if (!data.secure_url) throw new Error("URLなし");
        return data.secure_url.replace("/upload/", "/upload/c_crop,g_center,h_1800,w_1100,q_auto,f_auto/");
      });
  }

  function saveCard(card) {
    return gasPostFire({
      action: "save", folder: CONFIG.folder,
      url: card.url || "", charaName: card.charaName || "", codeName: card.codeName || "",
    });
  }

  function saveCardWithStatus(card) {
    if (!card.url) return;
    var statusEl = $("save-status-" + card.id);
    if (statusEl) { statusEl.textContent = "保存中…"; statusEl.className = "save-status"; }
    saveCard(card).then(function(){
      if (statusEl) { statusEl.textContent = "✓ 保存しました"; statusEl.className = "save-status ok"; }
    }).catch(function(){
      if (statusEl) { statusEl.textContent = "保存失敗"; statusEl.className = "save-status err"; }
    });
  }

  function openSettings() {
    // コンテンツエリアの右端に合わせてパネルを配置
    var bodyRect = document.body.getBoundingClientRect();
    var panelRight = Math.max(0, window.innerWidth - bodyRect.right);
    $("settings-panel").style.right = panelRight + "px";
    $("settings-overlay").classList.add("open");
    $("settings-panel").classList.add("open");
  }
  function closeSettings() {
    $("settings-overlay").classList.remove("open");
    $("settings-panel").classList.remove("open");
  }

  var PARALLEL = 5; // 同時アップロード数
  var isUploading = false;

  // 画面離脱防止
  function onBeforeUnload(e) {
    e.preventDefault();
    e.returnValue = "";
  }
  function lockPage()   { isUploading = true;  window.addEventListener("beforeunload", onBeforeUnload); }
  function unlockPage() { isUploading = false; window.removeEventListener("beforeunload", onBeforeUnload); }

  function handleFiles(files) {
    if (!files.length) return;
    if (isUploading) { showToast("アップロード中です。完了をお待ちください"); return; }

    var pw = $("progress-wrap"), pb = $("progress-bar"), pl = $("progress-label");
    var warn = document.createElement("div");
    warn.id = "upload-warn";
    warn.style.cssText = "font-size:11px;color:#e06f6f;text-align:center;padding:6px 12px;";
    warn.textContent = "アップロード中です。この画面を離れないでください";
    pw.parentNode.insertBefore(warn, pw.nextSibling);

    pw.classList.add("show");
    var done = 0, total = files.length;
    pl.textContent = "アップロード中… 0 / " + total;
    pb.style.width = "0%";
    lockPage();

    // カードを先に全部生成
    var cards = Array.prototype.slice.call(files).map(function(file){
      var id = "new-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      var lastChara = "";
      try { if (settings.autoChara) lastChara = localStorage.getItem(LAST_CHARA_KEY) || ""; } catch(e) {}
      var card = { id: id, blob: null, url: null, charaName: lastChara, codeName: "", status: "uploading", file: file };
      cardMap[id] = card;
      renderCard(card);
      return card;
    });
    updateSections();

    // PARALLEL枚ずつ並列処理
    function processCard(card) {
      return trimByQR(card.file)
        .then(function(trimmed){
          card.blob = trimmed;
          return uploadToCloudinary(trimmed, card.file.name);
        })
        .then(function(url){
          card.url = url; card.status = "done";
          return saveCard(card).catch(function(){});
        })
        .catch(function(err){
          card.status = "error";
          console.error("upload error", card.file.name, err);
        })
        .then(function(){
          done++;
          pl.textContent = "アップロード中… " + done + " / " + total;
          pb.style.width = (done / total * 100) + "%";
          updateCardImage(card); updateCardBadge(card); updateCardStyle(card);
          moveCardToSection(card); updateSections();
        });
    }

    // キューを PARALLEL 並列で処理
    var queue = cards.slice();
    var active = 0;
    var resolve;
    var allDone = new Promise(function(r){ resolve = r; });

    function next() {
      while (active < PARALLEL && queue.length) {
        active++;
        var card = queue.shift();
        processCard(card).then(function(){
          active--;
          if (queue.length) { next(); }
          else if (active === 0) { resolve(); }
        });
      }
    }
    next();

    allDone.then(function(){
      pw.classList.remove("show");
      var w = $("upload-warn");
      if (w) w.remove();
      unlockPage();
      showToast(total + "枚アップロード完了");
    });
  }

  // ================= 既存データ =================
  function loadExistingCards() {
    fetch(CONFIG.gasUrl + "?folder=" + encodeURIComponent(CONFIG.folder))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === "ok" && data.rows && data.rows.length) {
          data.rows.slice().reverse().forEach(function(row){
            var card = {
              id: "exist-" + Math.random().toString(36).slice(2),
              blob: null, url: row.url,
              charaName: row.chara || "", codeName: row.code || "",
              status: "done",
            };
            cardMap[card.id] = card;
          });
        }
      })
      .catch(function(e){ console.warn("既存データ取得失敗", e); })
      .then(function(){
        $("loading-sheet").style.display = "none";
        updateSections();
      });
  }

  // ================= カード描画 =================
  function renderCard(card) {
    var wrap = document.createElement("div");
    wrap.className = "card-wrap"; wrap.id = "wrap-" + card.id;

    var check = document.createElement("div");
    check.className = "card-check"; check.id = "check-" + card.id;
    check.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    wrap.appendChild(check);

    var el = document.createElement("div");
    el.className = "card"; el.id = "card-" + card.id;

    var imgWrap = document.createElement("div");
    imgWrap.className = "card-img"; imgWrap.id = "img-wrap-" + card.id;
    setCardImage(imgWrap, card);
    el.appendChild(imgWrap);

    var body = document.createElement("div");
    body.className = "card-body";
    body.appendChild(makeInputRow("キャラ名", "chara-" + card.id, "例：ゆいしょ", card.charaName));
    body.appendChild(makeInputRow("コーデ名", "code-" + card.id, "コーデ名を入力", card.codeName));
    var ss = document.createElement("div");
    ss.className = "save-status"; ss.id = "save-status-" + card.id;
    body.appendChild(ss);
    el.appendChild(body);
    wrap.appendChild(el);

    // 入力イベント
    var charaInput = body.querySelector("#chara-" + card.id);
    var codeInput  = body.querySelector("#code-" + card.id);
    charaInput.addEventListener("input", function(){ card.charaName = charaInput.value.trim(); updateCardBadge(card); updateCardStyle(card); });
    codeInput.addEventListener("input",  function(){ card.codeName  = codeInput.value.trim();  updateCardBadge(card); updateCardStyle(card); });
    charaInput.addEventListener("blur", function(){
      card.charaName = charaInput.value.trim();
      if (card.charaName && settings.autoChara) {
        try { localStorage.setItem(LAST_CHARA_KEY, card.charaName); } catch(e) {}
      }
      afterEdit(card);
    });
    codeInput.addEventListener("blur", function(){ card.codeName = codeInput.value.trim(); afterEdit(card); });

    // 長押し削除モード + 選択
    var pressTimer;
    wrap.addEventListener("pointerdown", function(){ if (deleteMode) return; pressTimer = setTimeout(enterDeleteMode, 600); });
    ["pointerup","pointermove","pointercancel","pointerleave"].forEach(function(ev){ wrap.addEventListener(ev, function(){ clearTimeout(pressTimer); }); });
    wrap.addEventListener("click", function(e){
      if (deleteMode) { e.preventDefault(); toggleSelect(card); }
      else if (combineMode) { e.preventDefault(); toggleCombineSelect(card.id); }
    });

    updateCardBadge(card); updateCardStyle(card);

    // bodyに仮追加（非表示）→ updateSectionsがグリッドに配置する
    wrap.style.display = "none";
    document.body.appendChild(wrap);
  }

  function makeInputRow(label, id, ph, val) {
    var row = document.createElement("div"); row.className = "input-row";
    var lab = document.createElement("div"); lab.className = "input-label"; lab.textContent = label;
    var inp = document.createElement("input");
    inp.className = "input-field"; inp.id = id; inp.type = "text"; inp.placeholder = ph; inp.value = val || "";
    row.appendChild(lab); row.appendChild(inp);
    return row;
  }

  function setCardImage(imgWrap, card) {
    imgWrap.innerHTML = "";
    if (card.url || card.blob) {
      var img = document.createElement("img");
      img.alt = "";
      img.onload = function(){ img.classList.add("loaded"); };
      if (card.blob) {
        img.src = URL.createObjectURL(card.blob);
      } else {
        // data-srcに保持し、updateSectionsで表示時にsrcをセットする
        img.dataset.src = thumbUrl(card.url);
      }
      imgWrap.appendChild(img);
    } else {
      var ni = document.createElement("div");
      ni.className = "no-img";
      ni.innerHTML = HEART_ICO_SMALL;
      imgWrap.appendChild(ni);
    }
    if (card.status === "uploading") {
      var ov = document.createElement("div");
      ov.className = "uploading-overlay"; ov.id = "overlay-" + card.id;
      ov.innerHTML = '<span class="spin"></span>';
      imgWrap.appendChild(ov);
    }
    var badge = document.createElement("div");
    badge.className = "card-status-badge"; badge.id = "badge-" + card.id;
    imgWrap.appendChild(badge);
  }

  function updateCardImage(card) {
    var imgWrap = $("img-wrap-" + card.id);
    if (imgWrap) setCardImage(imgWrap, card);
    updateCardBadge(card);
  }

  function afterEdit(card) {
    updateCardBadge(card); updateCardStyle(card);
    moveCardToSection(card); updateSections();
    saveCardWithStatus(card);
  }

  function updateCardBadge(card) {
    var badge = $("badge-" + card.id);
    if (!badge) return;
    var complete = !!(card.charaName && card.codeName);
    if (card.status === "error") { badge.textContent = "エラー"; badge.className = "card-status-badge error"; }
    else if (card.status === "uploading") { badge.textContent = ""; badge.className = "card-status-badge"; }
    else if (complete) { badge.textContent = "登録済"; badge.className = "card-status-badge done"; }
    else { badge.textContent = "未入力"; badge.className = "card-status-badge"; }
  }

  function updateCardStyle(card) {
    var el = $("card-" + card.id);
    if (!el) return;
    var complete = !!(card.charaName && card.codeName);
    el.className = "card " + (card.status === "error" ? "error" : complete ? "complete" : "incomplete");
    if (selectedIds[card.id]) el.classList.add("selected");
  }

  function moveCardToSection(card) {
    // updateSectionsで一括管理するため何もしない
  }

  function matchCard(card) {
    if (filterPending && (card.charaName && card.codeName)) return false;
    var q = String(searchQ || "").trim();
    if (!q) return true;
    q = q.toLowerCase();
    return String(card.codeName || "").toLowerCase().indexOf(q) !== -1;
  }

  window.__editPendingGo = function(p){ pendingPage = p; updateSections(); window.scrollTo({top:0,behavior:"smooth"}); };
  window.__editDoneGo    = function(p){ donePage = p;    updateSections(); window.scrollTo({top:0,behavior:"smooth"}); };

  function renderPagEdit(containerId, total, currentPage, fnName) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (total <= 1) { el.innerHTML = ""; return; }
    var p = currentPage;
    var html = '<button class="pg-btn arrow" ' + (p===1?"disabled":"") + ' onclick="' + fnName + '(' + (p-1) + ')">‹</button>';
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
      else html += '<button class="pg-btn' + (v===p?" active":"") + '" onclick="' + fnName + '(' + v + ')">' + v + '</button>';
    });
    html += '<button class="pg-btn arrow" ' + (p===total?"disabled":"") + ' onclick="' + fnName + '(' + (p+1) + ')">›</button>';
    el.innerHTML = html;
  }

  function updateSections() {
    var allCards = Object.keys(cardMap).map(function(id){ return cardMap[id]; });

    // セクション別に分類（検索・フィルター適用）
    var pendingAll = allCards.filter(function(c){
      return (!(c.charaName && c.codeName) || c.status === "error") && matchCard(c);
    });
    var doneAll = allCards.filter(function(c){
      return !!(c.charaName && c.codeName) && c.status !== "error" && matchCard(c);
    });

    // ページ計算
    var pTotal = Math.max(1, Math.ceil(pendingAll.length / PAGE_SIZE_EDIT));
    var dTotal = Math.max(1, Math.ceil(doneAll.length / PAGE_SIZE_EDIT));
    if (pendingPage > pTotal) pendingPage = 1;
    if (donePage > dTotal) donePage = 1;

    var pendingVisible = pendingAll.slice((pendingPage-1)*PAGE_SIZE_EDIT, pendingPage*PAGE_SIZE_EDIT);
    var doneVisible    = doneAll.slice((donePage-1)*PAGE_SIZE_EDIT, donePage*PAGE_SIZE_EDIT);
    var visibleIds = {};
    pendingVisible.concat(doneVisible).forEach(function(c){ visibleIds[c.id] = true; });

    // グリッドを一旦クリアして再構築
    var pg = $("pending-grid");
    var dg = $("done-grid");
    pg.innerHTML = "";
    dg.innerHTML = "";

    pendingVisible.forEach(function(c){
      var wrap = document.getElementById("wrap-" + c.id);
      if (!wrap) renderCard(c);
      wrap = document.getElementById("wrap-" + c.id);
      if (wrap) { wrap.style.display = ""; pg.appendChild(wrap); }
    });
    doneVisible.forEach(function(c){
      var wrap = document.getElementById("wrap-" + c.id);
      if (!wrap) renderCard(c);
      wrap = document.getElementById("wrap-" + c.id);
      if (wrap) { wrap.style.display = ""; dg.appendChild(wrap); }
    });

    // 表示カードの画像を読み込む
    pendingVisible.concat(doneVisible).forEach(function(c){
      var img = document.querySelector("#img-wrap-" + c.id + " img[data-src]");
      if (img && !img.dataset.loaded) {
        img.src = img.dataset.src;
        img.dataset.loaded = "1";
      }
    });

    $("pending-section").style.display = pendingAll.length ? "" : "none";
    $("done-section").style.display    = (!filterPending && doneAll.length) ? "" : "none";
    $("pending-badge").textContent = pendingAll.length;
    $("done-badge").textContent    = doneAll.length;
    $("empty-state").style.display = (!pendingAll.length && !doneAll.length) ? "" : "none";

    // ページネーション描画
    if (!document.getElementById("pending-pagination")) {
      var pp = document.createElement("div");
      pp.id = "pending-pagination"; pp.className = "pagination";
      $("pending-section").appendChild(pp);
    }
    if (!document.getElementById("done-pagination")) {
      var dp = document.createElement("div");
      dp.id = "done-pagination"; dp.className = "pagination";
      $("done-section").appendChild(dp);
    }
    renderPagEdit("pending-pagination", pTotal, pendingPage, "__editPendingGo");
    renderPagEdit("done-pagination",    dTotal, donePage,    "__editDoneGo");
  }

  // ================= 削除モード =================
  function enterDeleteMode() {
    deleteMode = true; selectedIds = {}; selectedCount = 0;
    $("delete-bar").classList.add("show");
    $("delete-mode-btn").style.display = "none";
    $("upload-zone").style.display = "none";
    $("pending-grid").classList.add("delete-mode");
    $("done-grid").classList.add("delete-mode");
    updateDeleteBar();
  }
  function exitDeleteMode() {
    deleteMode = false; selectedIds = {}; selectedCount = 0;
    $("delete-bar").classList.remove("show");
    $("delete-mode-btn").style.display = "";
    $("upload-zone").style.display = "";
    $("pending-grid").classList.remove("delete-mode");
    $("done-grid").classList.remove("delete-mode");
    Object.keys(cardMap).forEach(function(id){
      var el = $("card-" + id), ck = $("check-" + id);
      if (el) el.classList.remove("selected");
      if (ck) ck.classList.remove("checked");
    });
  }
  function toggleSelect(card) {
    var el = $("card-" + card.id), ck = $("check-" + card.id);
    if (selectedIds[card.id]) {
      delete selectedIds[card.id]; selectedCount--;
      if (el) el.classList.remove("selected");
      if (ck) ck.classList.remove("checked");
    } else {
      selectedIds[card.id] = true; selectedCount++;
      if (el) el.classList.add("selected");
      if (ck) ck.classList.add("checked");
    }
    updateDeleteBar();
  }
  function updateDeleteBar() {
    $("delete-bar-label").textContent = selectedCount + "件選択中";
    $("delete-exec-btn").disabled = selectedCount === 0;
  }
  function execDelete() {
    if (!selectedCount) return;
    var ids = Object.keys(selectedIds);
    var urls = ids.map(function(id){ return cardMap[id] && cardMap[id].url; }).filter(Boolean);
    var btn = $("delete-exec-btn");
    btn.disabled = true; btn.textContent = "削除中";
    gasPostFire({ action: "delete", folder: CONFIG.folder, urls: urls })
      .then(function(){
        ids.forEach(function(id){
          var wrap = $("wrap-" + id);
          if (wrap) wrap.remove();
          delete cardMap[id];
        });
        exitDeleteMode(); updateSections();
        showToast("削除しました");
      })
      .catch(function(){
        btn.disabled = false; btn.textContent = "削除";
        showToast("削除に失敗しました");
      });
  }

  // ================= 結合モード =================
  function enterCombineMode() {
    if (deleteMode) return;
    combineMode = true;
    combineSelected = [];
    $("combine-bar").classList.add("show");
    $("combine-mode-btn").classList.add("active");
    $("delete-mode-btn").style.display = "none";
    $("upload-zone").style.display = "none";
    updateCombineBar();
  }

  function exitCombineMode() {
    combineMode = false;
    combineSelected = [];
    $("combine-bar").classList.remove("show");
    $("combine-mode-btn").classList.remove("active");
    $("delete-mode-btn").style.display = "";
    $("upload-zone").style.display = "";
    document.querySelectorAll(".card.combine-selected").forEach(function(el){
      el.classList.remove("combine-selected");
    });
  }

  function toggleCombineSelect(cardId) {
    var card = cardMap[cardId];
    if (!card || !card.url) return;
    var el = $("card-" + cardId);
    var idx = -1;
    for (var i = 0; i < combineSelected.length; i++) {
      if (combineSelected[i].id === cardId) { idx = i; break; }
    }
    if (idx !== -1) {
      combineSelected.splice(idx, 1);
      if (el) el.classList.remove("combine-selected");
    } else {
      if (combineSelected.length >= MAX_COMBINE) {
        showToast("最大" + MAX_COMBINE + "枚まで選べます");
        return;
      }
      combineSelected.push(card);
      if (el) el.classList.add("combine-selected");
    }
    updateCombineBar();
  }

  function updateCombineBar() {
    var n = combineSelected.length;
    $("combine-bar-label").textContent = n + " / " + MAX_COMBINE + " 枚選択中";
    $("combine-exec-btn").disabled = n < 2;
  }

  function closeCombineModal() {
    $("combine-overlay").classList.remove("open");
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
  }

  function getGrid(n) {
    if (n <= 2) return { cols: 2, rows: 1 };
    if (n <= 4) return { cols: 2, rows: 2 };
    if (n <= 6) return { cols: 3, rows: 2 };
    return { cols: 4, rows: 2 };
  }

  function loadZenMaruFont() {
    if (window._zenMaruLoaded) return Promise.resolve();
    return new FontFace(
      "Zen Maru Gothic",
      "url(https://fonts.gstatic.com/s/zenmarugothic/v14/o-0XIpIxzW5b-RxT-6A8jWAtCp-cQmbNNy7wfg.woff2)"
    ).load().then(function(f){
      document.fonts.add(f);
      window._zenMaruLoaded = true;
    }).catch(function(){});
  }

  function execCombine() {
    if (combineSelected.length < 2) return;
    var items = combineSelected.slice();
    var grid = getGrid(items.length);
    var CARD_W = 1100;
    var CARD_H = 1800;
    // ★ 文字の大きさ：CARD_W / 20 = 55px。分母を小さくすると大きく、大きくすると小さくなる ★
    var fontSize = Math.round(CARD_W / 20);

    $("combine-exec-btn").disabled = true;
    $("combine-exec-btn").textContent = "生成中…";

    loadZenMaruFont().then(function(){
      var promises = items.map(function(card){
        return new Promise(function(resolve){
          var img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = function(){ resolve(img); };
          img.onerror = function(){ resolve(null); };
          img.src = card.url.replace(/\/upload\/[^/]*\//, "/upload/c_fill,g_center,w_1100,h_1800,q_auto,f_png/");
        });
      });

      Promise.all(promises).then(function(imgs){
        var canvas = document.createElement("canvas");
        canvas.width  = CARD_W * grid.cols;
        canvas.height = CARD_H * grid.rows;
        var ctx = canvas.getContext("2d");

        ctx.fillStyle = "#f9b8d4";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = "bold " + fontSize + "px 'Zen Maru Gothic', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        items.forEach(function(card, i){
          var col = i % grid.cols;
          var row = Math.floor(i / grid.cols);
          var x = col * CARD_W;
          var y = row * CARD_H;
          var img = imgs[i];
          if (img) {
            ctx.drawImage(img, x, y, CARD_W, CARD_H);
          }
          var text = String(card.codeName || "");
          if (text) {
            // ★ 白塗り範囲の調整：上端と下端を0.0〜1.0で指定（0.0=カード上端、1.0=カード下端）★
            // 例）0.80〜0.95 → 下の方15%を白塗り / 0.30〜0.50 → 中央あたりを白塗り
            var WHITE_FROM = 0.5;  // ★ 白塗り開始位置（上から何%）★
            var WHITE_TO   = 0.6;  // ★ 白塗り終了位置（上から何%）★
            var whiteY = y + Math.round(CARD_H * WHITE_FROM);
            var whiteH = Math.round(CARD_H * (WHITE_TO - WHITE_FROM));
            // ★ 白塗りの透明度：1 = 完全不透明。0.0で完全透明、1.0で完全不透明 ★
            ctx.fillStyle = "rgba(255,255,255,1)";
            ctx.fillRect(x, whiteY, CARD_W, whiteH);

            // 15文字ごとに改行
            var lines = [];
            // ▼ 改行文字数の調整はここ（12文字で改行）
            // ★ 改行する文字数：12文字ごとに改行 ★
            for (var ci = 0; ci < text.length; ci += 12) {
              lines.push(text.substring(ci, ci + 12));
            }

            ctx.font = "bold " + fontSize + "px 'Zen Maru Gothic', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            // ★ 文字サイズはfontSize、行間はlineH、配置位置はstartYで調整 ★
            var lineH = fontSize * 1.4;
            var totalTextH = lineH * lines.length;
            var startY = whiteY + (whiteH - totalTextH) / 2 + lineH / 2;
            var tx = x + CARD_W / 2;

            lines.forEach(function(line, li){
              var ty = startY + li * lineH;
              // 縁取り（濃いピンク）
              // ★ 文字の縁取り色：#f9b8d4（ピンク）。縁の太さはlineWidth ★
              ctx.strokeStyle = "#f9b8d4";
              ctx.lineWidth = fontSize * 0.2;
              ctx.lineJoin = "round";
              ctx.strokeText(line, tx, ty);
              // 白文字
              // ★ 文字の色：#ffffff（白） ★
              ctx.fillStyle = "#ffffff";
              ctx.fillText(line, tx, ty);
            });
          }
        });

        var dataUrl = canvas.toDataURL("image/png");

        var combineImg = document.createElement("img");
        combineImg.src = dataUrl;
        combineImg.style.cssText = "max-width:100%;max-height:50vh;object-fit:contain;display:block;border-radius:8px;margin:0 auto;";
        var wrap = $("combine-img-wrap");
        wrap.innerHTML = "";
        wrap.appendChild(combineImg);

        var codeNames = items.map(function(c){ return String(c.codeName || "（未入力）"); }).join("\n");
        $("combine-text").textContent = codeNames;

        window._combineCurrentImage = dataUrl;
        $("combine-overlay").classList.add("open");
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.width = "100%";

        exitCombineMode();
        $("combine-exec-btn").textContent = "結合する";
      });
    });
  }

  function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  var HEART_ICO_SMALL = '<svg width="22" height="22" viewBox="0 0 24 24" fill="#f9b8d4" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

  // jsQR を動的ロードしてから起動
  var s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
  s.onload = boot;
  s.onerror = boot; // QRなしでも起動はする
  document.head.appendChild(s);
})();
