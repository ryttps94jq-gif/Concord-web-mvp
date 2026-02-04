// PM2 Ecosystem Configuration for Concord
// IMPORTANT: Set DOMAIN environment variable before running: DOMAIN=yourdomain.com pm2 start ecosystem.config.js
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
        // SECURITY: These MUST be set via environment or .env file
        // ALLOWED_ORIGINS: 'https://yourdomain.com',
        // JWT_SECRET: '<generate with: openssl rand -hex 64>',
        // ADMIN_PASSWORD: '<strong password, min 12 chars>',
        // AUTH_ENABLED: 'true',
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
