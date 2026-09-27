const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
};

function toast(msg, type='info', duration=3000) {
    const stack = document.getElementById('toastStack');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<div class="toast-icon">${ICONS[type]}</div><div>${msg}</div>`;
    stack.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, duration);
}

function togglePass(inputId, btn) {
    const inp = document.getElementById(inputId);
    const svg = btn.querySelector('svg');
    if (inp.type === 'password') {
        inp.type = 'text';
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
        inp.type = 'password';
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
}

function toggleFaq(el) { el.classList.toggle('open'); }

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const map = { landing:'screenLanding', login:'screenLogin', register:'screenRegister', dashboard:'screenDashboard', admin:'screenAdmin', maint:'screenMaint' };
    const el = document.getElementById(map[name]);
    if (el) el.classList.add('active');
    if (name !== 'login') document.getElementById('loginError').classList.remove('show');
    if (name !== 'register') document.getElementById('regError').classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== REGISTER =====
document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const pass = document.getElementById('regPass').value;
    const conf = document.getElementById('regPassConfirm').value;
    const errEl = document.getElementById('regError');
    const errText = document.getElementById('regErrorText');
    const showErr = (m) => { errText.textContent = m; errEl.classList.add('show'); toast(m, 'error'); };
    if (username.length < 3) return showErr('Username minimal 3 karakter');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return showErr('Username hanya huruf, angka, underscore');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('Format email tidak valid');
    if (pass.length < 6) return showErr('Password minimal 6 karakter');
    if (pass !== conf) return showErr('Konfirmasi password tidak cocok');
    const users = getUsers();
    const key = username.toLowerCase();
    if (users[key]) return showErr('Username sudah terdaftar');
    if (CONFIG.ADMINS.some(a => a.username === key)) return showErr('Username tidak boleh dipakai');
    if (Object.values(users).some(u => u.email === email)) return showErr('Email sudah terdaftar');
    const now = Date.now();
    users[key] = {
        username, email, password: hash(pass), plainPassword: pass,
        role: 'member', type: 'trial', createdAt: now,
        expiresAt: now + (CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000),
        dailyLimit: CONFIG.DEFAULT_DAILY_LIMIT,
        cooldownMinutes: CONFIG.DEFAULT_COOLDOWN,
        banned: false, lastLogin: null,
        stats: { total: 0, lastGen: null, todayCount: 0, lastResetDate: todayKey() }
    };
    saveUsers(users);
    errEl.classList.remove('show');
    toast(`Trial aktif! Kamu punya akses ${CONFIG.TRIAL_DAYS} hari`, 'success', 5000);
    document.getElementById('registerForm').reset();
    showScreen('login');
    document.getElementById('loginUser').value = username;
});

// ===== LOGIN =====
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('loginUser').value.trim().toLowerCase();
    const pass = document.getElementById('loginPass').value;
    const errEl = document.getElementById('loginError');
    const errText = document.getElementById('loginErrorText');
    const showErr = (m) => { errText.textContent = m; errEl.classList.add('show'); toast(m, 'error'); };
    const hardAdmin = CONFIG.ADMINS.find(a => a.username === input);
    if (hardAdmin) {
        if (pass !== hardAdmin.password) return showErr('Password admin salah');
        errEl.classList.remove('show');
        setSession('__admin__', true, hardAdmin.username, 'admin');
        logActivity(hardAdmin.username, 'login-admin');
        document.getElementById('loginForm').reset();
        toast(`Login admin (${hardAdmin.username}) berhasil`, 'success');
        openAdmin(hardAdmin.username);
        return;
    }
    const users = getUsers();
    let key = users[input] ? input : Object.keys(users).find(k => users[k].email === input);
    if (!key) return showErr('Akun tidak ditemukan');
    const user = users[key];
    if (user.password !== hash(pass)) return showErr('Password salah');
    if (user.banned) return showErr('Akun kamu diblokir admin');
    if (isExpired(user)) return showErr(`Akun sudah expired (trial ${CONFIG.TRIAL_DAYS} hari habis)`);
    const c = await fetchCloud();
    if (c.maintenance.active && user.role !== 'admin') {
        const msgEl = document.getElementById('maintMessage');
        if (c.maintenance.message) msgEl.textContent = c.maintenance.message;
        updateMaintCountdown();
        showScreen('maint');
        return;
    }
    user.lastLogin = Date.now();
    saveUsers(users);
    errEl.classList.remove('show');
    setSession(key, false, null, user.role);
    logActivity(user.username, 'login');
    document.getElementById('loginForm').reset();
    if (user.role === 'admin') { toast(`Login admin (${user.username})`, 'success'); openAdmin(user.username); }
    else { toast(`Selamat datang, ${user.username}!`, 'success'); openDashboard(key); startMaintPoller(); }
});

// ===== DASHBOARD =====
function openDashboard(username) {
    const user = getUsers()[username];
    if (!user) return logout();
    document.getElementById('displayUser').textContent = user.username;
    document.getElementById('userAvatar').textContent = user.username.charAt(0).toUpperCase();
    document.getElementById('statTotal').textContent = user.stats?.total || 0;
    document.getElementById('statLast').textContent = user.stats?.lastGen ? new Date(user.stats.lastGen).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const roleEl = document.getElementById('displayUserRole');
    const daysLeft = getDaysLeft(user);
    if (user.type === 'trial' && daysLeft !== null) {
        roleEl.textContent = `Trial · ${daysLeft} hari lagi`;
        roleEl.className = 'urole trial';
        document.getElementById('statExpiryLbl').textContent = 'Sisa Trial';
        document.getElementById('statJoined').textContent = `${daysLeft} hari`;
    } else {
        roleEl.textContent = user.role === 'admin' ? 'Admin' : 'Member';
        roleEl.className = 'urole' + (user.role === 'admin' ? ' admin' : '');
        document.getElementById('statExpiryLbl').textContent = 'Bergabung Sejak';
        document.getElementById('statJoined').textContent = new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    updateLimitUI(user);
    showUserBroadcast();
    showScreen('dashboard');
    startCooldownTimer();
    updateNotifButton();
}

function updateLimitUI(user) {
    checkDailyReset(user);
    const remaining = Math.max(0, user.dailyLimit - user.stats.todayCount);
    document.getElementById('limitRemaining').textContent = `${remaining} / ${user.dailyLimit}`;
    const cd = user.cooldownMinutes || CONFIG.DEFAULT_COOLDOWN;
    const cdEl = document.getElementById('cooldownInfo');
    if (user.stats.lastGen) {
        const elapsed = Date.now() - user.stats.lastGen;
        const cooldownMs = cd * 60 * 1000;
        if (elapsed < cooldownMs) {
            const remain = Math.ceil((cooldownMs - elapsed) / 1000);
            cdEl.textContent = `${remain}s lagi`;
        } else cdEl.textContent = `${cd} menit (siap)`;
    } else cdEl.textContent = `${cd} menit (siap)`;
}

let cooldownTimer = null;
function startCooldownTimer() {
    if (cooldownTimer) clearInterval(cooldownTimer);
    const btn = document.getElementById('generateBtn');
    const notice = document.getElementById('cooldownNotice');
    const btnText = document.getElementById('generateBtnText');
    function tick() {
        const session = getSession();
        if (!session || session.isAdmin) return;
        const users = getUsers();
        const user = users[session.username];
        if (!user) return;
        updateLimitUI(user);
        const check = canGenerate(user);
        if (check.ok) {
            btn.classList.remove('on-cooldown');
            btnText.textContent = 'Generate Sekarang';
            notice.classList.remove('show');
            if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
        } else if (check.reason === 'cooldown') {
            btn.classList.add('on-cooldown');
            btnText.textContent = `Cooldown (${check.remain}s)`;
            notice.classList.add('show');
            notice.innerHTML = `⏱️ Tunggu <strong>${check.remain} detik</strong> lagi sebelum generate lagi.`;
        } else if (check.reason === 'limit') {
            btn.classList.add('on-cooldown');
            btnText.textContent = 'Kuota Habis';
            notice.classList.add('show');
            notice.innerHTML = `🎯 Kuota harian habis (<strong>${user.dailyLimit}/${user.dailyLimit}</strong>). Reset jam 00:00.`;
        }
    }
    tick();
    cooldownTimer = setInterval(tick, 1000);
}

function dismissBroadcast() {
    document.getElementById('userBroadcast').classList.remove('show');
    sessionStorage.setItem(CONFIG.KEYS.DISMISS, '1');
}
function showUserBroadcast() {
    const bc = cloudCache.broadcast;
    const el = document.getElementById('userBroadcast');
    const txt = document.getElementById('userBroadcastText');
    if (!bc.active || !bc.text) { el.classList.remove('show'); return; }
    if (sessionStorage.getItem(CONFIG.KEYS.DISMISS) === '1') { el.classList.remove('show'); return; }
    el.className = 'broadcast-banner ' + (bc.type || 'info');
    txt.textContent = bc.text;
    el.classList.add('show');
}

let maintPoller = null;
function startMaintPoller() {
    if (maintPoller) clearInterval(maintPoller);
    maintPoller = setInterval(async () => {
        const session = getSession();
        if (session?.isAdmin) return;
        const c = await fetchCloud();
        const isOnMaintScreen = document.getElementById('screenMaint').classList.contains('active');
        if (c.maintenance.active && !isOnMaintScreen) {
            const msgEl = document.getElementById('maintMessage');
            if (c.maintenance.message) msgEl.textContent = c.maintenance.message;
            showScreen('maint');
            updateMaintCountdown();
            toast('Website sedang maintenance', 'warning');
        } else if (!c.maintenance.active && isOnMaintScreen) {
            clearSession();
            showScreen('login');
            toast('Maintenance selesai. Silakan login.', 'success');
        }
    }, 60000);
}

let countdownVal = 60;
function updateMaintCountdown() {
    countdownVal = 60;
    const el = document.getElementById('maintCountdown');
    if (!el) return;
    el.textContent = `Cek otomatis dalam ${countdownVal}s...`;
    if (window._countdownInt) clearInterval(window._countdownInt);
    window._countdownInt = setInterval(() => {
        countdownVal--;
        if (countdownVal <= 0) { countdownVal = 60; el.textContent = 'Memeriksa status...'; }
        else el.textContent = `Cek otomatis dalam ${countdownVal}s...`;
    }, 1000);
}

// ===== ADMIN =====
async function openAdmin(adminName = 'admin') {
    document.getElementById('adminName').textContent = adminName;
    document.getElementById('adminAvatar').textContent = adminName.charAt(0).toUpperCase();
    document.getElementById('adminGenName').textContent = adminName;
    showScreen('admin');
    renderUsers();
    renderActivity();
    renderAdminGenStats();
    await loadMaintUI();
    await loadBroadcastUI();
}

function switchTab(tab, btn) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
    if (tab === 'activity') renderActivity();
    if (tab === 'users') renderUsers();
    if (tab === 'generator') renderAdminGenStats();
    if (tab === 'broadcast') loadBroadcastUI();
}

function renderUsers() {
    const users = getUsers();
    const cont = document.getElementById('usersList');
    const keys = Object.keys(users);
    if (keys.length === 0) {
        cont.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>Belum ada user terdaftar</p></div>`;
        return;
    }
    const rows = keys.map(k => {
        const u = users[k];
        const lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belum pernah';
        const isOnline = u.lastLogin && (Date.now() - u.lastLogin) < 5 * 60 * 1000;
        const pass = u.plainPassword || '(tidak tersimpan)';
        const passId = 'pass_' + k;
        const safePass = pass.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const expired = isExpired(u);
        const daysLeft = getDaysLeft(u);
        let typeTag = '';
        if (u.role === 'admin') typeTag = '<span class="tag admin">👑 Admin</span>';
        else if (u.type === 'trial') typeTag = `<span class="tag trial">🎁 Trial${daysLeft !== null ? ' · ' + daysLeft + 'h' : ''}</span>`;
        else typeTag = '<span class="tag user">👤 Member</span>';
        let statusTag = '';
        if (expired) statusTag = '<span class="tag expired">⏰ Expired</span>';
        else if (u.banned) statusTag = '<span class="tag expired">🚫 Banned</span>';
        else if (isOnline) statusTag = '<span class="tag online">● Online</span>';
        else statusTag = '<span class="tag offline">○ Offline</span>';
        checkDailyReset(u);
        const limitInfo = `${u.stats.todayCount}/${u.dailyLimit} hari ini`;
        return `<tr>
            <td><div class="cell-user"><div class="mini-avatar ${u.role === 'admin' ? 'admin' : (u.type === 'trial' ? 'trial' : '')}">${u.username.charAt(0).toUpperCase()}</div><div><div class="un">${u.username} ${typeTag}</div><div class="em">${u.email}</div></div></div></td>
            <td><div class="pass-cell"><span class="pass-val hidden" id="${passId}">${'•'.repeat(Math.min(pass.length, 12))}</span><button class="pass-eye" onclick="toggleUserPass('${passId}','${safePass}',this)" title="Lihat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button><button class="pass-eye" onclick="copyText('${safePass}')" title="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div></td>
            <td>${statusTag}</td>
            <td style="font-size:.75rem;color:var(--text-dim)">${limitInfo}<br><span style="color:var(--text-muted)">Cooldown: ${u.cooldownMinutes}min</span></td>
            <td style="color:var(--text-dim);font-size:0.75rem;">${lastLogin}</td>
            <td><button class="btn-icon danger" onclick="deleteUser('${k}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td>
        </tr>`;
    }).join('');
    cont.innerHTML = `<div class="table-wrap"><table><thead><tr><th>User</th><th>Password</th><th>Status</th><th>Limit</th><th>Login Terakhir</th><th>Hapus</th></tr></thead><tbody>${rows}</tbody></table></div><div style="margin-top:1rem;font-size:0.78rem;color:var(--text-muted);">Total: ${keys.length} user</div>`;
}

