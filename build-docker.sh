#!/bin/bash
# Скрипт для сборки и запуска Docker контейнера

# Проверяем, есть ли доступ к Docker
if ! docker info >/dev/null 2>&1; then
    echo "❌ Ошибка: Нет доступа к Docker!"
    echo ""
    echo "Решение: добавьте пользователя в группу docker:"
    echo "  sudo usermod -aG docker $USER"
    echo ""
    echo "После этого выйдите и войдите заново (или выполните: newgrp docker)"
    echo ""
    echo "Или используйте sudo:"
    echo "  sudo docker-compose up -d --build"
    exit 1
fi

# Удаляем старые контейнеры, если они есть
echo "🧹 Очистка старых контейнеров..."
docker-compose down -v 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=sheets") 2>/dev/null || true

echo "🔨 Сборка Docker образа..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при сборке образа!"
    exit 1
fi

echo "🚀 Запуск контейнера..."
docker-compose up -d --force-recreate

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при запуске контейнера!"
    exit 1
fi

echo "✅ Контейнер запущен!"
echo "📊 Приложение доступно на http://localhost:3000"
echo ""
echo "Для просмотра логов: docker-compose logs -f"
echo "Для остановки: docker-compose down"

