# Настройка работы через один порт

Теперь все работает через один порт! API и WebSocket проксируются автоматически.

## Для разработки (React dev server)

1. Запустите Django сервер:
   ```bash
   ./start_server.sh
   ```

2. Запустите React приложение:
   ```bash
   cd frontend
   npm start
   ```

3. Откройте http://localhost:3000 - все запросы к `/api` и `/ws` будут автоматически проксироваться на порт 8000

## Для продакшена с доменом

### Вариант 1: Использование nginx (рекомендуется)

1. Установите nginx (если еще не установлен):
   ```bash
   sudo apt install nginx
   ```

2. Скопируйте конфигурацию:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/sheets
   sudo ln -s /etc/nginx/sites-available/sheets /etc/nginx/sites-enabled/
   ```

3. Проверьте конфигурацию:
   ```bash
   sudo nginx -t
   ```

4. Перезапустите nginx:
   ```bash
   sudo systemctl restart nginx
   ```

5. Настройте роутер для переадресации:
   - `sheets.letatel.keenetic.pro` → `192.168.1.91:80` (nginx)

### Вариант 2: Прямая переадресация через роутер

Если роутер поддерживает проксирование по пути:

- `sheets.letatel.keenetic.pro/` → `192.168.1.91:3000` (React)
- `sheets.letatel.keenetic.pro/api/` → `192.168.1.91:8000/api/` (Django)
- `sheets.letatel.keenetic.pro/ws/` → `192.168.1.91:8000/ws/` (Django WebSocket)

## Как это работает

1. **API запросы** (`/api/*`) автоматически проксируются на Django (порт 8000)
2. **WebSocket** (`/ws/*`) автоматически проксируется на Django (порт 8000)
3. **Остальные запросы** идут на React приложение (порт 3000)

Все работает через один порт (3000 для разработки, 80 для продакшена)!

