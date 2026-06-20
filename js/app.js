(function(){
const DAYS = ["\u65E5","\u4E00","\u4E8C","\u4E09","\u56DB","\u4E94","\u516D"];
const WEEKDAYS = ["\u4E00","\u4E8C","\u4E09","\u56DB","\u4E94","\u516D","\u65E5"];

let curYear, curMonth;
let selectedDate = null;
let currentEntry = null;
let editingDate = null;
let state = { mood: "", location: "", text: "", photos: [], shopping: [] };

function fmt(d) {
  const y = d.getFullYear(), m = d.getMonth()+1, dd = d.getDate();
  return y + "-" + (m<10?"0":"") + m + "-" + (dd<10?"0":"") + dd;
}
function parseDate(s) {
  const p = s.split("-");
  return new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
}

function renderCalendar(year, month) {
  curYear = year; curMonth = month;
  const g = document.getElementById("calendarGrid");
  g.innerHTML = "";
  document.getElementById("monthTitle").textContent = year + " \u5E74 " + (month+1) + " \u6708";
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay() || 7;
  const daysInMonth = last.getDate();
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i > 0; i--) {
    const d = document.createElement("div");
    d.className = "day-cell other-month";
    const n = document.createElement("span");
    n.className = "day-num";
    n.textContent = prevLast - i + 1;
    d.appendChild(n);
    g.appendChild(d);
  }
  const today = new Date();
  const todayStr = fmt(today);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = year + "-" + (month+1<10?"0":"") + (month+1) + "-" + (d<10?"0":"") + d;
    const dv = document.createElement("div");
    dv.className = "day-cell";
    dv.dataset.date = dateStr;
    if (dateStr === todayStr) dv.classList.add("today");
    if (dateStr === selectedDate) dv.classList.add("selected");
    const nm = document.createElement("span");
    nm.className = "day-num";
    nm.textContent = d;
    dv.appendChild(nm);
    dv.addEventListener("click", () => selectDay(dateStr));
    g.appendChild(dv);
  }
  const totalCells = (startDow || 7) - 1 + daysInMonth;
  const rem = 7 - (totalCells % 7 === 0 ? 7 : totalCells % 7);
  for (let i = 1; i <= (rem === 7 ? 0 : rem); i++) {
    const d = document.createElement("div");
    d.className = "day-cell other-month";
    const n = document.createElement("span");
    n.className = "day-num";
    n.textContent = i;
    d.appendChild(n);
    g.appendChild(d);
  }
  refreshDots();
}

function refreshDots() {
  DB.getAllEntries().then(entries => {
    const dots = {};
    entries.forEach(e => { dots[e.date] = e; });
    document.querySelectorAll(".day-cell:not(.other-month)").forEach(cell => {
      cell.querySelector(".dots")?.remove();
      const ds = cell.dataset.date;
      const e = dots[ds];
      if (e) {
        const ind = document.createElement("div");
        ind.className = "dots";
        if (e.text && e.text.trim()) { const s = document.createElement("span"); s.className = "d-entry"; ind.appendChild(s); }
        if (e.photos && e.photos.length) { const s = document.createElement("span"); s.className = "d-photo"; ind.appendChild(s); }
        if (e.shopping && e.shopping.length) { const s = document.createElement("span"); s.className = "d-shop"; ind.appendChild(s); }
        cell.appendChild(ind);
      }
    });
  });
}

function selectDay(dateStr) {
  selectedDate = dateStr;
  document.querySelectorAll(".day-cell.selected").forEach(e => e.classList.remove("selected"));
  document.querySelector('.day-cell[data-date="'+dateStr+'"]')?.classList.add("selected");
  document.getElementById("statText").textContent = dateStr;
  loadEntry(dateStr);
  if (window.innerWidth < 768) {
    document.getElementById("rightPanel").classList.add("open");
  }
}

function showDateInfo(dateStr) {
  const d = parseDate(dateStr);
  const wd = d.getDay();
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(),0,0)) / 86400000);
  document.getElementById("entryDate").textContent = (d.getMonth()+1) + "\u6708 " + d.getDate() + "\u65E5 \u00B7 \u661F\u671F" + DAYS[wd];
  document.getElementById("entrySub").textContent = "\u7B2C" + Math.ceil((dayOfYear+1)/7) + "\u5468 \u00B7 \u4E00\u5E74\u4E2D\u7B2C" + dayOfYear + "\u5929";
}

