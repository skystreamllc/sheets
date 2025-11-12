#!/bin/bash
# Скрипт для полной очистки Docker контейнеров и образов

echo "🧹 Остановка и удаление контейнеров..."
docker-compose down -v 2>/dev/null || true

echo "🗑️  Удаление старых контейнеров sheets..."
docker rm -f $(docker ps -aq --filter "name=sheets") 2>/dev/null || true

echo "🗑️  Удаление образов sheets..."
docker rmi -f $(docker images -q "sheets*") 2>/dev/null || true

echo "✅ Очистка завершена!"
echo ""
echo "Теперь можно запустить: ./build-docker.sh"

