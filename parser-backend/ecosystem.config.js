module.exports = {
  apps: [
    {
      name: 'devweek-backend',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 3000,   // пауза 3с перед перезапуском
      max_restarts: 10,       // не перезапускать бесконечно при hard-сбое
      min_uptime: '10s',      // считать запуск успешным если прожил 10с
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
