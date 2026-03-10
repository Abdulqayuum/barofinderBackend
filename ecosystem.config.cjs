module.exports = {
    apps: [
        {
            name: 'barofinder-api',
            script: 'src/index.js',
            cwd: 'C:\\Users\\Administrator\\Documents\\BaroFinder\\barofinderBackend',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '300M',
            env: {
                NODE_ENV: 'development',
                PORT: 3000,
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
            restart_delay: 3000,
            max_restarts: 10,
            autorestart: true,
        }
    ]
};
