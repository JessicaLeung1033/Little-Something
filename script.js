// Little Something — App Logic with Supabase Backend (localStorage fallback)

// ===== SUPABASE CONFIG =====
const SUPABASE_URL = 'https://foudotnjsktfvckialca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdWRvdG5qc2t0ZnZja2lhbGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxNjksImV4cCI6MjA4ODU0MDE2OX0.fIXM3YgPuGCcTxBvVPH_Pgh6bLE82hUepqJtwnPBNpA';

let supabaseClient = null;
let localMode = false;

function tryInitSupabase() {
  try {
    if (window.supabase && SUPABASE_URL && !SUPABASE_URL.includes('YOUR_SUPABASE')) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return true;
    }
  } catch (e) {
    console.warn('Supabase client creation failed:', e);
  }
  return false;
}

// Try immediately (SDK may already be loaded)
tryInitSupabase();


// ===== CONSTANTS =====

// Validation state variables (initialized to false)
let loginEmailValid = false;
let loginPasswordValid = false;
let signupEmailValid = false;
let signupPasswordValid = false;
let signupConfirmValid = false;

const AUTH_SETTINGS_TIMEOUT_MS = 5000;
const AUTH_SESSION_TIMEOUT_MS = 8000;
const LOCAL_MOMENTS_KEY = 'ls_moments';
const LOCAL_STARS_KEY = 'ls_stars';
const LOCAL_DATA_ORIGIN_KEY = 'ls_data_origin';
const LOCAL_DATA_ORIGIN_LOCAL = 'local';
const LOCAL_DATA_ORIGIN_REMOTE = 'remote';

const PLACEHOLDERS = [
  '今天有什么让你小小高兴了一下？',
  '有什么小小的满足，值得被记住？',
  '此刻的心情，值得被留下来。',
  '今天让你笑了一下的事？',
  '有什么小小的满足？',
  '这一刻，值得被记住。',
];

const BUBBLE_COLORS = [
  '#f7f7f5', '#f2f4f8', '#f8f5f2',
  '#f5f8f5', '#f6f2f8', '#f8f8f2',
  '#f2f8f8', '#faf5f0', '#f0f5fa',
];

const BUBBLE_SIZES = [60, 66, 72, 76, 80, 86, 90];

const DEFAULT_EMOJIS = [
  '🌅', '☕', '🐈', '🌧️', '📚',
  '🌸', '🍃', '✨', '🌙', '🍵',
  '🌿', '🌊', '🦋', '🍓', '🌻',
  '🎵', '🌈', '🕯️', '🫧', '💫',
];

const ANIM_VARIANTS = ['0', '1', '2', '3'];

const STAR_EMOJIS = ['⭐', '✦', '✧', '✩', '★', '☆'];

// ===== STATE =====

const state = {
  moments: [],
  stars: [],
  currentView: 'home',
  collectMode: false,
  selectedMomentId: null,
  currentMemoryMomentId: null,
  newPhotoData: null,
  newPhotoFile: null,
  newPhotoEmoji: null,
  userId: null,
};

const authState = {
  emailEnabled: true,
  phoneEnabled: false,
  emailConfirmationRequired: true,
  pendingVerificationEmail: '',
};

let authView = 'login';
let authRequestInFlight = false;

// ===== AUTH =====

function showAuth(view = authView) {
  authView = view === 'signup' ? 'signup' : 'login';
  syncAuthUI();
  document.getElementById('auth-screen').classList.add('visible');
  document.getElementById('app-content').style.display = 'none';
  document.getElementById('tab-bar').style.display = 'none';
}

function hideAuth() {
  document.getElementById('auth-screen').classList.remove('visible');
  document.getElementById('app-content').style.display = '';
  document.getElementById('tab-bar').style.display = '';
  document.getElementById('btn-logout').style.display = localMode ? 'none' : '';
}

function showLoading() {
  document.getElementById('loading-overlay').classList.add('visible');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.remove('visible');
}

function getAuthErrorElement(view = authView) {
  return document.getElementById(view === 'signup' ? 'auth-error-signup' : 'auth-error-login');
}

function showAuthError(msg, view = authView) {
  const errorElement = getAuthErrorElement(view);
  if (errorElement) errorElement.textContent = msg;
}

function clearAuthError(view) {
  if (view) {
    const errorElement = getAuthErrorElement(view);
    if (errorElement) errorElement.textContent = '';
    return;
  }

  ['login', 'signup'].forEach(panelView => {
    const errorElement = getAuthErrorElement(panelView);
    if (errorElement) errorElement.textContent = '';
  });
}

function getLoginHintText() {
  if (!authState.emailEnabled) {
    return '当前项目还没有开启邮箱登录';
  }

  if (authState.pendingVerificationEmail) {
    return `验证邮件已发送至 ${authState.pendingVerificationEmail}，完成验证后再回来登录`;
  }

  if (!supabaseClient) {
    return window.__sbLoadFailed
      ? '登录服务加载失败，可以刷新重试，或先本地使用'
      : '登录服务暂时不可用，可以先本地使用';
  }

  return authState.emailConfirmationRequired
    ? '输入邮箱和密码登录；注册后需先验证邮箱'
    : '输入邮箱和密码登录；注册成功后可直接进入';
}

function getSignupHintText() {
  if (!authState.emailEnabled) {
    return '当前项目还没有开启邮箱注册';
  }

  if (!supabaseClient) {
    return '注册服务暂时不可用，可以稍后重试';
  }

  return authState.emailConfirmationRequired
    ? '注册后我们会发送验证邮件到你的邮箱'
    : '注册成功后会自动进入应用';
}

function syncAuthHints() {
  const loginHint = document.getElementById('auth-hint-login');
  const signupHint = document.getElementById('auth-hint-signup');

  if (loginHint) loginHint.textContent = getLoginHintText();
  if (signupHint) signupHint.textContent = getSignupHintText();
}

function focusAuthField(view = authView) {
  const loginEmail = document.getElementById('auth-email');
  const loginPassword = document.getElementById('auth-password');
  const signupEmail = document.getElementById('auth-signup-email');
  const signupPassword = document.getElementById('auth-signup-password');

  const target = view === 'signup'
    ? (signupEmail?.value.trim() ? signupPassword : signupEmail)
    : (loginEmail?.value.trim() ? loginPassword : loginEmail);

  if (target) {
    requestAnimationFrame(() => target.focus());
  }
}

function setAuthView(view, { clearError = true, focus = true } = {}) {
  authView = view === 'signup' ? 'signup' : 'login';

  if (clearError) {
    clearAuthError();
  }

  syncAuthUI();

  if (focus) {
    focusAuthField(authView);
  }
}

function setAuthBusy(isBusy) {
  authRequestInFlight = isBusy;
  syncAuthActionAvailability();
}

function resetSignupForm() {
  document.getElementById('auth-signup-password').value = '';
  document.getElementById('auth-signup-password-confirm').value = '';
}

function fillLoginEmail(email) {
  const loginEmail = document.getElementById('auth-email');
  if (loginEmail) loginEmail.value = email;
}

function fillSignupEmail(email) {
  const signupEmail = document.getElementById('auth-signup-email');
  if (signupEmail) signupEmail.value = email;
}

// ---- Session persistence helpers ----
function persistUserId(userId) {
  if (userId) {
    localStorage.setItem('auth_user_id', userId);
  } else {
    localStorage.removeItem('auth_user_id');
  }
}

function restoreUserId() {
  const saved = localStorage.getItem('auth_user_id');
  if (saved) {
    state.userId = saved;
    // Attempt to restore Supabase session if possible (optional)
    // Here we just load data for the user.
    loadData();
  }
}


function updateAuthButtonStates() {
  const loginBtn = document.getElementById('btn-auth-login');
  const signupBtn = document.getElementById('btn-auth-signup');
  if (loginBtn) {
    loginBtn.disabled = authRequestInFlight || !(loginEmailValid && loginPasswordValid);
  }
  if (signupBtn) {
    signupBtn.disabled = authRequestInFlight || !(signupEmailValid && signupPasswordValid && signupConfirmValid);
  }
}

