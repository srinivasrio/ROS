module.exports = {
  apps: [
    {
      name: 'dine-in-one-main',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3002',
      cwd: './',
      instances: 'max',
      exec_mode: 'cluster',
      node_args: '--max-http-header-size=131072 --max-old-space-size=4096',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    },
    {
      name: 'dine-in-one-superadmin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3005',
      cwd: './super-admin',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3005
      }
    }
  ]
};