function toggleUserPass(spanId, realPass, btn) {
    const span = document.getElementById(spanId);
    const isHidden = span.classList.contains('hidden');
    if (isHidden) {
        span.textContent = realPass;
        span.classList.remove('hidden');
        btn.querySelector('svg').innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
        span.textContent = '•'.repeat(Math.min(realPass.length, 12));
        span.classList.add('hidden');
        btn.querySelector('svg').innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
}

function copyText(text) {
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => toast('Disalin', 'success')).catch(() => toast('Gagal menyalin', 'error'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        toast('Disalin', 'success');
    }
}

function deleteUser(key) {
    const users = getUsers();
    if (!users[key]) return;
    if (!confirm(`Hapus user "${users[key].username}"?`)) return;
    const uname = users[key].username;
    delete users[key];
    saveUsers(users);
    toast(`User "${uname}" dihapus`, 'success');
    renderUsers();
}

let selectedRole = 'member';
function pickRole(role) {
    selectedRole = role;
    document.querySelectorAll('.role-option').forEach(el => {
        el.classList.toggle('active', el.dataset.role === role);
        el.classList.toggle('member', role === 'member');
    });
}
document.getElementById('createType').addEventListener('change', (e) => {
    document.getElementById('customExpiryRow').style.display = e.target.value === 'custom' ? 'grid' : 'none';
});

function createAccount() {
    const username = document.getElementById('createUser').value.trim();
    const email = document.getElementById('createEmail').value.trim().toLowerCase();
    const pass = document.getElementById('createPass').value;
    const type = document.getElementById('createType').value;
    const dailyLimit = parseInt(document.getElementById('createDailyLimit').value) || 10;
    const cooldown = parseInt(document.getElementById('createCooldown').value) || 5;
    const expiryDays = parseInt(document.getElementById('createExpiryDays').value) || 7;
    const errEl = document.getElementById('createError');
    const errText = document.getElementById('createErrorText');
    const showErr = (m) => { errText.textContent = m; errEl.classList.add('show'); toast(m, 'error'); };
    if (username.length < 3) return showErr('Username minimal 3 karakter');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return showErr('Username hanya huruf, angka, underscore');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('Format email tidak valid');
    if (pass.length < 6) return showErr('Password minimal 6 karakter');
    if (dailyLimit < 1 || dailyLimit > 999) return showErr('Limit harian: 1-999');
    if (cooldown < 0 || cooldown > 120) return showErr('Cooldown: 0-120 menit');
    const users = getUsers();
    const key = username.toLowerCase();
    if (users[key]) return showErr('Username sudah terdaftar');
    if (CONFIG.ADMINS.some(a => a.username === key)) return showErr('Username tidak boleh dipakai');
    if (Object.values(users).some(u => u.email === email)) return showErr('Email sudah terdaftar');
    const now = Date.now();
    let expiresAt = null;
    if (type === 'trial') expiresAt = now + (CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000);
    else if (type === 'custom') expiresAt = now + (expiryDays * 24 * 60 * 60 * 1000);
    users[key] = {
        username, email, password: hash(pass), plainPassword: pass,
        role: selectedRole, type: type === 'custom' ? 'custom' : type,
        createdAt: now, expiresAt, dailyLimit, cooldownMinutes: cooldown,
        banned: false, lastLogin: null,
        stats: { total: 0, lastGen: null, todayCount: 0, lastResetDate: todayKey() }
    };
    saveUsers(users);
    errEl.classList.remove('show');
    const typeLbl = type === 'trial' ? 'Trial 3 hari' : (type === 'custom' ? `${expiryDays} hari` : 'Permanent');
    toast(`Akun "${username}" dibuat (${selectedRole}, ${typeLbl})`, 'success', 4000);
    document.getElementById('createUser').value = '';
    document.getElementById('createEmail').value = '';
    document.getElementById('createPass').value = '';
    document.getElementById('createDailyLimit').value = '10';
    document.getElementById('createCooldown').value = '5';
    document.getElementById('createType').value = 'permanent';
    document.getElementById('customExpiryRow').style.display = 'none';
    selectedRole = 'member';
    document.querySelectorAll('.role-option').forEach(el => el.classList.toggle('active', el.dataset.role === 'member'));
    renderUsers();
}

function renderActivity() {
    const acts = getActivity();
    const cont = document.getElementById('activityList');
    if (acts.length === 0) {
        cont.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p>Belum ada aktivitas</p></div>`;
        return;
    }
    const rows = acts.map(a => {
        const isAdminAct = a.action?.includes('admin') || a.isAdmin;
        const isGen = a.action === 'generate' || a.action === 'generate-admin';
        const actionLabel = a.action === 'login-admin' ? '🔐 Login Admin' : a.action === 'logout-admin' ? '🔒 Logout Admin' : a.action === 'login' ? '🔓 Login' : a.action === 'logout' ? '🚪 Logout' : a.action === 'generate' ? '🎬 Generate Akun' : a.action === 'generate-admin' ? '🎬 Generate (Admin)' : a.action;
        const tagClass = isGen ? 'gen' : (isAdminAct ? 'admin' : 'user');
        const tagText = isGen ? 'GEN' : (isAdminAct ? 'ADMIN' : 'USER');
        return `<tr><td><div class="cell-user"><div class="mini-avatar ${isAdminAct ? 'admin' : ''}">${a.username.charAt(0).toUpperCase()}</div><div><div class="un">${a.username}</div><div class="em">${actionLabel}</div></div></div></td><td><span class="tag ${tagClass}">${tagText}</span></td><td style="color:var(--text-dim);font-size:0.78rem;">${a.ua}</td><td style="color:var(--text-dim);font-size:0.78rem;">${new Date(a.time).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td><button class="btn-icon danger" onclick="deleteActivityItem('${a.id}')" title="Hapus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>`;
    }).join('');
    cont.innerHTML = `<div class="table-wrap"><table><thead><tr><th>User</th><th>Tipe</th><th>Device</th><th>Waktu</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div><div style="margin-top:1rem;font-size:0.78rem;color:var(--text-muted);">Total: ${acts.length} aktivitas</div>`;
}

function deleteActivityItem(id) {
    const acts = getActivity();
    const idx = acts.findIndex(a => a.id === id);
    if (idx === -1) return;
    const a = acts[idx];
    if (!confirm(`Hapus log "${a.username} - ${a.action}"?`)) return;
    acts.splice(idx, 1);
    saveActivity(acts);
    toast('Log dihapus', 'success');
    renderActivity();
}

function clearActivity() {
    if (!confirm('Hapus SEMUA log aktivitas?')) return;
    saveActivity([]);
    toast('Semua log dibersihkan', 'success');
    renderActivity();
}

function renderAdminGenStats() {
    const session = getSession();
    const adminName = session?.adminName || session?.username || 'admin';
    document.getElementById('adminGenName').textContent = adminName;
    const acts = getActivity();
    const genCount = acts.filter(a => a.action === 'generate-admin' && a.username === adminName).length;
    document.getElementById('adminGenTotal').textContent = genCount;
    const lastGen = acts.find(a => a.action === 'generate-admin' && a.username === adminName);
    document.getElementById('adminGenLast').textContent = lastGen ? new Date(lastGen.time).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

async function adminGenerate() {
    const session = getSession();
    if (!session?.isAdmin) { toast('Bukan admin', 'error'); return; }
    const adminName = session.adminName || 'admin';
    const btn = document.getElementById('adminGenerateBtn');
    const loader = document.getElementById('adminLoader');
    const box = document.getElementById('adminResultBox');
    btn.disabled = true;
    btn.style.display = 'none';
    loader.classList.add('show');
    box.classList.remove('show');
    box.innerHTML = '';
    try {
        const result = await smartFetch(CONFIG.API_TARGET, {});
        if (!result.ok) throw new Error(result.error);
        const data = result.data;
        renderResultTo(data, box);
        if (data.status && data.result) {
            logActivity(adminName, 'generate-admin', { isAdmin: true });
            renderAdminGenStats();
            renderActivity();
            toast(`✅ Berhasil via ${result.via}`, 'success');
        }
    } catch (err) {
        console.error(err);
        toast('❌ ' + err.message, 'error', 5000);
    } finally {
        btn.disabled = false;
        btn.style.display = 'flex';
        loader.classList.remove('show');
    }
}

function copy(text, btn) {
    const done = () => {
        btn.classList.add('done');
        const orig = btn.innerHTML;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Tersalin';
        setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = orig; }, 1500);
    };
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
    function fallback() {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch { toast('Gagal menyalin', 'error'); }
        document.body.removeChild(ta);
    }
}