function validateEmail(email) {
  // Simple email regex
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

function validateLoginForm() {
  const emailInput = document.getElementById('auth-email');
  const pwdInput = document.getElementById('auth-password');
  const errorEl = document.getElementById('auth-error-login');

  const email = emailInput ? emailInput.value : '';
  const pwd = pwdInput ? pwdInput.value : '';

  loginEmailValid = validateEmail(email);
  loginPasswordValid = pwd.length >= 6;

  if (emailInput) {
    emailInput.classList.toggle('valid', loginEmailValid);
    emailInput.classList.toggle('invalid', !loginEmailValid && email.length > 0);
    emailInput.setAttribute('aria-invalid', (!loginEmailValid).toString());
  }
  if (pwdInput) {
    pwdInput.classList.toggle('valid', loginPasswordValid);
    pwdInput.classList.toggle('invalid', !loginPasswordValid && pwd.length > 0);
    pwdInput.setAttribute('aria-invalid', (!loginPasswordValid).toString());
  }
  if (errorEl) errorEl.textContent = '';
  updateAuthButtonStates();
}

function validateSignupForm() {
  const emailInput = document.getElementById('auth-signup-email');
  const pwdInput = document.getElementById('auth-signup-password');
  const confirmInput = document.getElementById('auth-signup-password-confirm');
  const errorEl = document.getElementById('auth-error-signup');

  const email = emailInput ? emailInput.value : '';
  const pwd = pwdInput ? pwdInput.value : '';
  const confirm = confirmInput ? confirmInput.value : '';

  signupEmailValid = validateEmail(email);
  signupPasswordValid = pwd.length >= 6;
  signupConfirmValid = pwd === confirm && confirm.length >= 6;

  if (emailInput) {
    emailInput.classList.toggle('valid', signupEmailValid);
    emailInput.classList.toggle('invalid', !signupEmailValid && email.length > 0);
    emailInput.setAttribute('aria-invalid', (!signupEmailValid).toString());
  }
  if (pwdInput) {
    pwdInput.classList.toggle('valid', signupPasswordValid);
    pwdInput.classList.toggle('invalid', !signupPasswordValid && pwd.length > 0);
    pwdInput.setAttribute('aria-invalid', (!signupPasswordValid).toString());
  }
  if (confirmInput) {
    confirmInput.classList.toggle('valid', signupConfirmValid);
    confirmInput.classList.toggle('invalid', !signupConfirmValid && confirm.length > 0);
    confirmInput.setAttribute('aria-invalid', (!signupConfirmValid).toString());
  }
  if (errorEl) errorEl.textContent = '';
  updateAuthButtonStates();
}

function attachValidationListeners() {
  const emailLogin = document.getElementById('auth-email');
  const pwdLogin = document.getElementById('auth-password');
  const emailSignup = document.getElementById('auth-signup-email');
  const pwdSignup = document.getElementById('auth-signup-password');
  const confirmSignup = document.getElementById('auth-signup-password-confirm');

  if (emailLogin) emailLogin.addEventListener('input', validateLoginForm);
  if (pwdLogin) pwdLogin.addEventListener('input', validateLoginForm);
  if (emailSignup) emailSignup.addEventListener('input', validateSignupForm);
  if (pwdSignup) pwdSignup.addEventListener('input', validateSignupForm);
  if (confirmSignup) confirmSignup.addEventListener('input', validateSignupForm);
}

function syncAuthActionAvailability() {
  const authReady = !!supabaseClient && authState.emailEnabled;
  const loginBtn = document.getElementById('btn-auth-login');
  const signupBtn = document.getElementById('btn-auth-signup');
  const goSignupBtn = document.getElementById('btn-auth-go-signup');
  const backLoginBtn = document.getElementById('btn-auth-back-login');
  const skipBtn = document.getElementById('btn-auth-skip');

  if (loginBtn) {
    loginBtn.disabled = authRequestInFlight || !authReady || !(loginEmailValid && loginPasswordValid);
    loginBtn.textContent = authRequestInFlight && authView === 'login' ? '登录中...' : '登录';
  }

  if (signupBtn) {
    signupBtn.disabled = authRequestInFlight || !authReady || !(signupEmailValid && signupPasswordValid && signupConfirmValid);
    signupBtn.textContent = authRequestInFlight && authView === 'signup' ? '注册中...' : '注册';
  }

  if (goSignupBtn) goSignupBtn.disabled = authRequestInFlight || !authState.emailEnabled;
  if (backLoginBtn) backLoginBtn.disabled = authRequestInFlight;
  if (skipBtn) skipBtn.disabled = authRequestInFlight;
}

// Ensure listeners are attached after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  attachValidationListeners();
  // Run initial validation to set proper button state (empty fields => disabled)
  validateLoginForm();
  validateSignupForm();
});

function syncAuthUI() {
  const loginPanel = document.getElementById('auth-panel-login');
  const signupPanel = document.getElementById('auth-panel-signup');

  if (loginPanel) loginPanel.classList.toggle('active', authView === 'login');
  if (signupPanel) signupPanel.classList.toggle('active', authView === 'signup');

  syncAuthHints();
  syncAuthActionAvailability();
}

async function loadAuthSettings() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_SETTINGS_TIMEOUT_MS);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`settings ${response.status}`);
    }

    const settings = await response.json();
    authState.emailEnabled = settings?.external?.email !== false;
    authState.phoneEnabled = settings?.external?.phone === true;
    authState.emailConfirmationRequired = settings?.mailer_autoconfirm === false;
  } catch (e) {
    console.warn('Auth settings fetch failed, using defaults:', e);
  } finally {
    clearTimeout(timer);
    syncAuthUI();
  }
}

function isInvalidLoginError(error) {
  const message = (error?.message || '').toLowerCase();
  return message.includes('invalid login');
}

function isEmailNotConfirmedError(error) {
  const message = (error?.message || '').toLowerCase();
  return message.includes('email not confirmed');
}

function isExistingUserSignUpResult(data) {
  return Boolean(data?.user) && Array.isArray(data.user.identities) && data.user.identities.length === 0;
}

function getFriendlyAuthError(error, fallback = '操作失败，请稍后再试') {
  const message = (error?.message || '').trim();
  const lower = message.toLowerCase();

  if (!message) return fallback;
  if (lower.includes('email not confirmed')) {
    return '该邮箱已注册，但还没有完成验证。请先打开邮箱里的确认链接，然后再回来登录。';
  }
  if (lower.includes('user already registered')) {
    return authState.emailConfirmationRequired
      ? '该邮箱已经注册过了。如果你刚注册，请先完成邮箱验证；否则请直接返回登录。'
      : '该邮箱已经注册过了，请直接登录。';
  }
  if (lower.includes('invalid login')) {
    return '邮箱或密码不正确。';
  }
  if (lower.includes('rate limit')) {
    return '操作太频繁了，请稍后再试。';
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return '暂时无法连接登录服务，请检查网络后重试，或先本地使用。';
  }

  return message;
}

function showAuthServiceError(message) {
  hideLoading();
  showAuth('login');
  showAuthError(message, 'login');
  syncAuthActionAvailability();
}

function enterLocalMode() {
  localMode = true;
  state.userId = null;
  loadLocal();
  hideLoading();
  hideAuth();
  requestAnimationFrame(renderBubbles);
  showToast('本地模式，数据保存在当前设备');
}


async function signOut() {
  if (supabaseClient) {
    try { await supabaseClient.auth.signOut(); } catch (e) { console.warn('signOut error:', e); }
  }
  state.moments = [];
  state.stars = [];
  state.userId = null;
  authState.pendingVerificationEmail = '';
  document.getElementById('auth-password').value = '';
  showAuth('login');
}

async function signInWithEmail() {
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!authState.emailEnabled) {
    showAuthError('当前项目还没有开启邮箱登录。', 'login');
    return;
  }
  if (!supabaseClient) {
    showAuthError('登录服务暂时不可用，可以先本地使用。', 'login');
    return;
  }
  if (!email || !password) {
    showAuthError('请输入邮箱和密码。', 'login');
    return;
  }
  if (password.length < 6) {
    showAuthError('密码至少 6 位。', 'login');
    return;
  }

  clearAuthError();
  authState.pendingVerificationEmail = '';
  syncAuthHints();
  setAuthBusy(true);

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      if (isEmailNotConfirmedError(error)) {
        authState.pendingVerificationEmail = email;
        syncAuthHints();
        showAuthError('这个邮箱还没有完成验证，请先去邮箱确认后再登录。', 'login');
        return;
      }

      if (isInvalidLoginError(error)) {
        showAuthError('邮箱或密码不正确。', 'login');
        return;
      }

      showAuthError(getFriendlyAuthError(error, '登录失败，请稍后再试。'), 'login');
      return;
    }

    if (!data?.session) {
      showAuthError('登录成功，但没有拿到会话，请稍后再试。', 'login');
      return;
    }

    // ---- Persist user id ----
    if (data.session.user && data.session.user.id) {
      state.userId = data.session.user.id;
      persistUserId(state.userId);
    }

    passwordInput.value = '';
    showToast('登录成功');
    // Load user data after login
    loadData();
  } catch (e) {
    showAuthError(getFriendlyAuthError(e, '登录失败，请稍后再试。'), 'login');
  } finally {
    setAuthBusy(false);
  }
}

