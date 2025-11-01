"""
Тестовый скрипт для проверки стоимости запросов к OpenRouter API
Показывает ответ модели и стоимость запроса в рублях
"""
import os
import sys
import requests
from dotenv import load_dotenv

# Настройка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Курс доллара к рублю
USD_TO_RUB = 110.0

# Загружаем переменные окружения из .env файла
project_root = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(project_root, '.env')

if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
else:
    load_dotenv(override=True)

# Получаем API ключ
api_key = os.environ.get('OPENROUTER_API_KEY')
if not api_key:
    print("[ERROR] OPENROUTER_API_KEY не найден в переменных окружения")
    exit(1)

# URL OpenRouter API
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODELS_API_URL = "https://openrouter.ai/api/v1/models"

# Тестовый запрос
payload = {
    'model': 'anthropic/claude-sonnet-4.5',
    'messages': [
        {
            'role': 'user',
            'content': 'привет'
        }
    ]
}

headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json',
    'HTTP-Referer': 'http://localhost:5000'
}

print("=" * 60)
print("ТЕСТОВЫЙ ЗАПРОС К OPENROUTER API")
print("=" * 60)
print(f"Модель: {payload['model']}")
print(f"Запрос: {payload['messages'][0]['content']}")
print()

try:
    # Отправляем запрос
    response = requests.post(
        OPENROUTER_API_URL,
        headers=headers,
        json=payload,
        timeout=60
    )
    
    if response.status_code == 200:
        response_data = response.json()
        
        # Извлекаем ответ модели
        if 'choices' in response_data and len(response_data['choices']) > 0:
            assistant_message = response_data['choices'][0]['message']['content']
            print("=" * 60)
            print("ОТВЕТ МОДЕЛИ:")
            print("=" * 60)
            print(assistant_message)
            print()
        
        # Получаем информацию об использовании токенов
        usage = response_data.get('usage', {})
        prompt_tokens = usage.get('prompt_tokens', 0)
        completion_tokens = usage.get('completion_tokens', 0)
        total_tokens = usage.get('total_tokens', 0)
        
        # Получаем тарифы модели
        try:
            models_response = requests.get(MODELS_API_URL, timeout=30)
            if models_response.status_code == 200:
                models_data = models_response.json()
                model_id = response_data.get('model', payload['model'])
                
                # Ищем тарифы для используемой модели
                model_pricing = None
                for model in models_data.get('data', []):
                    if model.get('id') == model_id or model.get('canonical_slug') == model_id:
                        model_pricing = model.get('pricing')
                        break
                
                if model_pricing:
                    # Вычисляем стоимость
                    prompt_price_per_token = float(model_pricing.get('prompt', '0'))
                    completion_price_per_token = float(model_pricing.get('completion', '0'))
                    request_price = float(model_pricing.get('request', '0'))
                    
                    prompt_cost_usd = prompt_tokens * prompt_price_per_token
                    completion_cost_usd = completion_tokens * completion_price_per_token
                    request_cost_usd = request_price
                    total_cost_usd = prompt_cost_usd + completion_cost_usd + request_cost_usd
                    
                    # Конвертируем в рубли
                    prompt_cost_rub = prompt_cost_usd * USD_TO_RUB
                    completion_cost_rub = completion_cost_usd * USD_TO_RUB
                    request_cost_rub = request_cost_usd * USD_TO_RUB
                    total_cost_rub = total_cost_usd * USD_TO_RUB
                    
                    # Выводим информацию о стоимости
                    print("=" * 60)
                    print("СТОИМОСТЬ ЗАПРОСА:")
                    print("=" * 60)
                    print(f"Prompt токенов: {prompt_tokens:,}")
                    print(f"  Стоимость: ${prompt_cost_usd:.10f} ({prompt_cost_rub:.6f} руб.)")
                    print()
                    print(f"Completion токенов: {completion_tokens:,}")
                    print(f"  Стоимость: ${completion_cost_usd:.10f} ({completion_cost_rub:.6f} руб.)")
                    print()
                    if request_cost_usd > 0:
                        print(f"Стоимость запроса: ${request_cost_usd:.10f} ({request_cost_rub:.6f} руб.)")
                        print()
                    print("=" * 60)
                    print(f"ОБЩАЯ СТОИМОСТЬ: ${total_cost_usd:.10f} ({total_cost_rub:.6f} руб.)")
                    print("=" * 60)
                else:
                    print(f"[ERROR] Тарифы для модели '{model_id}' не найдены")
            else:
                print(f"[ERROR] Не удалось получить список моделей: HTTP {models_response.status_code}")
        except Exception as e:
            print(f"[ERROR] Ошибка при получении тарифов: {str(e)}")
    
    else:
        print(f"[ERROR] Ошибка при запросе: HTTP {response.status_code}")
        try:
            error_data = response.json()
            print(f"Детали: {error_data}")
        except:
            print(f"Текст ответа: {response.text[:500]}")

except requests.exceptions.Timeout:
    print("[ERROR] Таймаут при запросе к OpenRouter")
except requests.exceptions.RequestException as e:
    print(f"[ERROR] Ошибка сети: {str(e)}")
except Exception as e:
    print(f"[ERROR] Неожиданная ошибка: {str(e)}")
    import traceback
    traceback.print_exc()