function fieldRow(label, value) {
    const row = document.createElement('div');
    row.className = 'field';
    const l = document.createElement('span');
    l.className = 'field-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'field-value' + (value.length > 100 ? ' truncate' : '');
    v.textContent = value;
    const b = document.createElement('button');
    b.className = 'copy-btn';
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
    b.onclick = () => copy(value, b);
    row.append(l, v, b);
    return row;
}

function renderResultTo(data, box) {
    box.innerHTML = '';
    if (!data?.status || !data?.result) { toast('API mengembalikan data kosong', 'error'); return; }
    const r = data.result;
    const head = document.createElement('div');
    head.className = 'result-header';
    head.innerHTML = `<div class="result-header-left"><div class="check-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><div><div class="result-title">Akun Berhasil Dibuat</div><div class="result-sub">ID: ${r.id || '-'}</div></div></div><div class="pill-row"><span class="pill success">Sukses</span>${r.type ? `<span class="pill type">${r.type}</span>` : ''}</div>`;
    const body = document.createElement('div');
    body.className = 'result-body';
    if (r.expiry) body.appendChild(fieldRow('Expiry', r.expiry));
    if (r.profile?.country) body.appendChild(fieldRow('Negara', r.profile.country));
    if (r.profile?.plan) body.appendChild(fieldRow('Plan', r.profile.plan));
    if (r.token) {
        const t = document.createElement('div');
        t.className = 'section-title';
        t.textContent = 'Token';
        body.appendChild(t);
        body.appendChild(fieldRow('Token', r.token));
    }
    if (r.links) {
        const t = document.createElement('div');
        t.className = 'section-title';
        t.textContent = 'Login Links';
        body.appendChild(t);
        const grid = document.createElement('div');
        grid.className = 'links-grid';
        [{k:'pc',label:'PC / Browser',icon:'💻'},{k:'android',label:'Android',icon:'📱'},{k:'tv',label:'Smart TV',icon:'📺'}].forEach(i => {
            if (r.links[i.k]) {
                const a = document.createElement('a');
                a.className = 'link-card';
                a.href = r.links[i.k];
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.innerHTML = `<div class="ic">${i.icon}</div><div class="nm">${i.label}</div><div class="hint">Klik untuk buka</div>`;
                grid.appendChild(a);
            }
        });
        body.appendChild(grid);
    }
    const copyAll = document.createElement('button');
    copyAll.className = 'btn-copy-all';
    copyAll.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Semua Data';
    copyAll.onclick = () => {
        let txt = '=== NEXFLIX ACCOUNT ===\n\n';
        if (r.id) txt += `ID: ${r.id}\n`;
        if (r.expiry) txt += `Expiry: ${r.expiry}\n`;
        if (r.type) txt += `Type: ${r.type}\n`;
        if (r.profile?.country) txt += `Country: ${r.profile.country}\n`;
        if (r.profile?.plan) txt += `Plan: ${r.profile.plan}\n`;
        if (r.token) txt += `\nToken:\n${r.token}\n`;
        if (r.links) {
            txt += '\nLinks:\n';
            if (r.links.pc) txt += `PC: ${r.links.pc}\n`;
            if (r.links.android) txt += `Android: ${r.links.android}\n`;
            if (r.links.tv) txt += `TV: ${r.links.tv}\n`;
        }
        copy(txt, copyAll);
    };
    body.appendChild(copyAll);
    box.append(head, body);
    box.classList.add('show');
}

