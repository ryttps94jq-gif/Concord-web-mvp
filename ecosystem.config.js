module.exports = {
  apps: [
    {
      name: 'concord-api',
      cwd: './server',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5050,
        DATA_DIR: './data',
        ALLOWED_ORIGINS: 'https://concord-os.org',
      },
    },
    {
      name: 'concord-web',
      cwd: './concord-frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