async function loadEntry(dateStr) {
  showDateInfo(dateStr);
  currentEntry = await DB.getEntry(dateStr);
  const ec = document.getElementById("entryContent");
  const es = document.getElementById("emptyState");
  if (!currentEntry) {
    es.style.display = "flex";
    ec.style.display = "none";
    return;
  }
  es.style.display = "none";
  ec.style.display = "block";
  const mood = document.getElementById("moodDisplay");
  const moodVal = currentEntry.mood;
  mood.textContent = moodVal ? moodVal + " " + ({"\u{1F60A}":"\u6109\u60A6","\u{1F60C}":"\u5E73\u9759","\u{1F642}":"\u8FD8\u884C","\u{1F614}":"\u4F4E\u843D","\u{1F620}":"\u70E6\u8E81","\u{1F4AA}":"\u5143\u6C14","\u{1F929}":"\u611F\u52A8"}[moodVal] || "") : "\u8BB0\u5F55\u5FC3\u60C5";
  const loc = document.getElementById("locationDisplay");
  loc.textContent = currentEntry.location ? "\u{1F4CD} " + currentEntry.location : "\u8BB0\u5F55\u4F4D\u7F6E";
  const di = document.getElementById("diaryDisplay");
  di.textContent = currentEntry.text || "";
  renderPhotos(currentEntry.photos || [], "photoDisplay", false);
  renderShopping(currentEntry.shopping || [], "shoppingDisplay", false);
  document.getElementById("editBtn").onclick = () => openEdit(dateStr);
}

function renderPhotos(photos, containerId, deletable) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = "";
  photos.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "photo-thumb";
    const img = document.createElement("img");
    img.src = p;
    div.appendChild(img);
    if (deletable) {
      const del = document.createElement("button");
      del.className = "photo-del";
      del.textContent = "\u00D7";
      del.onclick = (ev) => { ev.stopPropagation(); state.photos.splice(i,1); renderPhotos(state.photos, "photoGrid", true); };
      div.appendChild(del);
    }
    c.appendChild(div);
  });
  if (deletable) {
    const addBtn = document.createElement("div");
    addBtn.className = "photo-add-btn";
    addBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>\u6DFB\u52A0\u7167\u7247</span>';
    addBtn.onclick = () => document.getElementById("photoInput").click();
    c.appendChild(addBtn);
  }
}

function renderShopping(items, containerId, deletable) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = "";
  if (!items || !items.length) {
    if (containerId === "shoppingDisplay") {
      c.innerHTML = "<div style=\"font-size:13px;color:var(--text-light);padding:4px 0;\">\u6CA1\u6709\u8D2D\u7269\u8BB0\u5F55</div>";
    }
    return;
  }
  items.forEach((item, i) => {
    const div = document.createElement("div");
    div.className = "shop-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = item.done || false;
    cb.onchange = () => {
      state.shopping[i].done = cb.checked;
      if (containerId === "shoppingDisplay") renderShopping(state.shopping, "shoppingDisplay", false);
    };
    div.appendChild(cb);
    const txt = document.createElement("span");
    txt.className = "shop-text" + (item.done ? " done" : "");
    txt.textContent = item.text;
    div.appendChild(txt);
    if (deletable) {
      const del = document.createElement("button");
      del.className = "shop-del";
      del.textContent = "\u00D7";
      del.onclick = () => { state.shopping.splice(i,1); renderShopping(state.shopping, "shopList", true); };
      div.appendChild(del);
    }
    c.appendChild(div);
  });
}

function openEdit(dateStr) {
  editingDate = dateStr;
  document.getElementById("modalTitle").textContent = "\u270E \u7F16\u8F91 " + dateStr;
  document.getElementById("editModal").style.display = "flex";
  const entry = currentEntry || {};
  state = {
    mood: entry.mood || "",
    location: entry.location || "",
    text: entry.text || "",
    photos: entry.photos ? [...entry.photos] : [],
    shopping: entry.shopping ? entry.shopping.map(s => ({...s})) : []
  };
  document.querySelectorAll("#moodPicker button").forEach(b => {
    b.classList.toggle("active", b.dataset.mood === state.mood);
  });
  document.getElementById("locationInput").value = state.location || "";
  document.getElementById("diaryInput").value = state.text || "";
  renderPhotos(state.photos, "photoGrid", true);
  renderShopping(state.shopping, "shopList", true);
}

