# Многоступенчатая сборка Docker контейнера
# Этап 1: Сборка React приложения
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Копируем package.json и устанавливаем зависимости
COPY frontend/package*.json ./
RUN npm install

# Копируем исходный код и собираем приложение
COPY frontend/ ./
RUN npm run build

# Этап 2: Финальный образ с Django и nginx
FROM python:3.11-slim

# Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y \
    nginx \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем и устанавливаем Python зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код Django приложения
COPY manage.py .
COPY sheets/ ./sheets/
COPY sheets_project/ ./sheets_project/
COPY static/ ./static/

# Копируем собранное React приложение из первого этапа
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Копируем конфигурацию nginx
COPY nginx-docker.conf /etc/nginx/sites-available/default

# Создаем директории для базы данных и статических файлов
RUN mkdir -p /app/data /app/staticfiles

# Создаем скрипт запуска
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Открываем порт 3000
EXPOSE 3000

# Запускаем скрипт входа
ENTRYPOINT ["/docker-entrypoint.sh"]

