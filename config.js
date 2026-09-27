const CONFIG = {
    API_TARGET: 'https://api.zyvor.my.id/api/fun/netflix',
    JSONBIN_ID: '6ab862c6ac6210605af94c0c',
    JSONBIN_KEY: '$2a$10$/3RF5xCq1rbwQI7odBFXA.X8TekUX6qYpuFSzG5Bi3O9HDwbBj31q',
    ADMINS: [
        { username: 'cihuy',  password: '201006' },
        { username: 'cayang', password: '090909' },
         { username: 'siti',  password: '121212' }
    ],
    TRIAL_DAYS: 3,
    DEFAULT_DAILY_LIMIT: 5,
    DEFAULT_COOLDOWN: 5,
    PROXY_TIMEOUT: 8000,
    PROXY_CACHE_KEY: 'nexflix_working_proxy',
    KEYS: {
        USERS: 'nexflix_users',
        SESSION: 'nexflix_session',
        ACTIVITY: 'nexflix_activity',
        DISMISS: 'nexflix_dismissed_bc'
    },
    PROXIES: [
        { name: 'allorigins-raw', build: (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url), method: 'GET' },
        { name: 'corsproxy-io',   build: (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url), method: 'GET' },
        { name: 'codetabs',       build: (url) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url), method: 'GET' },
        { name: 'cors-eu',        build: (url) => 'https://cors.eu.org/' + url, method: 'POST' },
        { name: 'thingproxy',     build: (url) => 'https://thingproxy.freeboard.io/fetch/' + url, method: 'POST' },
        { name: 'direct',         build: (url) => url, method: 'POST' }
    ]
};

Object.freeze(CONFIG);