async function generate() {
    const session = getSession();
    if (!session || session.isAdmin) { toast('Sesi habis, silakan login', 'error'); return logout(); }
    const users = getUsers();
    const user = users[session.username];
    if (!user) { toast('User tidak ditemukan', 'error'); return logout(); }
    const check = canGenerate(user);
    if (!check.ok) {
        if (check.reason === 'expired') { toast('Akun sudah expired. Hubungi admin.', 'error', 4000); return logout(); }
        if (check.reason === 'banned') { toast('Akun diblokir admin.', 'error'); return logout(); }
        if (check.reason === 'limit') { toast(check.msg, 'warning', 4000); return; }
        if (check.reason === 'cooldown') { toast(`Tunggu ${check.remain}s lagi`, 'warning'); return; }
    }
    const c = await fetchCloud();
    if (c.maintenance.active) {
        const msgEl = document.getElementById('maintMessage');
        if (c.maintenance.message) msgEl.textContent = c.maintenance.message;
        updateMaintCountdown();
        showScreen('maint');
        toast('Website maintenance', 'warning');
        return;
    }
    const btn = document.getElementById('generateBtn');
    const loader = document.getElementById('loader');
    const box = document.getElementById('resultBox');
    btn.disabled = true;
    btn.style.display = 'none';
    loader.classList.add('show');
    box.classList.remove('show');
    box.innerHTML = '';
    try {
        const result = await smartFetch(CONFIG.API_TARGET, {});
        if (!result.ok) throw new Error(result.error);
        const data = result.data;
        renderResultTo(data, box);
        if (data.status && data.result) {
            user.stats.total = (user.stats.total || 0) + 1;
            user.stats.lastGen = Date.now();
            user.stats.todayCount = (user.stats.todayCount || 0) + 1;
            user.stats.lastResetDate = todayKey();
            saveUsers(users);
            document.getElementById('statTotal').textContent = user.stats.total;
            document.getElementById('statLast').textContent = new Date(user.stats.lastGen).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            updateLimitUI(user);
            logActivity(session.username, 'generate');
            toast(`✅ Berhasil via ${result.via}`, 'success');
            startCooldownTimer();
        }
    } catch (err) {
        console.error(err);
        toast('❌ ' + err.message, 'error', 5000);
    } finally {
        btn.disabled = false;
        btn.style.display = 'flex';
        loader.classList.remove('show');
    }
}

