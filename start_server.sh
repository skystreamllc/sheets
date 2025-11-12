#!/bin/bash
# Скрипт для запуска сервера с поддержкой WebSocket
source venv/bin/activate
daphne -b 0.0.0.0 -p 8000 sheets_project.asgi:application
