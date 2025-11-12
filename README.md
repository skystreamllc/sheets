# Sheets - Аналог Google Sheets

Веб-приложение для работы с таблицами, созданное на базе Django и React.

## Возможности

- ✅ Создание и управление таблицами
- ✅ Множественные листы в одной таблице
- ✅ Редактирование ячеек
- ✅ Поддержка формул (SUM, AVERAGE, MAX, MIN, COUNT)
- ✅ Ссылки на ячейки (A1, B2, etc.)
- ✅ Современный и интуитивный интерфейс
- ✅ REST API для работы с данными

## Технологии

- **Backend**: Django 4.2, Django REST Framework
- **Frontend**: React 18
- **База данных**: SQLite (по умолчанию)

## Установка и запуск

### 1. Установка зависимостей

#### Backend (Django)
```bash
pip install -r requirements.txt
```

#### Frontend (React)
```bash
cd frontend
npm install
```

### 2. Настройка базы данных

```bash
python manage.py migrate
python manage.py createsuperuser  # опционально, для доступа к админ-панели
```

### 3. Запуск сервера

#### Backend (в корневой директории)

**Для работы совместного редактирования используйте ASGI-сервер:**

```bash
daphne -b 0.0.0.0 -p 8000 sheets_project.asgi:application
```

Или для разработки без WebSocket можно использовать:
```bash
python manage.py runserver
```

Сервер будет доступен по адресу: http://localhost:8000

#### Frontend (в директории frontend)
```bash
cd frontend
npm start
```
Приложение будет доступно по адресу: http://localhost:3000

## Использование

1. Откройте http://localhost:3000 в браузере
2. Создайте новую таблицу, нажав кнопку "+ Создать таблицу"
3. Кликните на ячейку для редактирования
4. Введите значение или формулу (начинается с `=`)
5. Используйте формулы:
   - `=SUM(A1:A5)` - сумма диапазона
   - `=AVERAGE(A1:A5)` - среднее значение
   - `=A1+B1` - арифметические операции
   - `=A1*B1` - умножение
   - `=A1/B1` - деление

## API Endpoints

- `GET /api/spreadsheets/` - список всех таблиц
- `POST /api/spreadsheets/` - создать таблицу
- `GET /api/spreadsheets/{id}/` - получить таблицу
- `POST /api/spreadsheets/{id}/add_sheet/` - добавить лист
- `GET /api/sheets/?spreadsheet_id={id}` - получить листы таблицы
- `GET /api/cells/?sheet_id={id}` - получить ячейки листа
- `POST /api/cells/` - создать/обновить ячейку
- `POST /api/cells/batch_update/` - массовое обновление ячеек

## Структура проекта

```
sheets/
├── sheets_project/      # Настройки Django проекта
├── sheets/              # Django приложение
│   ├── models.py       # Модели данных
│   ├── views.py        # API views
│   ├── serializers.py  # Сериализаторы
│   └── formula_engine.py # Движок формул
├── frontend/           # React приложение
│   ├── src/
│   │   ├── components/ # React компоненты
│   │   └── services/   # API сервисы
│   └── public/
└── requirements.txt    # Python зависимости
```

## Разработка

Для разработки рекомендуется использовать виртуальное окружение:

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows
```

## Лицензия

MIT