async function signUpWithEmail() {
  const signupEmailInput = document.getElementById('auth-signup-email');
  const signupPasswordInput = document.getElementById('auth-signup-password');
  const signupConfirmInput = document.getElementById('auth-signup-password-confirm');
  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value;
  const confirmPassword = signupConfirmInput.value;

  if (!authState.emailEnabled) {
    showAuthError('当前项目还没有开启邮箱注册。', 'signup');
    return;
  }
  if (!supabaseClient) {
    showAuthError('注册服务暂时不可用，请稍后再试。', 'signup');
    return;
  }
  if (!email || !password || !confirmPassword) {
    showAuthError('请完整填写邮箱和两次密码。', 'signup');
    return;
  }
  if (password.length < 6) {
    showAuthError('密码至少 6 位。', 'signup');
    return;
  }
  if (password !== confirmPassword) {
    showAuthError('两次输入的密码不一致。', 'signup');
    return;
  }

  clearAuthError();
  setAuthBusy(true);

  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      showAuthError(getFriendlyAuthError(error, '注册失败，请稍后再试。'), 'signup');
      return;
    }

    if (isExistingUserSignUpResult(data)) {
      showAuthError(
        authState.emailConfirmationRequired
          ? '这个邮箱已经注册过了。如果还没验证，请先去邮箱完成验证；否则请直接返回登录。'
          : '这个邮箱已经注册过了，请直接返回登录。',
        'signup'
      );
      return;
    }

    if (data?.session) {
      showToast('注册成功');
      return;
    }

    authState.pendingVerificationEmail = email;
    fillLoginEmail(email);
    resetSignupForm();
    setAuthView('login');
    showToast('验证邮件已发送，请先完成验证');
  } catch (e) {
    showAuthError(getFriendlyAuthError(e, '注册失败，请稍后再试。'), 'signup');
  } finally {
    setAuthBusy(false);
  }
}

function initAuthUI() {
  const loginInputs = ['auth-email', 'auth-password'];
  const signupInputs = ['auth-signup-email', 'auth-signup-password', 'auth-signup-password-confirm'];

  document.getElementById('btn-auth-login').addEventListener('click', signInWithEmail);
  document.getElementById('btn-auth-signup').addEventListener('click', signUpWithEmail);
  document.getElementById('btn-auth-go-signup').addEventListener('click', () => {
    const loginEmail = document.getElementById('auth-email').value.trim();
    if (loginEmail) fillSignupEmail(loginEmail);
    setAuthView('signup');
  });
  document.getElementById('btn-auth-back-login').addEventListener('click', () => {
    const signupEmail = document.getElementById('auth-signup-email').value.trim();
    if (signupEmail) fillLoginEmail(signupEmail);
    setAuthView('login');
  });
  document.getElementById('btn-auth-skip').addEventListener('click', enterLocalMode);
  document.getElementById('btn-logout').addEventListener('click', signOut);

  loginInputs.forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('input', () => {
      clearAuthError('login');
      if (id === 'auth-email' && authState.pendingVerificationEmail && input.value.trim() !== authState.pendingVerificationEmail) {
        authState.pendingVerificationEmail = '';
        syncAuthHints();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') signInWithEmail();
    });
  });

  signupInputs.forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('input', () => clearAuthError('signup'));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') signUpWithEmail();
    });
  });

  syncAuthUI();
}

// ===== LOCAL STORAGE HELPERS =====

function saveLocal(origin = localMode ? LOCAL_DATA_ORIGIN_LOCAL : LOCAL_DATA_ORIGIN_REMOTE) {
  try {
    localStorage.setItem(LOCAL_MOMENTS_KEY, JSON.stringify(state.moments));
    localStorage.setItem(LOCAL_STARS_KEY, JSON.stringify(state.stars));
    localStorage.setItem(LOCAL_DATA_ORIGIN_KEY, origin);
  } catch (e) { console.warn('localStorage save failed:', e); }
}

function clearLocalDataCache() {
  localStorage.removeItem(LOCAL_MOMENTS_KEY);
  localStorage.removeItem(LOCAL_STARS_KEY);
  localStorage.removeItem(LOCAL_DATA_ORIGIN_KEY);
}

function loadLocal() {
  try {
    const m = localStorage.getItem(LOCAL_MOMENTS_KEY);
    const s = localStorage.getItem(LOCAL_STARS_KEY);
    if (m) state.moments = JSON.parse(m);
    if (s) state.stars = JSON.parse(s);
  } catch (e) { console.warn('localStorage load failed:', e); }
}

function shouldMigrateLocalData() {
  return localStorage.getItem(LOCAL_DATA_ORIGIN_KEY) === LOCAL_DATA_ORIGIN_LOCAL
    && !!localStorage.getItem(LOCAL_MOMENTS_KEY);
}

// ===== DATA LAYER (Supabase with localStorage fallback) =====

async function loadData() {
  if (localMode) {
    loadLocal();
    return;
  }
  if (!state.userId) return;

  try {
    const [momentsRes, starsRes] = await Promise.all([
      supabaseClient.from('moments').select('*').order('created_at', { ascending: true }),
      supabaseClient.from('stars').select('*').order('collected_at', { ascending: true }),
    ]);

    if (momentsRes.error) throw momentsRes.error;
    if (starsRes.error) throw starsRes.error;

    if (momentsRes.data) {
      state.moments = momentsRes.data.map(m => ({
        id: m.id,
        emoji: m.emoji,
        photoPath: m.photo_path,
        photoData: null,
        text: m.text,
        createdAt: m.created_at,
        status: m.status,
        color: m.color,
      }));
    }

    if (starsRes.data) {
      state.stars = starsRes.data.map(s => ({
        id: s.id,
        momentId: s.moment_id,
        collectedAt: s.collected_at,
      }));
    }
  } catch (e) {
    console.warn('Supabase loadData failed, falling back to localStorage:', e);
    loadLocal();
  }
}

async function getPhotoUrl(photoPath) {
  if (!photoPath || localMode) return null;
  try {
    const { data } = await supabaseClient.storage.from('photos').createSignedUrl(photoPath, 3600);
    return data ? data.signedUrl : null;
  } catch (e) {
    console.warn('getPhotoUrl failed:', e);
    return null;
  }
}

async function uploadPhoto(file, momentId) {
  if (localMode) return null; // photos stored as base64 in local mode
  if (!supabaseClient || !state.userId) return null;
  try {
    const compressed = await compressImage(file, 1200, 0.8);
    const contentType = compressed.type || 'image/jpeg';
    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const path = `${state.userId}/${momentId}.${ext}`;

    const { error } = await supabaseClient.storage.from('photos').upload(path, compressed, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.error('Photo upload error:', error);
      return null;
    }
    return path;
  } catch (e) {
    console.warn('uploadPhoto failed:', e);
    return null;
  }
}

async function deleteUploadedPhoto(photoPath) {
  if (!photoPath || localMode || !supabaseClient) return;
  try {
    const { error } = await supabaseClient.storage.from('photos').remove([photoPath]);
    if (error) {
      console.warn('deleteUploadedPhoto error:', error);
    }
  } catch (e) {
    console.warn('deleteUploadedPhoto failed:', e);
  }
}

