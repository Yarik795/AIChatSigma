# 🚀 Руководство по локальной разработке и деплою

**Для кого:** Разработчики проекта AISigma  
**Содержание:** Инструкции по запуску, тестированию и обновлению GitHub  

---

## 📋 Содержание

1. [Подготовка окружения](#подготовка-окружения)
2. [Запуск приложения](#запуск-приложения)
3. [Режим разработки](#режим-разработки)
4. [Обновление GitHub](#обновление-github)
5. [Деплой на Amvera](#деплой-на-amvera)
6. [Troubleshooting](#troubleshooting)

---

## 🔧 Подготовка окружения

### Первоначальная установка (один раз)

#### 1. Установка Python зависимостей

```bash
# Переход в корневую директорию проекта
cd D:\YandexDisk\Coding\AISigma

# Установка зависимостей
pip install -r requirements.txt
```

#### 2. Установка Node.js зависимостей

```bash
# Переход в директорию frontend
cd frontend

# Установка зависимостей
npm install

# Возврат в корневую директорию
cd ..
```

#### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
# Windows PowerShell
New-Item -Path .env -ItemType File

# Linux/Mac
touch .env
```

Откройте `.env` и добавьте:

```env
OPENROUTER_API_KEY=your_api_key_here
HTTP_REFERER=http://localhost:5000
```

**Где взять API ключ:** https://openrouter.ai/keys

---

## 🎯 Запуск приложения

### Производственный режим (Production)

Собирает фронтенд и запускает сервер:

```bash
# Шаг 1: Сборка фронтенда
cd frontend
npm run build

# Шаг 2: Возврат в корень проекта
cd ..

# Шаг 3: Запуск Flask сервера
python -m app.main
```

**Результат:** Приложение доступно по адресу http://localhost:5000

---

## 💻 Режим разработки

### Два терминала (рекомендуется)

#### **Terminal 1: Backend (Flask)**

```bash
# Из корневой директории проекта
python -m app.main
```

**Логи:**
```
 * Serving Flask app 'app.main'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

#### **Terminal 2: Frontend (React)**

```bash
# Переход в директорию frontend
cd frontend

# Запуск dev server с hot-reload
npm run dev
```

**Логи:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**Важно:** Frontend dev server работает на порту 5173 и автоматически проксирует запросы `/api/*` на backend (порт 5000).

---

## 🔄 Рестарт приложения

### Полный рестарт

#### Остановка серверов

В обоих терминалах нажмите `Ctrl + C`

#### Запуск заново

```bash
# Terminal 1: Backend
python -m app.main

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Быстрый рестарт (только backend)

```bash
# В терминале с Flask
# Нажмите Ctrl + C для остановки, затем:
python -m app.main
```

### Быстрый рестарт (только frontend)

```bash
# В терминале с npm
# Нажмите Ctrl + C для остановки, затем:
npm run dev
```

---

## 📝 Обновление GitHub

### Стандартный workflow

#### 1. Проверка изменений

```bash
# Просмотр измененных файлов
git status

# Просмотр детальных изменений
git diff

# Если хотите видеть изменения конкретного файла
git diff frontend/src/SettingsPanel.jsx
```

#### 2. Добавление изменений

```bash
# Добавить все изменения
git add .

# Или добавить конкретный файл
git add frontend/src/SettingsPanel.jsx

# Проверить что добавлено
git status
```

#### 3. Создание коммита

```bash
# С осмысленным сообщением
git commit -m "feat: добавить панель настроек в SettingsPanel"

# Типичные префиксы коммитов:
# feat:     новая функция
# fix:      исправление бага
# docs:     изменения в документации
# style:    форматирование, отсутствующие точки с запятой и т.д.
# refactor: рефакторинг кода
# test:     добавление тестов
# chore:    обновление задач сборки, настройки IDE и т.д.
```

**Примеры хороших сообщений:**
```bash
git commit -m "feat: добавить поддержку новых моделей OpenRouter"
git commit -m "fix: исправить ошибку в обработке SSE стриминга"
git commit -m "docs: обновить инструкции по деплою"
git commit -m "refactor: переписать логику генерации вариантов ответов"
```

#### 4. Push в GitHub

```bash
# Push в main ветку
git push origin main

# Или если работаете в другой ветке
git push origin feature-branch-name
```

---

## 🚀 Деплой на Amvera

### Автоматический деплой (через webhook)

После `git push` на GitHub:

1. **GitHub** отправляет webhook в **Amvera**
2. **Amvera** автоматически подтягивает изменения
3. **Amvera** устанавливает зависимости и собирает проект
4. **Amvera** запускает приложение
5. Через 1-3 минуты приложение доступно на: `https://your-project.amvera.io`

### Проверка деплоя

1. Откройте [панель управления Amvera](https://console.amvera.ru)
2. Перейдите в раздел **"Логи"**
3. Проверьте:
   - **Build logs** - должны быть без ошибок
   - **Runtime logs** - приложение должно запуститься

### Ручной деплой (если webhook не настроен)

В панели Amvera нажмите кнопку **"Пересобрать"** или **"Deploy"**

---

## 🔍 Troubleshooting

### Проблема: Порт 5000 занят

**Windows:**
```powershell
# Проверить какой процесс использует порт
netstat -ano | findstr :5000

# Убить процесс (замените PID на реальный номер)
taskkill /PID <PID> /F
```

### Проблема: Порт 5173 занят

**Windows:**
```powershell
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
lsof -i :5173
kill -9 <PID>
```

### Проблема: npm install выдает ошибки

```bash
# Очистка кэша и переустановка
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Проблема: pip install выдает ошибки

```bash
# Обновление pip
pip install --upgrade pip

# Переустановка зависимостей
pip install -r requirements.txt --force-reinstall
```

### Проблема: Frontend не собирается

```bash
cd frontend

# Очистка кэша Vite
rm -rf .vite dist

# Пересборка
npm run build
```

### Проблема: Git push отклонен

```bash
# Сначала сделайте pull
git pull origin main

# Разрешите конфликты если есть
# Затем повторите push
git push origin main
```

### Проблема: API ключ не работает

1. Проверьте `.env` файл - ключ должен быть правильным
2. Проверьте что `.env` находится в корне проекта
3. Перезапустите Flask сервер после изменения `.env`

### Проблема: Изменения не отображаются

**Frontend (в режиме разработки):**
- Проверьте что dev server запущен на порту 5173
- Обновите страницу в браузере (F5 или Ctrl+R)
- Проверьте консоль браузера на ошибки

**Frontend (в production):**
```bash
# Соберите фронтенд заново
cd frontend
npm run build
cd ..

# Перезапустите Flask сервер
python -m app.main
```

---

## 📊 Быстрая справка по командам

### Backend

```bash
# Запуск
python -m app.main

# Установка зависимостей
pip install -r requirements.txt

# Проверка версии Python
python --version
```

### Frontend

```bash
# Development mode (hot-reload)
cd frontend
npm run dev

# Production build
cd frontend
npm run build

# Установка зависимостей
cd frontend
npm install

# Проверка версии Node
node --version
npm --version
```

### Git

```bash
# Проверка статуса
git status

# Просмотр изменений
git diff

# Добавление всех изменений
git add .

# Коммит
git commit -m "описание изменений"

# Push
git push origin main

# Pull (получение изменений с GitHub)
git pull origin main
```

---

## ✅ Чеклист перед деплоем

Перед тем как делать `git push`:

- [ ] Код протестирован локально
- [ ] Backend запускается без ошибок
- [ ] Frontend работает корректно
- [ ] Исправлены все ошибки линтинга
- [ ] Проверен `git status` и `git diff`
- [ ] Написано осмысленное сообщение коммита
- [ ] Проверено что `.env` НЕ добавлен в коммит (он в `.gitignore`)

---

## 🎯 Типичный рабочий день

### Утренний старт

```bash
# 1. Получение последних изменений с GitHub
git pull origin main

# 2. Запуск разработки
# Terminal 1:
python -m app.main

# Terminal 2:
cd frontend
npm run dev
```

### Внесение изменений

1. Редактируете код в Cursor
2. Сохраняете файлы
3. Проверяете изменения в браузере (автоматически обновится)

### Тестирование

1. Тестируете функциональность
2. Проверяете консоль браузера на ошибки
3. Проверяете терминалы на ошибки

### Закоммитить изменения

```bash
# 1. Проверка изменений
git status
git diff

# 2. Добавление и коммит
git add .
git commit -m "feat: описание изменений"

# 3. Push
git push origin main
```

### Вечерний финиш

```bash
# Остановка серверов (Ctrl+C в обоих терминалах)

# Если остались незакоммиченные изменения
git status

# При необходимости сохраните в stash
git stash save "wip: рабочее состояние на вечер"
```

---

## 📚 Дополнительные ресурсы

- [README.md](../README.md) - основная документация
- [DEV_AUTOMATION.md](DEV_AUTOMATION.md) - скрипты автоматизации (dev-start, dev-deploy, quick-push, Git hooks)
- [DEPLOY_CHECKLIST.md](../DEPLOY_CHECKLIST.md) - чеклист деплоя
- [AMVERA_DEPLOY.md](../AMVERA_DEPLOY.md) - детальная инструкция по Amvera
- [.cursorrules](../.cursorrules) - правила работы с Cursor AI

---

**Успешной разработки!** 🚀