function closeEdit() {
  document.getElementById("editModal").style.display = "none";
}

// ---- ���� + ͬ�����ƶ� ----
async function saveEntry() {
  state.text = document.getElementById("diaryInput").value;
  state.location = document.getElementById("locationInput").value;
  document.querySelectorAll("#moodPicker button").forEach(b => {
    if (b.classList.contains("active")) state.mood = b.dataset.mood;
  });
  const entry = {
    date: editingDate,
    mood: state.mood,
    location: state.location,
    text: state.text,
    photos: state.photos,
    shopping: state.shopping
  };
    const cloudSyncOk = await DB.saveAndSync(entry);
    closeEdit();
    selectDay(editingDate);
    renderCalendar(curYear, curMonth);
    showToast(cloudSyncOk ? '\u2714\uFE0F \u5DF2\u4FDD\u5B58\u5E76\u540C\u6B65' : '\u2714\uFE0F \u5DF2\u4FDD\u5B58\u672C\u5730');\n      // \u81EA\u52A8\u4ECE\u4E91\u7AEF\u62C9\u53D6\u5176\u4ED6\u8BBE\u5907\u7684\u6570\u636E\n      DB.syncFromCloud().then(cnt => { if (cnt > 0) { renderCalendar(curYear, curMonth); if (selectedDate) loadEntry(selectedDate); } });
}

function showToast(msg) {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ---- ��ʼ����APP + ��֤�� ----
// \u81EA\u52A8\u540C\u6B65\uFF1A\u6BCF\u5206\u949F\u68C0\u67E5\u4E00\u6B21
let autoSyncTimer = null;
function startAutoSync() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(async () => {
    const user = window.__auth ? window.__auth.getUser() : null;
    if (!user) return;
    const count = await DB.syncFromCloud();
    if (count > 0) {
      renderCalendar(curYear, curMonth);
      if (selectedDate) loadEntry(selectedDate);
    }
  }, 60000);
}