function compressImage(file, maxDim, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function saveMomentToDb(momentData, { allowLocalFallback = true } = {}) {
  if (localMode) {
    saveLocal(LOCAL_DATA_ORIGIN_LOCAL);
    return momentData;
  }
  try {
    const { data, error } = await supabaseClient.from('moments').insert({
      id: momentData.id,
      user_id: state.userId,
      emoji: momentData.emoji,
      photo_path: momentData.photoPath || null,
      text: momentData.text,
      color: momentData.color,
      status: momentData.status,
      created_at: momentData.createdAt,
    }).select().single();

    if (error) {
      console.error('Save moment error:', error);
      if (allowLocalFallback) {
        saveLocal(LOCAL_DATA_ORIGIN_LOCAL);
        return momentData;
      }
      return null;
    }
    saveLocal(LOCAL_DATA_ORIGIN_REMOTE);
    return data;
  } catch (e) {
    if (allowLocalFallback) {
      console.warn('saveMomentToDb failed, saved locally:', e);
      saveLocal(LOCAL_DATA_ORIGIN_LOCAL);
      return momentData;
    }
    console.warn('saveMomentToDb failed:', e);
    return null;
  }
}

async function updateMomentStatus(momentId, newStatus) {
  if (localMode) { saveLocal(LOCAL_DATA_ORIGIN_LOCAL); return; }
  try {
    const { error } = await supabaseClient.from('moments').update({ status: newStatus }).eq('id', momentId);
    if (error) console.error('Update moment status error:', error);
    saveLocal(error ? LOCAL_DATA_ORIGIN_LOCAL : LOCAL_DATA_ORIGIN_REMOTE);
  } catch (e) {
    console.warn('updateMomentStatus failed:', e);
    saveLocal(LOCAL_DATA_ORIGIN_LOCAL);
  }
}

async function insertStar(star) {
  if (localMode) { saveLocal(LOCAL_DATA_ORIGIN_LOCAL); return; }
  try {
    const { error } = await supabaseClient.from('stars').insert({
      id: star.id,
      user_id: state.userId,
      moment_id: star.momentId,
      collected_at: star.collectedAt,
    });
    if (error) console.error('Insert star error:', error);
    saveLocal(error ? LOCAL_DATA_ORIGIN_LOCAL : LOCAL_DATA_ORIGIN_REMOTE);
  } catch (e) {
    console.warn('insertStar failed:', e);
    saveLocal(LOCAL_DATA_ORIGIN_LOCAL);
  }
}

async function deleteStar(momentId) {
  if (localMode) { saveLocal(LOCAL_DATA_ORIGIN_LOCAL); return; }
  try {
    const { error } = await supabaseClient.from('stars').delete().eq('moment_id', momentId);
    if (error) console.error('Delete star error:', error);
    saveLocal(error ? LOCAL_DATA_ORIGIN_LOCAL : LOCAL_DATA_ORIGIN_REMOTE);
  } catch (e) {
    console.warn('deleteStar failed:', e);
    saveLocal(LOCAL_DATA_ORIGIN_LOCAL);
  }
}

// ===== MIGRATION (localStorage → Supabase) =====

async function migrateLocalData() {
  let oldMoments, oldStars;
  try {
    const m = localStorage.getItem(LOCAL_MOMENTS_KEY);
    const s = localStorage.getItem(LOCAL_STARS_KEY);
    if (m) oldMoments = JSON.parse(m);
    if (s) oldStars = JSON.parse(s);
  } catch (e) { return; }

  if (!oldMoments || oldMoments.length === 0) return;

  showToast('正在迁移本地数据...', 4000);

  // Map old IDs to new UUIDs
  const idMap = {};

  for (const m of oldMoments) {
    const newId = crypto.randomUUID();
    idMap[m.id] = newId;

    let photoPath = null;

    // Upload base64 photo if present
    if (m.photoData && m.photoData.startsWith('data:')) {
      try {
        const blob = await fetch(m.photoData).then(r => r.blob());
        const file = new File([blob], newId + '.jpg', { type: blob.type || 'image/jpeg' });
        photoPath = await uploadPhoto(file, newId);
      } catch (e) {
        console.error('Photo migration error:', e);
      }
    }

    await saveMomentToDb({
      id: newId,
      emoji: m.emoji || '✦',
      photoPath: photoPath,
      text: m.text || '✦',
      createdAt: m.createdAt || new Date().toISOString(),
      status: m.status || 'active',
      color: m.color || '#f7f7f5',
    });
  }

  if (oldStars) {
    for (const s of oldStars) {
      const mappedMomentId = idMap[s.momentId];
      if (mappedMomentId) {
        await insertStar({
          id: crypto.randomUUID(),
          momentId: mappedMomentId,
          collectedAt: s.collectedAt || new Date().toISOString(),
        });
      }
    }
  }

  // Clear localStorage after successful migration
  clearLocalDataCache();

  // Reload data from server
  await loadData();

  showToast('数据迁移完成 ✦', 2400);
}

// ===== UTILITIES =====

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h}:${m} ${ampm}`;
}

function getActiveMoments() {
  return state.moments.filter(m => m.status === 'active');
}

// ===== TOAST =====

let _toastTimer = null;
function showToast(msg, duration = 2400) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ===== STATUS BAR TIME =====

function updateStatusTime() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  document.getElementById('status-time').textContent = `${h}:${m}`;
}

// ===== NAVIGATION =====

function navigateTo(viewId) {
  if (state.currentView === viewId) return;

  const tabBar = document.getElementById('tab-bar');
  const noTabViews = ['create'];

  // Deactivate current
  const current = document.getElementById('screen-' + state.currentView);
  if (current) {
    current.classList.remove('active');
    current.classList.add('slide-out');
    setTimeout(() => current.classList.remove('slide-out'), 320);
  }

  // Activate next
  const next = document.getElementById('screen-' + viewId);
  if (next) next.classList.add('active');

  state.currentView = viewId;

  // Tab bar visibility
  if (noTabViews.includes(viewId)) {
    tabBar.classList.add('hidden');
  } else {
    tabBar.classList.remove('hidden');
  }

  // Tab active states
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === viewId);
  });

  // Screen setup
  if (viewId === 'home') {
    if (state.collectMode) exitCollectMode();
    setTimeout(renderBubbles, 60);
  } else if (viewId === 'bottle') {
    renderBottle();
  } else if (viewId === 'create') {
    setupCreateScreen();
  }
}

// ===== BUBBLE RENDERING =====

// Photo URL cache to avoid repeated signed URL fetches
const _photoUrlCache = {};

async function getPhotoUrlCached(photoPath) {
  if (!photoPath) return null;
  if (_photoUrlCache[photoPath] && _photoUrlCache[photoPath].expires > Date.now()) {
    return _photoUrlCache[photoPath].url;
  }
  const url = await getPhotoUrl(photoPath);
  if (url) {
    _photoUrlCache[photoPath] = { url, expires: Date.now() + 3500 * 1000 }; // cache ~1hr
  }
  return url;
}

function renderBubbles() {
  const container = document.getElementById('bubbles-container');
  const emptyState = document.getElementById('empty-home');

  container.querySelectorAll('.bubble').forEach(b => b.remove());

  const active = getActiveMoments();
  if (active.length === 0) {
    emptyState.classList.add('visible');
    return;
  }
  emptyState.classList.remove('visible');

  const cw = container.offsetWidth || 350;
  const ch = container.offsetHeight || 500;
  const topClear = 74;
  const placed = [];

  active.forEach((moment, idx) => {
    const size = randomFrom(BUBBLE_SIZES);
    const pad = 8;
    let x, y, attempts = 0;

    do {
      x = randomInt(pad, Math.max(pad + 1, cw - size - pad));
      y = randomInt(topClear, Math.max(topClear + 1, ch - size - pad));
      attempts++;
      const overlap = placed.some(p => {
        const dx = (x + size / 2) - (p.x + p.size / 2);
        const dy = (y + size / 2) - (p.y + p.size / 2);
        return Math.sqrt(dx * dx + dy * dy) < (size / 2 + p.size / 2 + 6);
      });
      if (!overlap || attempts >= 25) break;
    } while (true);

    placed.push({ x, y, size });
    const bubble = createBubbleEl(moment, x, y, size, idx);
    container.appendChild(bubble);

    if (state.collectMode) bubble.classList.add('collect-mode');
  });
}

function createBubbleEl(moment, x, y, size, index) {
  const el = document.createElement('div');
  el.className = 'bubble';
  el.dataset.momentId = moment.id;
  el.dataset.anim = ANIM_VARIANTS[index % 4];
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.background = moment.color;
  el.style.animationDelay = ((index * 0.65) % 4) + 's';

  if (moment.photoPath) {
    // Load photo from Supabase storage
    const emoji = document.createElement('span');
    emoji.className = 'bubble-emoji';
    emoji.textContent = moment.emoji;
    el.appendChild(emoji);

    getPhotoUrlCached(moment.photoPath).then(url => {
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'bubble-photo';
        img.draggable = false;
        img.onload = () => { emoji.remove(); };
        img.onerror = () => {
          // fallback: show a placeholder icon if image fails to load
          img.remove();
          emoji.textContent = '🖼️';
        };
        el.insertBefore(img, emoji);
      } else {
        // fallback when no URL (e.g., permission issue)
        emoji.textContent = '🖼️';
      }
    });
  } else if (moment.photoData) {
    // Legacy: base64 photo (during migration preview)
    const img = document.createElement('img');
    img.src = moment.photoData;
    img.className = 'bubble-photo';
    img.draggable = false;
    img.onerror = () => {
      img.remove();
      const emoji = document.createElement('span');
      emoji.className = 'bubble-emoji';
      emoji.textContent = moment.emoji;
      el.appendChild(emoji);
    };
    el.appendChild(img);
  } else {
    const emoji = document.createElement('span');
    emoji.className = 'bubble-emoji';
    emoji.textContent = moment.emoji;
    el.appendChild(emoji);

    if (moment.text && moment.text !== '✦' && size >= 72) {
      const txt = document.createElement('span');
      txt.className = 'bubble-text';
      txt.textContent = moment.text.slice(0, 8);
      el.appendChild(txt);
    }
  }

  el.addEventListener('click', () => handleBubbleClick(moment.id, el));
  return el;
}

function handleBubbleClick(momentId, el) {
  if (state.collectMode) {
    collectBubble(momentId, el);
  } else {
    openDetail(momentId, el);
  }
}

// ===== DETAIL VIEW =====

async function openDetail(momentId, bubbleEl) {
  const moment = state.moments.find(m => m.id === momentId);
  if (!moment) return;
  state.selectedMomentId = momentId;

  const imageArea = document.getElementById('detail-image-area');
  const detailEmoji = document.getElementById('detail-emoji');
  imageArea.querySelectorAll('img').forEach(i => i.remove());

  if (moment.photoPath) {
    detailEmoji.style.display = 'none';
    const url = await getPhotoUrlCached(moment.photoPath);
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.onerror = () => { img.remove(); detailEmoji.style.display = ''; detailEmoji.textContent = moment.emoji; };
      imageArea.appendChild(img);
    } else {
      detailEmoji.style.display = '';
      detailEmoji.textContent = moment.emoji;
    }
  } else if (moment.photoData) {
    detailEmoji.style.display = 'none';
    const img = document.createElement('img');
    img.src = moment.photoData;
    img.onerror = () => { img.remove(); detailEmoji.style.display = ''; detailEmoji.textContent = moment.emoji; };
    imageArea.appendChild(img);
  } else {
    detailEmoji.style.display = '';
    detailEmoji.textContent = moment.emoji;
  }

  document.getElementById('detail-text').textContent = '\u201C' + moment.text + '\u201D';
  document.getElementById('detail-date').textContent = formatDate(moment.createdAt);

  // Set transform-origin to bubble position for hero effect
  const sheet = document.getElementById('detail-sheet');
  if (bubbleEl) {
    const bubbleRect = bubbleEl.getBoundingClientRect();
    const frameRect = document.getElementById('phone-frame').getBoundingClientRect();
    const bx = bubbleRect.left + bubbleRect.width / 2 - frameRect.left;
    const by = bubbleRect.top + bubbleRect.height / 2 - frameRect.top;
    sheet.style.transformOrigin = bx + 'px ' + by + 'px';
    state._activeBubbleEl = bubbleEl;
  } else {
    sheet.style.transformOrigin = 'center center';
    state._activeBubbleEl = null;
  }

  document.getElementById('overlay-detail').classList.add('visible');
}

function closeDetail() {
  const sheet = document.getElementById('detail-sheet');
  const overlay = document.getElementById('overlay-detail');

  if (state._activeBubbleEl) {
    const bubbleRect = state._activeBubbleEl.getBoundingClientRect();
    const frameRect = document.getElementById('phone-frame').getBoundingClientRect();
    const bx = bubbleRect.left + bubbleRect.width / 2 - frameRect.left;
    const by = bubbleRect.top + bubbleRect.height / 2 - frameRect.top;
    sheet.style.transformOrigin = bx + 'px ' + by + 'px';
  }

  overlay.classList.remove('visible');
  state.selectedMomentId = null;
  state._activeBubbleEl = null;
}

// ===== CREATE SCREEN =====

function setupCreateScreen() {
  state.newPhotoData = null;
  state.newPhotoFile = null;
  state.newPhotoEmoji = randomFrom(DEFAULT_EMOJIS);

  const picker = document.getElementById('photo-picker');
  picker.innerHTML =
    '<span class="photo-picker-icon">📷</span>' +
    '<span class="photo-picker-text">Photo or camera</span>' +
    '<input type="file" id="photo-input" accept="image/*" class="sr-only">';

  document.getElementById('photo-input').addEventListener('change', handlePhotoSelect);
  document.getElementById('moment-text').value = '';
  document.getElementById('moment-text').placeholder = randomFrom(PLACEHOLDERS);

  setTimeout(() => document.getElementById('moment-text').focus(), 350);
}

function handlePhotoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  state.newPhotoFile = file;

  const reader = new FileReader();
  reader.onload = function(ev) {
    state.newPhotoData = ev.target.result;
    rebuildPhotoPicker(ev.target.result);
  };
  reader.onerror = function() {
    showToast('需要相机权限，或者用相册里的照片也可以');
  };
  reader.readAsDataURL(file);
}

function rebuildPhotoPicker(src) {
  const picker = document.getElementById('photo-picker');
  picker.innerHTML = '';

  const img = document.createElement('img');
  img.src = src;
  img.className = 'photo-preview';
  picker.appendChild(img);

  const hint = document.createElement('span');
  hint.className = 'photo-change-hint';
  hint.textContent = 'TAP TO CHANGE';
  picker.appendChild(hint);

  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'photo-input';
  input.accept = 'image/*';
  input.className = 'sr-only';
  input.addEventListener('change', handlePhotoSelect);
  picker.appendChild(input);
}

async function saveMoment() {
  const text = document.getElementById('moment-text').value.trim();
  if (!text && !state.newPhotoData) {
    showToast('Add a photo or some words ✦');
    return;
  }

  const btn = document.getElementById('btn-save-moment');
  btn.disabled = true;

  const momentId = crypto.randomUUID();

  // Upload photo if present
  let photoPath = null;
  if (state.newPhotoFile) {
    photoPath = await uploadPhoto(state.newPhotoFile, momentId);
    if (!photoPath && !localMode) {
      btn.disabled = false;
      showToast('照片上传失败，请重试');
      return;
    }
  }

  const moment = {
    id: momentId,
    emoji: state.newPhotoEmoji || randomFrom(DEFAULT_EMOJIS),
    photoPath: photoPath,
    photoData: (photoPath || !state.newPhotoData) ? null : state.newPhotoData,
    text: text || '✦',
    createdAt: new Date().toISOString(),
    status: 'active',
    color: randomFrom(BUBBLE_COLORS),
  };

  const saved = await saveMomentToDb(moment, { allowLocalFallback: false });
  btn.disabled = false;

  if (!saved) {
    await deleteUploadedPhoto(photoPath);
    showToast(localMode ? '保存失败，请重试' : '云端保存失败，请重试');
    return;
  }

  // Add to local state after DB confirms
  state.moments.push(moment);

  navigateTo('home');

  setTimeout(() => {
    const container = document.getElementById('bubbles-container');
    const newBubble = container.querySelector('[data-moment-id="' + moment.id + '"]');
    if (newBubble) {
      const cw = container.offsetWidth || 350;
      const ch = container.offsetHeight || 500;
      const size = parseInt(newBubble.style.width);
      const finalX = parseInt(newBubble.style.left);
      const finalY = parseInt(newBubble.style.top);

      newBubble.style.left = (cw / 2 - size / 2) + 'px';
      newBubble.style.top = (ch / 2 - size / 2) + 'px';
      newBubble.classList.add('appearing');

      setTimeout(() => {
        newBubble.style.transition = 'left 0.5s ease, top 0.5s ease';
        newBubble.style.left = finalX + 'px';
        newBubble.style.top = finalY + 'px';
        setTimeout(() => {
          newBubble.classList.remove('appearing');
          newBubble.style.transition = '';
        }, 550);
      }, 550);
    }
    spawnSparkles();
  }, 120);

  showToast('✦ Floating away...');
}

function spawnSparkles() {
  const frame = document.getElementById('phone-frame');
  const fr = frame.getBoundingClientRect();
  const cx = fr.left + fr.width / 2;
  const cy = fr.top + fr.height * 0.45;

  for (let i = 0; i < 8; i++) {
    const sp = document.createElement('div');
    const size = 3 + Math.random() * 4;
    sp.style.cssText = [
      'position:fixed',
      'left:' + cx + 'px',
      'top:' + cy + 'px',
      'width:' + size + 'px',
      'height:' + size + 'px',
      'border-radius:50%',
      'background:' + (i % 2 === 0 ? '#1a1a1a' : '#999'),
      'pointer-events:none',
      'z-index:9999',
    ].join(';');
    document.body.appendChild(sp);

    const angle = (i / 8) * Math.PI * 2;
    const dist = 24 + Math.random() * 28;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;

    sp.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + tx + 'px), calc(-50% + ' + ty + 'px)) scale(0)', opacity: 0 }
      ],
      { duration: 580, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => sp.remove();
  }
}

// ===== COLLECT MODE =====

function enterCollectMode() {
  if (getActiveMoments().length === 0) {
    showToast('暂时还没有气泡，先去记录一个小确幸吧 ✦');
    return;
  }
  state.collectMode = true;

  document.getElementById('bubbles-container').querySelectorAll('.bubble').forEach(b => {
    b.classList.add('collect-mode');
  });
  document.getElementById('collect-banner').classList.add('visible');
  document.getElementById('btn-bottle-icon').classList.add('collecting');
}

function exitCollectMode() {
  state.collectMode = false;
  document.getElementById('bubbles-container').querySelectorAll('.bubble').forEach(b => {
    b.classList.remove('collect-mode');
  });
  document.getElementById('collect-banner').classList.remove('visible');
  document.getElementById('btn-bottle-icon').classList.remove('collecting');
}

async function collectBubble(momentId, bubbleEl) {
  const moment = state.moments.find(m => m.id === momentId);
  if (!moment || moment.status === 'collected') return;

  bubbleEl.classList.add('collecting-out');

  const bubbleRect = bubbleEl.getBoundingClientRect();
  const bottleBtn = document.getElementById('btn-bottle-icon');
  const bottleRect = bottleBtn.getBoundingClientRect();
  const size = bubbleRect.width;

  // Flying clone
  const fly = document.createElement('div');
  fly.className = 'flying-bubble';
  fly.style.left = bubbleRect.left + 'px';
  fly.style.top = bubbleRect.top + 'px';
  fly.style.width = size + 'px';
  fly.style.height = size + 'px';
  fly.style.background = moment.color;
  fly.style.border = '1.5px solid rgba(26,26,26,0.35)';
  fly.textContent = moment.emoji;
  document.body.appendChild(fly);

  const targetX = bottleRect.left + bottleRect.width / 2;
  const targetY = bottleRect.top + bottleRect.height / 2;
  const startX = bubbleRect.left;
  const startY = bubbleRect.top;

  const midX = startX + (targetX - startX) * 0.45 - size * 0.15;
  const midY = Math.min(startY, targetY) - 44;

  const anim = fly.animate([
    {
      left: startX + 'px', top: startY + 'px',
      width: size + 'px', height: size + 'px',
      opacity: 1, borderRadius: '50%',
    },
    {
      left: midX + 'px', top: midY + 'px',
      width: (size * 0.68) + 'px', height: (size * 0.68) + 'px',
      opacity: 0.82, borderRadius: '50%',
    },
    {
      left: (targetX - 7) + 'px', top: (targetY - 7) + 'px',
      width: '14px', height: '14px',
      opacity: 0, borderRadius: '50%',
    }
  ], { duration: 520, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'forwards' });

  anim.onfinish = async () => {
    fly.remove();

    // Update state
    moment.status = 'collected';
    const star = { id: crypto.randomUUID(), momentId: moment.id, collectedAt: new Date().toISOString() };
    state.stars.push(star);

    // Save to Supabase
    await Promise.all([
      updateMomentStatus(momentId, 'collected'),
      insertStar(star),
    ]);

    bubbleEl.remove();

    // Flash bottle icon
    const btn = document.getElementById('btn-bottle-icon');
    btn.style.transition = 'transform 0.15s ease';
    btn.style.transform = 'scale(1.4)';
    setTimeout(() => { btn.style.transform = 'scale(1)'; }, 180);

    showToast('放进去了，等你需要的时候再来找你 ✦');

    if (getActiveMoments().length === 0) {
      exitCollectMode();
      document.getElementById('empty-home').classList.add('visible');
    }
  };
}

// ===== BOTTLE RENDERING =====

function renderBottle() {
  const starCount = state.stars.length;
  const bottleVisual = document.getElementById('bottle-visual-area');
  const bottleEmpty = document.getElementById('bottle-empty-state');
  const bottleBody = document.getElementById('bottle-body');
  const countText = document.getElementById('bottle-count-text');
  const unhappyBtn = document.getElementById('btn-unhappy');

  if (starCount === 0) {
    bottleVisual.style.display = 'none';
    bottleEmpty.classList.add('visible');
    unhappyBtn.setAttribute('disabled', '');
    return;
  }

  bottleVisual.style.display = 'flex';
  bottleEmpty.classList.remove('visible');
  unhappyBtn.removeAttribute('disabled');

  bottleBody.innerHTML = '';
  const visCount = Math.min(starCount, 6);
  for (let i = 0; i < visCount; i++) {
    const star = document.createElement('span');
    star.className = 'star-in-bottle';
    star.textContent = STAR_EMOJIS[i % STAR_EMOJIS.length];
    bottleBody.appendChild(star);
  }

  countText.textContent = starCount === 1
    ? '1 个小确幸在等你 · one little something'
    : starCount + ' 个小确幸在等你 · ' + starCount + ' little somethings';
}

// ===== MOOD ANIMATION =====

function triggerMoodFlow() {
  if (state.stars.length === 0) {
    showToast('瓶子还是空的，先去收藏几个小确幸吧，它们以后会来陪你', 3200);
    return;
  }

  document.getElementById('overlay-mood-confirm').classList.remove('visible');

  const overlay = document.getElementById('overlay-mood-anim');
  const bottle = document.getElementById('mood-scene-bottle');
  const star = document.getElementById('mood-scene-star');
  const flash = document.getElementById('mood-scene-flash');
  const halo = document.getElementById('mood-halo');

  bottle.classList.remove('visible', 'swaying', 'rising');
  star.classList.remove('rising');
  flash.classList.remove('active');
  halo.classList.remove('active', 'bright');
  clearMoodDust();

  star.style.animation = 'none';
  void star.offsetWidth;
  star.style.animation = '';
  bottle.style.animation = '';
  void bottle.offsetWidth;

  overlay.classList.add('visible');

  requestAnimationFrame(() => {
    bottle.classList.add('visible');
  });

  setTimeout(() => {
    bottle.classList.add('swaying');
    halo.classList.add('active');
    spawnMoodDust();
  }, 500);

  setTimeout(() => {
    halo.classList.add('bright');
    bottle.classList.remove('swaying');
    bottle.classList.add('rising');
  }, 2800);

  setTimeout(() => {
    star.classList.add('rising');
    spawnMoodDust();
  }, 3600);

  setTimeout(() => {
    flash.classList.add('active');
  }, 5800);

  setTimeout(() => {
    overlay.classList.remove('visible');
    bottle.classList.remove('visible', 'swaying', 'rising');
    star.classList.remove('rising');
    flash.classList.remove('active');
    halo.classList.remove('active', 'bright');
    clearMoodDust();
    showMemoryReveal();
  }, 6600);
}

function spawnMoodDust() {
  const overlay = document.getElementById('overlay-mood-anim');
  const count = 18;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'mood-dust';
    const size = 2 + Math.random() * 4;
    const startX = 20 + Math.random() * 60;
    const startY = 30 + Math.random() * 40;
    const alpha = 0.15 + Math.random() * 0.35;
    const isWarm = Math.random() > 0.3;
    const color = isWarm
      ? `rgba(255,${200 + Math.floor(Math.random() * 40)},${100 + Math.floor(Math.random() * 60)},${alpha})`
      : `rgba(26,26,26,${alpha * 0.5})`;

    dot.style.cssText = `
      left:${startX}%;top:${startY}%;
      width:${size}px;height:${size}px;
      background:${color};
    `;
    overlay.appendChild(dot);

    const driftX = (Math.random() - 0.5) * 40;
    const driftY = -(15 + Math.random() * 50);
    const dur = 2500 + Math.random() * 2000;
    const delay = Math.random() * 1200;

    dot.animate([
      { transform: 'translate(0, 0) scale(0)', opacity: 0 },
      { transform: `translate(${driftX * 0.3}px, ${driftY * 0.2}px) scale(1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${driftX}px, ${driftY}px) scale(0.3)`, opacity: 0 },
    ], {
      duration: dur,
      easing: 'ease-in-out',
      fill: 'forwards',
      delay: delay,
    }).onfinish = () => dot.remove();
  }
}

function clearMoodDust() {
  const overlay = document.getElementById('overlay-mood-anim');
  overlay.querySelectorAll('.mood-dust').forEach(d => d.remove());
}

// ===== MEMORY REVEAL =====

async function showMemoryReveal() {
  if (state.stars.length === 0) return;

  const randomStar = randomFrom(state.stars);
  const moment = state.moments.find(m => m.id === randomStar.momentId);
  if (!moment) return;

  state.currentMemoryMomentId = moment.id;

  const photoArea = document.getElementById('memory-photo-area');
  photoArea.innerHTML = '';

  if (moment.photoPath) {
    const url = await getPhotoUrlCached(moment.photoPath);
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.onerror = () => {
        img.remove();
        const em = document.createElement('span');
        em.textContent = moment.emoji;
        em.style.fontSize = '64px';
        photoArea.appendChild(em);
      };
      photoArea.appendChild(img);
    } else {
      const emoji = document.createElement('span');
      emoji.textContent = moment.emoji;
      emoji.style.fontSize = '64px';
      photoArea.appendChild(emoji);
    }
  } else if (moment.photoData) {
    const img = document.createElement('img');
    img.src = moment.photoData;
    img.onerror = () => { img.remove(); const em = document.createElement('span'); em.textContent = moment.emoji; em.style.fontSize = '64px'; photoArea.appendChild(em); };
    photoArea.appendChild(img);
  } else {
    const emoji = document.createElement('span');
    emoji.textContent = moment.emoji;
    emoji.style.fontSize = '64px';
    photoArea.appendChild(emoji);
  }

  document.getElementById('memory-text').textContent = '\u201C' + moment.text + '\u201D';
  document.getElementById('memory-date').textContent = formatDate(moment.createdAt);

  const overlay = document.getElementById('overlay-memory');
  overlay.style.transition = 'none';
  overlay.style.opacity = '0';
  overlay.style.transform = 'scale(0.97)';
  overlay.classList.add('visible');
  document.getElementById('tab-bar').classList.add('hidden');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.transition = 'opacity 0.48s ease, transform 0.48s ease';
      overlay.style.opacity = '1';
      overlay.style.transform = 'scale(1)';
    });
  });
}

// Float: star → bubble animation, then navigate home
async function floatMemory() {
  const momentId = state.currentMemoryMomentId;
  if (!momentId) return;

  const moment = state.moments.find(m => m.id === momentId);
  if (!moment) return;

  // Remove star from bottle
  const starIdx = state.stars.findIndex(s => s.momentId === momentId);
  if (starIdx !== -1) state.stars.splice(starIdx, 1);

  // Restore moment to active
  moment.status = 'active';
  state.currentMemoryMomentId = null;

  // Save to Supabase
  await Promise.all([
    updateMomentStatus(momentId, 'active'),
    deleteStar(momentId),
  ]);

  // Create a flying star → bubble element
  const frame = document.getElementById('phone-frame');
  const fr = frame.getBoundingClientRect();
  const cx = fr.left + fr.width / 2;
  const cy = fr.top + fr.height * 0.45;

  const starEl = document.createElement('div');
  starEl.textContent = '⭐';
  starEl.style.cssText = `
    position:fixed; left:${cx}px; top:${cy}px;
    font-size:28px; pointer-events:none; z-index:9999;
    transform:translate(-50%,-50%);
  `;
  document.body.appendChild(starEl);

  const bubble = document.createElement('div');
  const size = randomFrom(BUBBLE_SIZES);
  bubble.style.cssText = `
    position:fixed; left:${cx}px; top:${cy}px;
    width:0px; height:0px; border-radius:50%;
    background:${moment.color}; pointer-events:none; z-index:9998;
    transform:translate(-50%,-50%);
    display:flex; align-items:center; justify-content:center;
    font-size:20px; border:1px solid rgba(0,0,0,0.05);
    opacity:0;
  `;
  bubble.textContent = moment.emoji;
  document.body.appendChild(bubble);

  starEl.animate([
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
    { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 1, offset: 0.3 },
    { transform: 'translate(-50%,-50%) scale(0)', opacity: 0 },
  ], { duration: 600, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => starEl.remove();

  setTimeout(() => {
    bubble.animate([
      { width: '0px', height: '0px', opacity: 0 },
      { width: size + 'px', height: size + 'px', opacity: 1, offset: 0.5 },
      { width: size + 'px', height: size + 'px', opacity: 1 },
    ], { duration: 500, easing: 'cubic-bezier(0.34,1.56,0.64,1)', fill: 'forwards' });
  }, 400);

  setTimeout(() => {
    bubble.animate([
      { transform: 'translate(-50%,-50%) translateY(0)', opacity: 1 },
      { transform: 'translate(-50%,-50%) translateY(-60px)', opacity: 0 },
    ], { duration: 600, easing: 'ease-in', fill: 'forwards' }).onfinish = () => bubble.remove();
  }, 1000);

  const overlay = document.getElementById('overlay-memory');
  overlay.style.transition = 'opacity 0.5s ease';
  overlay.style.opacity = '0';

  setTimeout(() => {
    overlay.classList.remove('visible');
    overlay.style.transition = '';
    overlay.style.opacity = '';
    overlay.style.transform = '';
    document.getElementById('tab-bar').classList.remove('hidden');
    navigateTo('home');
    showToast('它飘回首页了，在那里等你 ✦');
  }, 1400);
}

// Return to bottle
function returnMemoryToBottle() {
  const momentId = state.currentMemoryMomentId;
  if (!momentId) return;

  state.currentMemoryMomentId = null;

  const frame = document.getElementById('phone-frame');
  const fr = frame.getBoundingClientRect();
  const cx = fr.left + fr.width / 2;
  const startY = fr.top + fr.height * 0.45;

  const star = document.createElement('div');
  star.textContent = '⭐';
  star.style.cssText = `
    position:fixed; left:${cx}px; top:${startY}px;
    font-size:24px; pointer-events:none; z-index:9999;
    transform:translate(-50%,-50%);
  `;
  document.body.appendChild(star);

  const targetY = fr.top + fr.height * 0.62;

  star.animate([
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, top: startY + 'px' },
    { transform: 'translate(-50%,-50%) scale(0.8)', opacity: 0.9, top: (startY + (targetY - startY) * 0.5) + 'px', offset: 0.5 },
    { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0, top: targetY + 'px' },
  ], { duration: 800, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)', fill: 'forwards' }).onfinish = () => star.remove();

  const overlay = document.getElementById('overlay-memory');
  overlay.style.transition = 'opacity 0.5s ease';
  overlay.style.opacity = '0';

  setTimeout(() => {
    overlay.classList.remove('visible');
    overlay.style.transition = '';
    overlay.style.opacity = '';
    overlay.style.transform = '';
    document.getElementById('tab-bar').classList.remove('hidden');
    navigateTo('bottle');

    setTimeout(() => {
      const bottleWrap = document.getElementById('bottle-svg-wrap');
      if (bottleWrap) {
        bottleWrap.style.animation = 'bottle-return-sway 1.2s ease-in-out';
        bottleWrap.addEventListener('animationend', () => {
          bottleWrap.style.animation = '';
        }, { once: true });
      }
    }, 200);

    showToast('轻轻放回去了，它会一直在瓶子里 ✦');
  }, 700);
}

// ===== SHARE (Poster Image) =====

async function shareMoment() {
  const moment = state.moments.find(m => m.id === state.selectedMomentId);
  if (!moment) return;
  await generatePoster(moment);
}

async function generatePoster(moment) {
  const W = 640, H = 1136;
  const PAD = 48;
  const canvas = document.getElementById('share-canvas');
  const dpr = 2;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#faf9f6';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(PAD, 52, W - PAD * 2, 1);

  ctx.font = 'italic 20px "DM Serif Display", Georgia, serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText('little something', PAD, 92);

  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.textAlign = 'right';
  ctx.fillText('✦', W - PAD, 92);
  ctx.textAlign = 'left';

  const photoH = 520;
  const emojiH = 340;

  function drawTextAndExport(y) {
    y += 28;
    ctx.font = 'italic 24px "DM Serif Display", Georgia, serif';
    ctx.fillStyle = '#2a2a2a';
    const lines = wrapText(ctx, '\u201C' + moment.text + '\u201D', W - PAD * 2 - 16);
    lines.forEach(line => {
      ctx.fillText(line, PAD + 8, y + 28);
      y += 38;
    });

    y += 20;
    ctx.font = '11px "DM Sans", sans-serif';
    ctx.fillStyle = '#bbb';
    ctx.fillText(formatDate(moment.createdAt).toUpperCase(), PAD + 8, y);

    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(PAD, H - 80, W - PAD * 2, 1);
    ctx.font = 'italic 13px "DM Serif Display", Georgia, serif';
    ctx.fillStyle = '#999';
    ctx.fillText('— a little something, worth remembering', PAD, H - 48);

    exportPoster(canvas);
  }

  // Resolve photo URL
  let photoSrc = null;
  if (moment.photoPath) {
    photoSrc = await getPhotoUrlCached(moment.photoPath);
  } else if (moment.photoData) {
    photoSrc = moment.photoData;
  }

  if (photoSrc) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const y = 120;
      ctx.save();
      roundRect(ctx, PAD, y, W - PAD * 2, photoH, 16);
      ctx.clip();
      const iw = img.width, ih = img.height;
      const aw = W - PAD * 2, ah = photoH;
      const scale = Math.max(aw / iw, ah / ih);
      const dx = PAD + (aw - iw * scale) / 2;
      const dy = y + (ah - ih * scale) / 2;
      ctx.drawImage(img, dx, dy, iw * scale, ih * scale);
      ctx.restore();
      drawTextAndExport(y + photoH);
    };
    img.onerror = () => {
      drawEmojiArea(ctx, moment.emoji, PAD, 120, W - PAD * 2, emojiH);
      drawTextAndExport(120 + emojiH);
    };
    img.src = photoSrc;
  } else {
    drawEmojiArea(ctx, moment.emoji, PAD, 120, W - PAD * 2, emojiH);
    drawTextAndExport(120 + emojiH);
  }
}

function drawEmojiArea(ctx, emoji, x, y, w, h) {
  ctx.fillStyle = '#f2f2ee';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.font = '72px serif';
  ctx.textAlign = 'center';
  ctx.fillText(emoji, x + w / 2, y + h / 2 + 24);
  ctx.textAlign = 'left';
}

function exportPoster(canvas) {
  canvas.toBlob(blob => {
    if (!blob) { showToast('生成海报失败'); return; }
    const file = new File([blob], 'little-something.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'little something' })
        .catch(() => showToast('分享已取消'));
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'little-something.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('海报已保存 ✦');
    }
  }, 'image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const char of text) {
    const test = line + char;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ===== EVENTS =====

function initEvents() {
  document.getElementById('tab-home').addEventListener('click', () => navigateTo('home'));
  document.getElementById('tab-bottle').addEventListener('click', () => navigateTo('bottle'));

  document.getElementById('fab-create').addEventListener('click', () => navigateTo('create'));

  document.getElementById('btn-bottle-icon').addEventListener('click', () => {
    if (state.currentView !== 'home') return;
    if (state.collectMode) exitCollectMode();
    else enterCollectMode();
  });

  document.getElementById('btn-collect-done').addEventListener('click', exitCollectMode);

  document.getElementById('btn-create-close').addEventListener('click', () => navigateTo('home'));

  document.getElementById('photo-picker').addEventListener('click', (e) => {
    if (e.target.id === 'photo-input') return;
    const inp = document.getElementById('photo-input');
    if (inp) inp.click();
  });

  document.getElementById('btn-save-moment').addEventListener('click', saveMoment);

  document.getElementById('moment-text').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveMoment();
  });

  document.getElementById('detail-backdrop').addEventListener('click', closeDetail);
  document.getElementById('btn-detail-share').addEventListener('click', shareMoment);

  document.getElementById('btn-unhappy').addEventListener('click', () => {
    if (state.stars.length === 0) {
      showToast('瓶子还是空的，先去收藏几个小确幸吧，它们以后会来陪你', 3200);
      return;
    }
    document.getElementById('overlay-mood-confirm').classList.add('visible');
  });

  document.getElementById('btn-mood-cancel').addEventListener('click', () => {
    document.getElementById('overlay-mood-confirm').classList.remove('visible');
  });
  document.getElementById('btn-mood-confirm').addEventListener('click', triggerMoodFlow);

  document.getElementById('btn-memory-float').addEventListener('click', floatMemory);
  document.getElementById('btn-memory-return').addEventListener('click', returnMemoryToBottle);
}


async function init() {
  updateStatusTime();
  setInterval(updateStatusTime, 30000);
  initAuthUI();
  initEvents();
  loadAuthSettings();

  if (!supabaseClient) {
    tryInitSupabase();
    syncAuthUI();
  }

  if (!supabaseClient) {
    showAuthServiceError(
      window.__sbLoadFailed
        ? '\u767b\u5f55 SDK \u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u91cd\u8bd5\uff0c\u6216\u5148\u672c\u5730\u4f7f\u7528\u3002'
        : '\u767b\u5f55\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u53ef\u4ee5\u5148\u9009\u62e9\u672c\u5730\u4f7f\u7528\u3002'
    );
    return;
  }

  showLoading();

  try {
    const sessionResult = await Promise.race([
      supabaseClient.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), AUTH_SESSION_TIMEOUT_MS))
    ]);

    const session = sessionResult?.data?.session;

      if (session) {
        state.userId = session.user.id;
        authState.pendingVerificationEmail = '';
        try {
          await Promise.race([
            loadData(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('load timeout')), 5000))
        ]);
      } catch (e) {
        console.warn('loadData timed out, using local data:', e);
        loadLocal();
      }
      hideLoading();
      hideAuth();
      requestAnimationFrame(renderBubbles);

    } else {
      hideLoading();
      showAuth('login');
    }

    supabaseClient.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === 'SIGNED_IN' && nextSession) {
        state.userId = nextSession.user.id;
        localMode = false;
        authState.pendingVerificationEmail = '';
        showLoading();
        await loadData();
        hideLoading();
        hideAuth();
        renderBubbles();

        if (shouldMigrateLocalData()) {
          await migrateLocalData();
          renderBubbles();
        }
      } else if (event === 'SIGNED_OUT') {
        state.moments = [];
        state.stars = [];
        state.userId = null;
        authState.pendingVerificationEmail = '';
        showAuth('login');
      }
    });
  } catch (e) {
    console.warn('Supabase init failed:', e);
    showAuthServiceError(
      e.message === 'timeout'
        ? '\u767b\u5f55\u670d\u52a1\u8fde\u63a5\u8f83\u6162\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\uff0c\u6216\u5148\u672c\u5730\u4f7f\u7528\u3002'
        : '\u6682\u65f6\u65e0\u6cd5\u521d\u59cb\u5316\u767b\u5f55\u670d\u52a1\uff0c\u53ef\u4ee5\u5148\u9009\u62e9\u672c\u5730\u4f7f\u7528\u3002'
    );
  }
}

document.addEventListener('DOMContentLoaded', init);
