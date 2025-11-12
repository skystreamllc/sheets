#!/bin/bash
set -e

# Переходим в рабочую директорию
cd /app

# Применяем миграции базы данных
echo "Применение миграций базы данных..."
python manage.py migrate --noinput

# Собираем статические файлы Django
echo "Сборка статических файлов..."
python manage.py collectstatic --noinput || true

# Функция для остановки процессов при выходе
cleanup() {
    echo "Остановка процессов..."
    kill $DJANGO_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

# Запускаем Django через daphne в фоновом режиме
echo "Запуск Django сервера на порту 8000..."
daphne -b 127.0.0.1 -p 8000 sheets_project.asgi:application &
DJANGO_PID=$!

# Ждем немного, чтобы Django запустился
sleep 3

# Проверяем, что Django запустился
if ! kill -0 $DJANGO_PID 2>/dev/null; then
    echo "Ошибка: Django сервер не запустился!"
    exit 1
fi

echo "Django сервер запущен (PID: $DJANGO_PID)"

# Запускаем nginx в foreground режиме
echo "Запуск nginx на порту 3000..."
exec nginx -g "daemon off;"

