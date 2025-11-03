"""
Flask приложение для проксирования запросов к OpenRouter API
Версия: 1.1.1 (с панелью настроек API параметров)
Последнее обновление: 2025-11-01
"""
import os
from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from app.api.routes import api_bp

# Загружаем переменные окружения из .env файла (для локальной разработки)
# Определяем корень проекта (на уровень выше папки app)
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(project_root, '.env')

# Загружаем с явным указанием override=True, чтобы переменные загрузились
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
else:
    # Fallback: пробуем загрузить из текущей директории
    load_dotenv(override=True)

# Получаем абсолютный путь к директории приложения
basedir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__, 
            static_folder=os.path.join(basedir, 'static'),
            template_folder=os.path.join(basedir, 'templates'))

# Настройка CORS
CORS(app)

# Отключаем кэширование статики в debug режиме
if app.debug:
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
    
    @app.after_request
    def add_no_cache_headers(response):
        """Добавляет заголовки no-cache в debug режиме"""
        if app.debug:
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        return response

# Регистрация API blueprint
app.register_blueprint(api_bp, url_prefix='/api')


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    """Отдает index.html для всех путей кроме /api/* (SPA роутинг)"""
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    
    # Отдаем статические файлы если они существуют
    if path:
        static_path = os.path.join(app.static_folder, path)
        if os.path.exists(static_path) and os.path.isfile(static_path):
            try:
                return send_from_directory(app.static_folder, path)
            except Exception:
                pass
    
    # Проверяем есть ли собранный index.html в static
    static_index = os.path.join(app.static_folder, 'index.html')
    if os.path.exists(static_index):
        return send_from_directory(app.static_folder, 'index.html')
    
    # Иначе отдаем шаблон index.html для SPA
    return send_from_directory(app.template_folder, 'index.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

