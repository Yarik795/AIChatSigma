"""
API endpoints для работы с OpenRouter
"""
import os
import logging
import requests
from flask import Blueprint, request, jsonify
from app.api.cost_calculator import calculate_cost_rub

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__)

# URL OpenRouter API
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


@api_bp.route('/chat', methods=['POST'])
def chat():
    """
    Проксирует запрос к OpenRouter API
    
    Принимает:
    {
        "message": "текст сообщения",
        "model": "openai/gpt-4"
    }
    
    Возвращает:
    {
        "content": "ответ от модели",
        "model": "использованная модель"
    }
    """
    try:
        # Получаем данные из запроса
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Отсутствуют данные в запросе'}), 400
        
        message = data.get('message')
        model = data.get('model')
        
        # Валидация обязательных полей
        if not message or not isinstance(message, str):
            return jsonify({'error': 'Поле "message" обязательно и должно быть строкой'}), 400
        
        if not model or not isinstance(model, str):
            return jsonify({'error': 'Поле "model" обязательно и должно быть строкой'}), 400
        
        # Получаем опциональные параметры генерации
        temperature = data.get('temperature')
        max_tokens = data.get('max_tokens')
        verbosity = data.get('verbosity')
        frequency_penalty = data.get('frequency_penalty')
        top_p = data.get('top_p')
        
        # Валидация параметров (если переданы)
        if temperature is not None:
            try:
                temperature = float(temperature)
                if not (0.0 <= temperature <= 2.0):
                    return jsonify({'error': 'temperature должен быть от 0.0 до 2.0'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'temperature должен быть числом'}), 400
        
        if max_tokens is not None:
            try:
                max_tokens = int(max_tokens)
                if not (1 <= max_tokens <= 4000):
                    return jsonify({'error': 'max_tokens должен быть от 1 до 4000'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'max_tokens должен быть целым числом'}), 400
        
        if verbosity is not None:
            if verbosity not in ['low', 'medium', 'high']:
                return jsonify({'error': 'verbosity должен быть: low, medium или high'}), 400
        
        if frequency_penalty is not None:
            try:
                frequency_penalty = float(frequency_penalty)
                if not (-2.0 <= frequency_penalty <= 2.0):
                    return jsonify({'error': 'frequency_penalty должен быть от -2.0 до 2.0'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'frequency_penalty должен быть числом'}), 400
        
        if top_p is not None:
            try:
                top_p = float(top_p)
                if not (0.0 <= top_p <= 1.0):
                    return jsonify({'error': 'top_p должен быть от 0.0 до 1.0'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'top_p должен быть числом'}), 400
        
        # Получаем API ключ из переменных окружения
        api_key = os.environ.get('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({'error': 'API ключ не настроен'}), 500
        
        # Получаем HTTP Referer (опционально)
        http_referer = os.environ.get('HTTP_REFERER', request.headers.get('Origin', ''))
        
        # Подготавливаем запрос к OpenRouter
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        if http_referer:
            headers['HTTP-Referer'] = http_referer
        
        payload = {
            'model': model,
            'messages': [
                {
                    'role': 'user',
                    'content': message
                }
            ]
        }
        
        # Добавляем опциональные параметры в payload (только если переданы)
        if temperature is not None:
            payload['temperature'] = temperature
        
        if max_tokens is not None:
            payload['max_tokens'] = max_tokens
        
        if verbosity is not None:
            payload['verbosity'] = verbosity
        
        if frequency_penalty is not None:
            payload['frequency_penalty'] = frequency_penalty
        
        if top_p is not None:
            payload['top_p'] = top_p
        
        # Отправляем запрос к OpenRouter
        response = requests.post(
            OPENROUTER_API_URL,
            headers=headers,
            json=payload,
            timeout=60
        )
        
        # Обработка ответа
        if response.status_code == 200:
            response_data = response.json()
            
            # Извлекаем содержимое ответа
            if 'choices' in response_data and len(response_data['choices']) > 0:
                content = response_data['choices'][0]['message']['content']
                used_model = response_data.get('model', model)
                
                # Рассчитываем стоимость запроса
                cost_info = calculate_cost_rub(response_data, used_model)
                
                # Выводим стоимость в консоль
                if cost_info:
                    total_cost_rub = cost_info['total_cost_rub']
                    prompt_tokens = cost_info['prompt_tokens']
                    completion_tokens = cost_info['completion_tokens']
                    total_tokens = cost_info['total_tokens']
                    
                    logger.info("=" * 60)
                    logger.info(f"СТОИМОСТЬ ЗАПРОСА:")
                    logger.info(f"Модель: {used_model}")
                    logger.info(f"Токенов (prompt/completion/total): {prompt_tokens}/{completion_tokens}/{total_tokens}")
                    logger.info(f"Общая стоимость: {total_cost_rub:.2f} руб.")
                    logger.info("=" * 60)
                    
                    # Формируем ответ с информацией о стоимости
                    response_json = {
                        'content': content,
                        'model': used_model,
                        'cost': {
                            'total_cost_rub': total_cost_rub,
                            'prompt_tokens': prompt_tokens,
                            'completion_tokens': completion_tokens,
                            'total_tokens': total_tokens
                        }
                    }
                else:
                    # Если не удалось рассчитать стоимость, возвращаем ответ без неё
                    logger.warning("Не удалось рассчитать стоимость запроса")
                    response_json = {
                        'content': content,
                        'model': used_model
                    }
                
                return jsonify(response_json), 200
            else:
                return jsonify({'error': 'Неожиданный формат ответа от OpenRouter'}), 500
        
        # Обработка ошибок от OpenRouter
        try:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            error_message = error_data.get('error', {}).get('message', 'Ошибка при запросе к OpenRouter')
        except Exception:
            error_message = f'Ошибка при запросе к OpenRouter (HTTP {response.status_code})'
        
        return jsonify({
            'error': error_message,
            'status_code': response.status_code
        }), response.status_code
    
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Таймаут при запросе к OpenRouter'}), 504
    
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Ошибка сети: {str(e)}'}), 500
    
    except Exception as e:
        return jsonify({'error': f'Внутренняя ошибка сервера: {str(e)}'}), 500