function init() {
  const now = new Date();
  renderCalendar(now.getFullYear(), now.getMonth());
  selectedDate = fmt(now);
  const selCell = document.querySelector('.day-cell[data-date="'+selectedDate+'"]');
  if (selCell) selCell.classList.add("selected");
  loadEntry(selectedDate);

  document.getElementById("prevMonth").onclick = () => { let m = curMonth - 1, y = curYear; if (m < 0) { m = 11; y--; } renderCalendar(y, m); };
  document.getElementById("nextMonth").onclick = () => { let m = curMonth + 1, y = curYear; if (m > 11) { m = 0; y++; } renderCalendar(y, m); };
  document.getElementById("backBtn").onclick = () => { document.getElementById("rightPanel").classList.remove("open"); };

  // FAB ��ť���������ӽ�����ռ�
  document.getElementById("fabBtn").onclick = () => {
    const today = fmt(new Date());
    selectedDate = today;
    document.querySelectorAll(".day-cell.selected").forEach(e => e.classList.remove("selected"));
    const tc = document.querySelector('.day-cell[data-date="'+today+'"]');
    if (tc) tc.classList.add("selected");
    document.getElementById("statText").textContent = today;
    loadEntry(today); openEdit(today);
    if (window.innerWidth < 768) document.getElementById("rightPanel").classList.add("open");
  };

  document.getElementById("editBtn").onclick = () => { if (selectedDate) openEdit(selectedDate); };
  document.getElementById("saveBtn").onclick = saveEntry;
  document.querySelector(".modal-overlay").onclick = (e) => { if (e.target === e.currentTarget) closeEdit(); };

  document.querySelectorAll("#moodPicker button").forEach(b => {
    b.onclick = () => { document.querySelectorAll("#moodPicker button").forEach(bb => bb.classList.remove("active")); b.classList.add("active"); };
  });

  document.getElementById("geoBtn").onclick = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      document.getElementById("locationInput").value = pos.coords.latitude.toFixed(4) + ", " + pos.coords.longitude.toFixed(4);
    }, () => {}, { enableHighAccuracy: true });
  };

  // ��Ƭ�ϴ�
  document.getElementById("photoInput").onchange = (e) => {
    const files = Array.from(e.target.files);
    const doRead = (i) => {
      if (i >= files.length) return;
      const reader = new FileReader();
      reader.onload = (ev) => { state.photos.push(ev.target.result); renderPhotos(state.photos, "photoGrid", true); doRead(i+1); };
      reader.readAsDataURL(files[i]);
    };
    doRead(0);
    e.target.value = "";
  };

  document.getElementById("shopAddBtn").onclick = () => {
    document.getElementById("shopInputRow").style.display = "flex";
    document.getElementById("shopInput").focus();
  };
  document.getElementById("shopConfirm").onclick = () => {
    const v = document.getElementById("shopInput").value.trim();
    if (v) {
      state.shopping.push({ text: v, done: false });
      document.getElementById("shopInput").value = "";
      document.getElementById("shopInputRow").style.display = "none";
      renderShopping(state.shopping, "shopList", true);
    }
  };
  document.getElementById("shopInput").onkeydown = (e) => {
    if (e.key === "Enter") document.getElementById("shopConfirm").click();
    if (e.key === "Escape") document.getElementById("shopInputRow").style.display = "none";
  };

  // ����
  // �ֻ��˰�ť����������˰�ť
  ['syncBtn','statsBtn','exportBtn','logoutBtn'].forEach(id => {
    const m = document.getElementById(id+'Mobile');
    if (m) m.onclick = () => document.getElementById(id)?.click();
  });

  document.getElementById("exportBtn").onclick = async () => {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "diary_backup_" + fmt(new Date()) + ".json";
    a.click();
  };

  // ͳ��
  document.getElementById("statsBtn").onclick = async () => {
    const entries = await DB.getAllEntries();
    const total = entries.length;
    const photoCount = entries.filter(e => e.photos && e.photos.length).length;
    const shopCount = entries.filter(e => e.shopping && e.shopping.length).length;
    const syncInfo = DB.getLastSync() ? '\\n\u2601\uFE0F \u5DF2\u540C\u6B65\u81F3\u4E91\u7AEF' : '\\n\u2601\uFE0F \u672A\u540C\u6B65';
    alert("\u{1F4CA} \u7EDF\u8BA1\u62A5\u544A\\n\\n\u5171 " + total + " \u5929\u8BB0\u5F55\\n\u542B\u7167\u7247: " + photoCount + " \u5929\\n\u542B\u8D2D\u7269\u6E05\u5355: " + shopCount + " \u5929" + syncInfo);
  };

  // �ǳ���ť
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (confirm('\u786E\u5B9A\u8981\u767B\u51FA\u5417\uFF1F')) {
        await window.__logout();
        showToast('\u5DF2\u767B\u51FA');
      }
    };
  }

  const syncBtn = document.getElementById("syncBtn");
  if (syncBtn) {
    syncBtn.onclick = async () => {
      const user = window.__auth ? window.__auth.getUser() : null;
      if (!user) { showToast('请先登录'); return; }
      syncBtn.disabled = true;
      syncBtn.textContent = '同步中...';
      // 1. 先上传本地所有数据到云端
      const allEntries = await DB.getAllEntries();
      let pushCount = 0;
      for (const entry of allEntries) {
        if (await DB.syncToCloud(entry)) pushCount++;
      }
      // 2. 再从云端拉取最新数据到本地
      const count = await DB.syncFromCloud();
      renderCalendar(curYear, curMonth);
      if (selectedDate) loadEntry(selectedDate);
      showToast('☁️ 同步完成，上传' + pushCount + '条，更新' + count + '条');
      syncBtn.disabled = false;
      syncBtn.textContent = '☁️ 同步';
    };
  }  dbReady();
}

function dbReady() {
  document.getElementById("statText").textContent = "\u{1F4C5} " + selectedDate;
}

// ��֤��ɺ�ִ���ƶ�ͬ��
window.__onAuthReady = async function(user) {
  if (user) {
    // \u5148\u4E0A\u4F20\u672C\u5730\u6570\u636E\u5230\u4E91\u7AEF
    const allLocal = await DB.getAllEntries();
    for (const entry of allLocal) {
      try { await DB.syncToCloud(entry); } catch(e) {}
      startAutoSync();\n  }
    // \u518D\u4ECE\u4E91\u7AEF\u62C9\u53D6
    const count = await DB.syncFromCloud();
    renderCalendar(curYear, curMonth);
    if (selectedDate) loadEntry(selectedDate);
    if (count > 0) showToast('\u2601\uFE0F \u540C\u6B65\u5B8C\u6210\uFF0C\u66F4\u65B0 ' + count + ' \u6761\u65E5\u8BB0');
  }
};

// ����
window.addEventListener("load", init);
})();

