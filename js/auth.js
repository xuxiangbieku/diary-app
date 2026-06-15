// 认证模块 - 使用 Supabase Auth REST API (无需外部SDK)
(function(){
const SUPABASE_URL = SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

let currentUser = null;
let authListeners = [];
let isRegister = false;
let lastSession = null;

// DOM
let authScreen, appMain, authEmail, authPassword, authBtn, authToggle, authError, authTitle;

function getEls() {
  authScreen = document.getElementById("authScreen");
  appMain = document.getElementById("appMain");
  authEmail = document.getElementById("authEmail");
  authPassword = document.getElementById("authPassword");
  authBtn = document.getElementById("authBtn");
  authToggle = document.getElementById("authToggle");
  authError = document.getElementById("authError");
  authTitle = document.getElementById("authTitle");
}

function showError(m) {
  if (authError) { authError.textContent = m; authError.style.display = "block"; }
}
function clearError() {
  if (authError) { authError.style.display = "none"; authError.textContent = ""; }
}

// ---- 从 localStorage 恢复会话 ----
function loadSession() {
  try {
    const s = localStorage.getItem("sb-session");
    if (s) {
      lastSession = JSON.parse(s);
      currentUser = lastSession.user;
      return true;
    }
  } catch(e) {}
  return false;
}

function saveSession(s) {
  lastSession = s;
  currentUser = s?.user || null;
  if (s) {
    localStorage.setItem("sb-session", JSON.stringify(s));
  } else {
    localStorage.removeItem("sb-session");
  }
}

// ---- REST API 调用 ----
async function sbFetch(path, options) {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
  if (lastSession?.access_token) {
    headers["Authorization"] = "Bearer " + lastSession.access_token;
  }
  const resp = await fetch(SUPABASE_URL + path, { ...options, headers });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.msg || data.error_description || data.error || resp.statusText);
  return data;
}

// 注册
async function signUp(email, password) {
  const data = await sbFetch("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  return data;
}

// 登录
async function signIn(email, password) {
  const data = await sbFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  // 保存会话
  saveSession(data);
  notifyListeners(data.user);
  return data;
}

// 登出
async function signOut() {
  try { await sbFetch("/auth/v1/logout", { method: "POST" }); } catch(e) {}
  saveSession(null);
  currentUser = null;
  notifyListeners(null);
  showAuth();
}

// 获取用户信息
async function getUser() {
  if (!lastSession?.access_token) return null;
  try {
    const data = await sbFetch("/auth/v1/user");
    currentUser = data;
    return data;
  } catch(e) {
    saveSession(null);
    return null;
  }
}

async function setupAuthUI() {
  getEls();
  if (!authScreen || !appMain) return;

  // 尝试从本地恢复会话
  if (loadSession()) {
    showApp();
    return;
  }

  // 登录按钮
  if (authBtn) {
    authBtn.onclick = async () => {
      clearError();
      const email = authEmail?.value?.trim();
      const password = authPassword?.value?.trim();
      if (!email || !password) { showError("请填写邮箱和密码"); return; }
      if (!email.includes("@")) { showError("请输入有效的邮箱地址"); return; }
      if (password.length < 6) { showError("密码至少6位"); return; }
      authBtn.disabled = true;
      authBtn.textContent = isRegister ? "注册中..." : "登录中...";
      try {
        if (isRegister) {
          const result = await signUp(email, password);
          if (result.id) {
            // 注册成功自动登录
            await signIn(email, password);
          } else {
            showError("注册成功！请查看邮箱验证或直接登录");
            setTimeout(() => toggleMode(), 1500);
          }
        } else {
          await signIn(email, password);
          showApp();
        }
      } catch (err) {
        console.error("Auth error:", err);
        if (err.message.includes("Invalid login credentials")) {
          showError("邮箱或密码错误");
        } else if (err.message.includes("already registered")) {
          showError("该邮箱已注册，请直接登录");
        } else {
          showError(err.message || "操作失败，请重试");
        }
      }
      authBtn.disabled = false;
      authBtn.textContent = isRegister ? "注 册" : "登 录";
    };
  }

  if (authToggle) authToggle.onclick = toggleMode;
  if (authPassword) authPassword.onkeydown = (e) => { if (e.key === "Enter") authBtn?.click(); };
  if (authEmail) authEmail.onkeydown = (e) => { if (e.key === "Enter") authPassword?.focus(); };
}

function toggleMode() {
  isRegister = !isRegister;
  clearError();
  if (authTitle) authTitle.textContent = isRegister ? "创建账号" : "登录";
  if (authBtn) authBtn.textContent = isRegister ? "注 册" : "登 录";
  if (authToggle) authToggle.innerHTML = isRegister
    ? "已有账号？<a href='#'>去登录</a>"
    : "没有账号？<a href='#'>注册一个</a>";
}

function showAuth() {
  if (authScreen) authScreen.style.display = "flex";
  if (appMain) appMain.style.display = "none";
}

function showApp() {
  if (authScreen) authScreen.style.display = "none";
  if (appMain) appMain.style.display = "flex";
  if (window.__onAuthReady) window.__onAuthReady(currentUser);
}

function notifyListeners(user) {
  authListeners.forEach(fn => fn(user));
}

window.__auth = {
  getUser: () => currentUser,
  onAuthChange: (fn) => authListeners.push(fn),
};
window.__logout = signOut;

// 启动
if (document.readyState === "complete") {
  setupAuthUI();
} else {
  window.addEventListener("load", setupAuthUI);
}
})();
