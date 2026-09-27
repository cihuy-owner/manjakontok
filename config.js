const CONFIG = {
    API_TARGET: 'https://cihuyy-sayonara.workers.dev',
    JSONBIN_ID: '6ab862c6ac6210605af94c0c',
    JSONBIN_KEY: '$2a$10$/3RF5xCq1rbwQI7odBFXA.X8TekUX6qYpuFSzG5Bi3O9HDwbBj31q',
    ADMINS: [
        { username: 'cihuy',  password: '201006' },
        { username: 'cayang', password: '090909' }
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
        { name: 'worker', build: (url) => url, method: 'POST' }
    ]
};

Object.freeze(CONFIG);
