// 认证模块 - 使用 Supabase Auth
(function(){
// 初始化 Supabase 客户端
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

window.__supabase = supabaseClient;

let currentUser = null;
let authListeners = [];
let isRegister = false;

// DOM 元素引用
let authScreen, appMain, authEmail, authPassword, authBtn, authToggle, authError, authTitle;

function getEls() {
  authScreen = document.getElementById('authScreen');
  appMain = document.getElementById('appMain');
  authEmail = document.getElementById('authEmail');
  authPassword = document.getElementById('authPassword');
  authBtn = document.getElementById('authBtn');
  authToggle = document.getElementById('authToggle');
  authError = document.getElementById('authError');
  authTitle = document.getElementById('authTitle');
}

function showError(msg) {
  if (authError) { authError.textContent = msg; authError.style.display = 'block'; }
}
function clearError() {
  if (authError) { authError.style.display = 'none'; authError.textContent = ''; }
}

async function setupAuthUI() {
  getEls();
  if (!authScreen || !appMain) return;

  // Supabase v2: 使用 getSession() 检查登录状态
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
    return;
  }

  // 监听 auth 状态变化
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      currentUser = session.user;
      showApp();
      notifyListeners(session.user);
    } else {
      currentUser = null;
      showAuth();
      notifyListeners(null);
    }
  });

  // 登录/注册按钮
  if (authBtn) {
    authBtn.onclick = async () => {
      clearError();
      const email = authEmail?.value?.trim();
      const password = authPassword?.value?.trim();
      if (!email || !password) { showError('请填写邮箱和密码'); return; }
      if (!email.includes('@')) { showError('请输入有效的邮箱地址'); return; }
      if (password.length < 6) { showError('密码至少6位'); return; }
      authBtn.disabled = true;
      authBtn.textContent = isRegister ? '注册中...' : '登录中...';
      try {
        if (isRegister) {
          const { data, error } = await supabaseClient.auth.signUp({ email, password });
          if (error) throw error;
          // 检查是否需要确认邮箱（如果DISABLE了邮箱确认就不用）
          if (data?.user?.identities?.length === 0) {
            showError('该邮箱已注册，请直接登录');
          } else {
            showError('注册成功！' + (data?.user?.confirmed_at ? '已自动登录' : '请检查邮箱验证'));
            if (!data?.user?.confirmed_at) {
              setTimeout(() => toggleMode(), 2000);
            }
          }
        } else {
          // Supabase v2: 使用 signInWithPassword 替代 signIn
          const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (error) {
            if (error.message.includes('Invalid login credentials')) {
              showError('邮箱或密码错误');
            } else {
              throw error;
            }
          }
          // showApp() 会在 onAuthStateChange 中自动触发
        }
      } catch (err) {
        console.error('Auth error:', err);
        showError(err.message || '操作失败，请重试');
      }
      authBtn.disabled = false;
      authBtn.textContent = isRegister ? '注 册' : '登 录';
    };
  }

  if (authToggle) {
    authToggle.onclick = toggleMode;
  }
  if (authPassword) {
    authPassword.onkeydown = (e) => { if (e.key === 'Enter') authBtn?.click(); };
  }
  if (authEmail) {
    authEmail.onkeydown = (e) => { if (e.key === 'Enter') authPassword?.focus(); };
  }
}

function toggleMode() {
  isRegister = !isRegister;
  clearError();
  if (authTitle) authTitle.textContent = isRegister ? '创建账号' : '登录';
  if (authBtn) authBtn.textContent = isRegister ? '注 册' : '登 录';
  if (authToggle) authToggle.innerHTML = isRegister
    ? '已有账号？<a href="#">去登录</a>'
    : '没有账号？<a href="#">注册一个</a>';
}

function showAuth() {
  if (authScreen) authScreen.style.display = 'flex';
  if (appMain) appMain.style.display = 'none';
}

function showApp() {
  if (authScreen) authScreen.style.display = 'none';
  if (appMain) appMain.style.display = 'flex';
  if (window.__onAuthReady) window.__onAuthReady(currentUser);
}

window.__logout = async function() {
  showAuth();
  await supabaseClient.auth.signOut();
};

function notifyListeners(user) { authListeners.forEach(fn => fn(user)); }

window.__auth = {
  init: setupAuthUI,
  getUser: () => currentUser,
  onAuthChange: (fn) => authListeners.push(fn),
  supabase: supabaseClient
};

// 页面加载完成后初始化
if (document.readyState === 'complete') {
  setupAuthUI();
} else {
  window.addEventListener('load', setupAuthUI);
}
})();
