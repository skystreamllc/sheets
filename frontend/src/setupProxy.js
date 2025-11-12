const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Проксируем API запросы на Django backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      ws: false, // WebSocket проксируется отдельно
      logLevel: 'debug',
    })
  );

  // Проксируем WebSocket соединения на Django backend
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://localhost:8000', // Для WebSocket тоже используем http, middleware сам обработает
      ws: true, // Включаем поддержку WebSocket
      changeOrigin: true,
      logLevel: 'debug',
    })
  );
};

