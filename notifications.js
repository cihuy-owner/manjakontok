const NOTIF_CONFIG = {
    checkInterval: 30000,
    storageKey: 'nexflix_notif_state',
    prefKey: 'nexflix_notif_enabled'
};

async function requestNotifPermission() {
    if (!('Notification' in window)) {
        toast('Browser kamu tidak mendukung notifikasi', 'error');
        return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
        toast('Notifikasi diblokir. Buka setting browser → Site Settings → Notifications', 'error', 6000);
        return false;
    }
    try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            showNotification('🔔 Notifikasi Aktif', 'Kamu akan menerima notifikasi maintenance & pengumuman terbaru.');
            return true;
        }
        return false;
    } catch (e) { console.error(e); return false; }
}

function showNotification(title, body, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        const notif = new Notification(title, {
            body,
            icon: options.icon || 'https://cdn-icons-png.flaticon.com/512/732/732228.png',
            badge: options.badge || 'https://cdn-icons-png.flaticon.com/512/732/732228.png',
            vibrate: options.vibrate || [200, 100, 200],
            tag: options.tag || 'nexflix-notif',
            requireInteraction: options.requireInteraction || false,
            ...options
        });
        notif.onclick = () => { window.focus(); notif.close(); };
        setTimeout(() => { try { notif.close(); } catch {} }, 8000);
        return notif;
    } catch (e) { console.warn('Notif gagal:', e); }
}

function getNotifState() {
    try { return JSON.parse(localStorage.getItem(NOTIF_CONFIG.storageKey)) || {}; } catch { return {}; }
}
function saveNotifState(s) {
    localStorage.setItem(NOTIF_CONFIG.storageKey, JSON.stringify(s));
}

async function checkForUpdates() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (localStorage.getItem(NOTIF_CONFIG.prefKey) === 'off') return;
    const c = await fetchCloud();
    const state = getNotifState();
    
    const maintNow = c.maintenance.active ? 'active' : 'inactive';
    if (state.lastMaint !== maintNow) {
        if (c.maintenance.active) {
            showNotification('🔧 Website Maintenance', c.maintenance.message || 'Website sedang dalam pemeliharaan.', { tag: 'maint', requireInteraction: true });
        } else if (state.lastMaint === 'active') {
            showNotification('✅ Maintenance Selesai', 'Website sudah bisa diakses kembali. Silakan login.', { tag: 'maint' });
        }
        state.lastMaint = maintNow;
    }
    
    const bcKey = c.broadcast.active ? (c.broadcast.text || '').substring(0, 200) : '';
    if (c.broadcast.active && c.broadcast.text && state.lastBroadcast !== bcKey) {
        showNotification('📢 Pengumuman Baru', c.broadcast.text, { tag: 'broadcast-' + Date.now() });
        state.lastBroadcast = bcKey;
    } else if (!c.broadcast.active) {
        state.lastBroadcast = '';
    }
    saveNotifState(state);
}

let notifPoller = null;
function startNotifPoller() {
    if (notifPoller) clearInterval(notifPoller);
    setTimeout(checkForUpdates, 5000);
    notifPoller = setInterval(checkForUpdates, NOTIF_CONFIG.checkInterval);
    console.log('🔔 Notif poller aktif');
}

function stopNotifPoller() {
    if (notifPoller) { clearInterval(notifPoller); notifPoller = null; }
}

async function toggleNotifications() {
    const current = localStorage.getItem(NOTIF_CONFIG.prefKey) === 'on';
    if (current) {
        localStorage.setItem(NOTIF_CONFIG.prefKey, 'off');
        stopNotifPoller();
        toast('Notifikasi dimatikan', 'info');
        updateNotifButton();
        return;
    }
    const ok = await requestNotifPermission();
    if (!ok) { updateNotifButton(); return; }
    localStorage.setItem(NOTIF_CONFIG.prefKey, 'on');
    startNotifPoller();
    toast('✅ Notifikasi aktif!', 'success');
    updateNotifButton();
}

function updateNotifButton() {
    const btn = document.getElementById('btnNotif');
    if (!btn) return;
    const enabled = localStorage.getItem(NOTIF_CONFIG.prefKey) === 'on'
        && 'Notification' in window
        && Notification.permission === 'granted';
    if (enabled) {
        btn.classList.add('active');
        btn.title = 'Notifikasi aktif — klik untuk matikan';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
    } else {
        btn.classList.remove('active');
        btn.title = 'Aktifkan notifikasi';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    }
}
