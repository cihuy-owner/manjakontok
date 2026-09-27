function fetchWithTimeout(url, opts, ms = CONFIG.PROXY_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), ms);
        fetch(url, opts).then(
            (res) => { clearTimeout(timer); resolve(res); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

function getCachedProxy() {
    try {
        const name = localStorage.getItem(CONFIG.PROXY_CACHE_KEY);
        if (!name) return null;
        return CONFIG.PROXIES.find(p => p.name === name) || null;
    } catch { return null; }
}
function setCachedProxy(name) {
    try { localStorage.setItem(CONFIG.PROXY_CACHE_KEY, name); } catch {}
}

async function tryProxy(proxy, apiUrl, body) {
    const target = proxy.build(apiUrl);
    const opts = { method: proxy.method, headers: { 'Content-Type': 'application/json' } };
    if (proxy.method === 'POST') opts.body = JSON.stringify(body);
    const res = await fetchWithTimeout(target, opts, CONFIG.PROXY_TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

async function smartFetch(apiUrl = CONFIG.API_TARGET, body = {}) {
    const cached = getCachedProxy();
    if (cached) {
        try {
            console.log(`⚡ Coba cache: ${cached.name}`);
            const data = await tryProxy(cached, apiUrl, body);
            console.log(`✅ Cache ${cached.name} OK`);
            return { ok: true, data, via: cached.name + ' (cached)' };
        } catch (e) {
            console.warn(`⚠ Cache ${cached.name} mati`);
            localStorage.removeItem(CONFIG.PROXY_CACHE_KEY);
        }
    }
    console.log('🚀 Race semua proxy paralel...');
    const promises = CONFIG.PROXIES.map(async (proxy) => {
        const data = await tryProxy(proxy, apiUrl, body);
        return { ok: true, data, via: proxy.name, proxy };
    });
    try {
        const winner = await Promise.any(promises);
        console.log(`🏆 Menang: ${winner.via}`);
        setCachedProxy(winner.proxy.name);
        return winner;
    } catch (e) {
        console.error('❌ Semua proxy gagal');
        return { ok: false, error: 'Semua proxy gagal — cek koneksi atau API down' };
    }
}

let cloudCache = {
    maintenance: { active: false, message: 'Kami sedang melakukan pemeliharaan sistem.' },
    broadcast: { active: false, text: '', type: 'info' }
};

async function fetchCloud() {
    try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_ID}/latest`, {
            headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }, cache: 'no-store'
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const r = data.record || data;
        cloudCache = {
            maintenance: { active: r.active === true, message: r.message || 'Kami sedang melakukan pemeliharaan sistem.' },
            broadcast: { active: r.broadcastActive === true, text: r.broadcastText || '', type: r.broadcastType || 'info' }
        };
        return cloudCache;
    } catch (e) { console.warn('Gagal fetch cloud:', e); return cloudCache; }
}

async function saveCloud(updates) {
    try {
        const next = {
            active: updates.maintenance?.active ?? cloudCache.maintenance.active,
            message: updates.maintenance?.message ?? cloudCache.maintenance.message,
            broadcastActive: updates.broadcast?.active ?? cloudCache.broadcast.active,
            broadcastText: updates.broadcast?.text ?? cloudCache.broadcast.text,
            broadcastType: updates.broadcast?.type ?? cloudCache.broadcast.type
        };
        const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': CONFIG.JSONBIN_KEY },
            body: JSON.stringify(next)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (updates.maintenance) cloudCache.maintenance = { ...cloudCache.maintenance, ...updates.maintenance };
        if (updates.broadcast) cloudCache.broadcast = { ...cloudCache.broadcast, ...updates.broadcast };
        return true;
    } catch (e) { console.error(e); return false; }
}

const getUsers = () => { try { return JSON.parse(localStorage.getItem(CONFIG.KEYS.USERS)) || {}; } catch { return {}; } };
const saveUsers = (u) => localStorage.setItem(CONFIG.KEYS.USERS, JSON.stringify(u));
const getSession = () => { try { return JSON.parse(localStorage.getItem(CONFIG.KEYS.SESSION)); } catch { return null; } };
const setSession = (u, isAdmin=false, adminName=null, userRole=null) => localStorage.setItem(CONFIG.KEYS.SESSION, JSON.stringify({ username: u, isAdmin, adminName, userRole, at: Date.now() }));
const clearSession = () => localStorage.removeItem(CONFIG.KEYS.SESSION);
const getActivity = () => { try { return JSON.parse(localStorage.getItem(CONFIG.KEYS.ACTIVITY)) || []; } catch { return []; } };
const saveActivity = (a) => localStorage.setItem(CONFIG.KEYS.ACTIVITY, JSON.stringify(a.slice(0, 100)));

function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return 'h_' + Math.abs(h).toString(36);
}

function logActivity(username, action='login', extra={}) {
    const acts = getActivity();
    acts.unshift({
        id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        username, action,
        time: Date.now(),
        ua: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
        ...extra
    });
    saveActivity(acts);
}

function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function isExpired(user) { if (!user.expiresAt) return false; return Date.now() > user.expiresAt; }
function getDaysLeft(user) {
    if (!user.expiresAt) return null;
    const ms = user.expiresAt - Date.now();
    if (ms < 0) return 0;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
function checkDailyReset(user) {
    if (user.stats.lastResetDate !== todayKey()) {
        user.stats.todayCount = 0;
        user.stats.lastResetDate = todayKey();
        return true;
    }
    return false;
}
function canGenerate(user) {
    if (isExpired(user)) return { ok: false, reason: 'expired', msg: 'Akun kamu sudah expired' };
    if (user.banned) return { ok: false, reason: 'banned', msg: 'Akun kamu diblokir admin' };
    checkDailyReset(user);
    if (user.stats.todayCount >= user.dailyLimit) return { ok: false, reason: 'limit', msg: `Kuota harian habis (${user.dailyLimit}/${user.dailyLimit})` };
    if (user.stats.lastGen) {
        const cooldownMs = (user.cooldownMinutes || CONFIG.DEFAULT_COOLDOWN) * 60 * 1000;
        const elapsed = Date.now() - user.stats.lastGen;
        if (elapsed < cooldownMs) {
            const remain = Math.ceil((cooldownMs - elapsed) / 1000);
            return { ok: false, reason: 'cooldown', msg: 'Cooldown', remain };
        }
    }
    return { ok: true };
}