function logout() {
    const s = getSession();
    if (s?.isAdmin) logActivity(s.adminName || 'admin', 'logout-admin');
    else if (s?.username) logActivity(s.username, 'logout');
    clearSession();
    sessionStorage.removeItem(CONFIG.KEYS.DISMISS);
    if (maintPoller) { clearInterval(maintPoller); maintPoller = null; }
    if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
    if (typeof stopNotifPoller === 'function') stopNotifPoller();
    document.getElementById('resultBox').classList.remove('show');
    document.getElementById('resultBox').innerHTML = '';
    document.getElementById('adminResultBox').classList.remove('show');
    document.getElementById('adminResultBox').innerHTML = '';
    showScreen('landing');
    toast('Anda telah keluar', 'info');
}

async function loadMaintUI() {
    const dot = document.getElementById('maintStatusDot');
    const txt = document.getElementById('maintStatusText');
    txt.textContent = 'Mengambil status...';
    const c = await fetchCloud();
    const sw = document.getElementById('maintSwitch');
    const inp = document.getElementById('maintMsgInput');
    sw.classList.toggle('on', c.maintenance.active);
    inp.value = c.maintenance.message || '';
    if (c.maintenance.active) { dot.className = 'status-dot warn'; txt.textContent = '🔴 MAINTENANCE AKTIF'; }
    else { dot.className = 'status-dot'; txt.textContent = '🟢 Website normal'; }
}

