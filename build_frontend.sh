#!/bin/bash
set -e

echo "🚀 Начинаем сборку фронтенда на сервере Amvera..."

# Пробуем установить Node.js разными способами
if command -v node &> /dev/null; then
    echo "✅ Node.js уже установлен: $(node --version)"
else
    echo "📦 Устанавливаем Node.js 18..."
    
    # Способ 1: Через nvm (если доступен)
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo "Используем nvm..."
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        nvm install 18
        nvm use 18
    # Способ 2: Установка nvm если его нет
    elif ! command -v nvm &> /dev/null; then
        echo "Устанавливаем nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        nvm install 18
        nvm use 18
    # Способ 3: Прямая установка через пакетный менеджер
    else
        echo "Пробуем установить через apt/yum/apk..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash - || true
        apt-get update && apt-get install -y nodejs npm || \
        yum install -y nodejs npm || \
        apk add --no-cache nodejs npm || \
        echo "⚠️ Не удалось установить Node.js автоматически"
    fi
fi

# Проверяем версию Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js установлен: $(node --version)"
    echo "✅ npm установлен: $(npm --version)"
else
    echo "❌ Ошибка: Node.js не установлен. Сборка фронтенда невозможна."
    exit 1
fi

# Переходим в директорию фронтенда
cd frontend || exit 1

# Устанавливаем зависимости
echo "📦 Устанавливаем зависимости фронтенда..."
npm ci --legacy-peer-deps 2>/dev/null || npm install

# Собираем фронтенд
echo "🔨 Собираем фронтенд..."
npm run build

# Проверяем результат
if [ -d "../app/static" ]; then
    echo "✅ Сборка фронтенда завершена успешно!"
    echo "📁 Содержимое app/static:"
    ls -la ../app/static/ | head -10
else
    echo "⚠️ Предупреждение: директория app/static не найдена"
fi

