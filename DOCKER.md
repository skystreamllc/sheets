# Docker контейнер для Sheets

Приложение упаковано в Docker контейнер, который работает через один порт 3000.

## Быстрый старт

### Сборка и запуск через docker-compose (рекомендуется)

```bash
# Сборка и запуск
docker-compose up -d --build

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

Приложение будет доступно на http://localhost:3000

### Сборка и запуск вручную

```bash
# Сборка образа
docker build -t sheets-app .

# Запуск контейнера
docker run -d \
  --name sheets \
  -p 3000:3000 \
  -v $(pwd)/db.sqlite3:/app/db.sqlite3 \
  sheets-app

# Просмотр логов
docker logs -f sheets

# Остановка
docker stop sheets
docker rm sheets
```

## Структура контейнера

- **Порт 3000**: nginx (проксирует все запросы)
  - `/api/*` → Django backend (порт 8000 внутри контейнера)
  - `/ws/*` → Django WebSocket (порт 8000 внутри контейнера)
  - `/*` → React приложение (статические файлы)

## Персистентность данных

База данных `db.sqlite3` монтируется как volume, поэтому данные сохраняются между перезапусками контейнера.

## Переменные окружения

Можно настроить через `docker-compose.yml` или `-e` флаг:

```bash
docker run -d \
  --name sheets \
  -p 3000:3000 \
  -e DEBUG=False \
  -e ALLOWED_HOSTS=* \
  -v $(pwd)/db.sqlite3:/app/db.sqlite3 \
  sheets-app
```

## Обновление приложения

```bash
# Остановить контейнер
docker-compose down

# Пересобрать образ
docker-compose build --no-cache

# Запустить заново
docker-compose up -d
```

## Использование с доменом

Если используете домен через роутер, настройте переадресацию:
- `sheets.letatel.keenetic.pro` → `192.168.1.91:3000`

Все будет работать через один порт!