async function toggleMaintenance() {
    const sw = document.getElementById('maintSwitch');
    const newState = !sw.classList.contains('on');
    const message = document.getElementById('maintMsgInput').value.trim() || 'Kami sedang melakukan pemeliharaan sistem. Silakan kembali lagi nanti.';
    sw.classList.add('loading');
    sw.classList.toggle('on', newState);
    const ok = await saveCloud({ maintenance: { active: newState, message } });
    sw.classList.remove('loading');
    if (!ok) { sw.classList.toggle('on', !newState); toast('Gagal menyimpan', 'error'); return; }
    const dot = document.getElementById('maintStatusDot');
    const txt = document.getElementById('maintStatusText');
    if (newState) { dot.className = 'status-dot warn'; txt.textContent = '🔴 MAINTENANCE AKTIF'; toast('⚠ Maintenance aktif', 'warning', 4000); }
    else { dot.className = 'status-dot'; txt.textContent = '🟢 Website normal'; toast('✓ Maintenance dimatikan', 'success', 4000); }
}

async function saveMaintMessage() {
    const msg = document.getElementById('maintMsgInput').value.trim() || 'Kami sedang melakukan pemeliharaan sistem.';
    const active = document.getElementById('maintSwitch').classList.contains('on');
    const ok = await saveCloud({ maintenance: { active, message: msg } });
    toast(ok ? 'Pesan disimpan' : 'Gagal', ok ? 'success' : 'error');
}

