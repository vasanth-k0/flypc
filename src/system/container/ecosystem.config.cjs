module.exports = {
  apps: [
    {
      name: 'flypc-server',
      script: '/opt/flypc/dist/be/index.js',
      cwd: '/opt/flypc/src/system/console/server',
      env: {
        PORT: '3000',
      },
      autorestart: true,
    },
    {
      name: 'nginx',
      script: '/usr/sbin/nginx',
      args: '-g "daemon off;"',
      autorestart: true,
    },
    {
      name: 'ttyd',
      script: '/usr/bin/ttyd',
      args: '--interface 127.0.0.1 --port 7681 login',
      autorestart: true,
    },
    {
      name: 'certbot-renew',
      script: '/opt/flypc/certbot-renew.sh',
      interpreter: '/bin/sh',
      autorestart: true,
    },
  ],
}