async function loadBroadcastUI() {
    const dot = document.getElementById('bcStatusDot');
    const txt = document.getElementById('bcStatusText');
    txt.textContent = 'Mengambil status...';
    const c = await fetchCloud();
    const sw = document.getElementById('bcSwitch');
    const inp = document.getElementById('bcTextInput');
    sw.classList.toggle('on', c.broadcast.active);
    inp.value = c.broadcast.text || '';
    document.querySelectorAll('.bc-type-btn').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.type === c.broadcast.type) b.classList.add('active');
    });
    if (c.broadcast.active) { dot.className = 'status-dot warn'; txt.textContent = '📢 BROADCAST AKTIF'; }
    else { dot.className = 'status-dot'; txt.textContent = '⚪ Broadcast tidak aktif'; }
}

let selectedBcType = 'info';
function pickBcType(type, btn) {
    selectedBcType = type;
    document.querySelectorAll('.bc-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function toggleBroadcast() {
    const sw = document.getElementById('bcSwitch');
    const newState = !sw.classList.contains('on');
    const text = document.getElementById('bcTextInput').value.trim();
    if (newState && !text) { toast('Isi pesan broadcast dulu', 'error'); return; }
    sw.classList.add('loading');
    sw.classList.toggle('on', newState);
    const ok = await saveCloud({ broadcast: { active: newState, text, type: selectedBcType } });
    sw.classList.remove('loading');
    if (!ok) { sw.classList.toggle('on', !newState); toast('Gagal menyimpan', 'error'); return; }
    await loadBroadcastUI();
    toast(newState ? '📢 Broadcast aktif' : '✓ Broadcast dimatikan', newState ? 'info' : 'success');
}

async function saveBroadcast() {
    const text = document.getElementById('bcTextInput').value.trim();
    if (!text) { toast('Isi pesan dulu', 'error'); return; }
    const active = document.getElementById('bcSwitch').classList.contains('on');
    const ok = await saveCloud({ broadcast: { active, text, type: selectedBcType } });
    toast(ok ? 'Broadcast disimpan' : 'Gagal', ok ? 'success' : 'error');
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('generateBtn').addEventListener('click', generate);
    document.getElementById('adminGenerateBtn').addEventListener('click', adminGenerate);
    if (typeof updateNotifButton === 'function') updateNotifButton();
    if (localStorage.getItem('nexflix_notif_enabled') === 'on'
        && 'Notification' in window
        && Notification.permission === 'granted'
        && typeof startNotifPoller === 'function') {
        startNotifPoller();
    }
    await fetchCloud();
    const session = getSession();
    if (session?.isAdmin && session.username === '__admin__') {
        openAdmin(session.adminName || 'admin');
        return;
    }
    if (cloudCache.maintenance.active) {
        const msgEl = document.getElementById('maintMessage');
        if (cloudCache.maintenance.message) msgEl.textContent = cloudCache.maintenance.message;
        showScreen('maint');
        updateMaintCountdown();
        startMaintPoller();
        return;
    }
    if (session && getUsers()[session.username]) {
        const user = getUsers()[session.username];
        if (user.role === 'admin') openAdmin(user.username);
        else { openDashboard(session.username); startMaintPoller(); }
    } else {
        clearSession();
        showScreen('landing');
        startMaintPoller();
    }
});
