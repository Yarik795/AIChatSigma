"""
API endpoints для работы с OpenRouter
"""
import os
import logging
import json
import requests
from flask import Blueprint, request, jsonify, Response, stream_with_context
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
            # Обрабатываем null/0 как "без лимита" - не добавляем в payload
            if max_tokens == 0 or max_tokens == '':
                max_tokens = None
            else:
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
                choice = response_data['choices'][0]
                content = choice['message']['content']
                finish_reason = choice.get('finish_reason', 'unknown')
                used_model = response_data.get('model', model)
                
                # Добавляем предупреждение если ответ был обрезан
                if finish_reason == 'length':
                    content += '\n\n⚠️ **Внимание:** Ответ был обрезан из-за достижения лимита токенов. Увеличьте значение max_tokens в настройках для получения полного ответа.'
                
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
                        'finish_reason': finish_reason,
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
                        'model': used_model,
                        'finish_reason': finish_reason
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


def _validate_chat_params(data):
    """
    Валидация параметров для chat запросов (используется в /chat и /chat/stream)
    
    Returns:
        tuple: (message, model, payload_dict, error_response) или (None, None, None, error_response)
    """
    if not data:
        return None, None, None, (jsonify({'error': 'Отсутствуют данные в запросе'}), 400)
    
    message = data.get('message')
    model = data.get('model')
    
    # Валидация обязательных полей
    if not message or not isinstance(message, str):
        return None, None, None, (jsonify({'error': 'Поле "message" обязательно и должно быть строкой'}), 400)
    
    if not model or not isinstance(model, str):
        return None, None, None, (jsonify({'error': 'Поле "model" обязательно и должно быть строкой'}), 400)
    
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
                return None, None, None, (jsonify({'error': 'temperature должен быть от 0.0 до 2.0'}), 400)
        except (ValueError, TypeError):
            return None, None, None, (jsonify({'error': 'temperature должен быть числом'}), 400)
    
    if max_tokens is not None:
        if max_tokens == 0 or max_tokens == '':
            max_tokens = None
        else:
            try:
                max_tokens = int(max_tokens)
                if not (1 <= max_tokens <= 4000):
                    return None, None, None, (jsonify({'error': 'max_tokens должен быть от 1 до 4000'}), 400)
            except (ValueError, TypeError):
                return None, None, None, (jsonify({'error': 'max_tokens должен быть целым числом'}), 400)
    
    if verbosity is not None:
        if verbosity not in ['low', 'medium', 'high']:
            return None, None, None, (jsonify({'error': 'verbosity должен быть: low, medium или high'}), 400)
    
    if frequency_penalty is not None:
        try:
            frequency_penalty = float(frequency_penalty)
            if not (-2.0 <= frequency_penalty <= 2.0):
                return None, None, None, (jsonify({'error': 'frequency_penalty должен быть от -2.0 до 2.0'}), 400)
        except (ValueError, TypeError):
            return None, None, None, (jsonify({'error': 'frequency_penalty должен быть числом'}), 400)
    
    if top_p is not None:
        try:
            top_p = float(top_p)
            if not (0.0 <= top_p <= 1.0):
                return None, None, None, (jsonify({'error': 'top_p должен быть от 0.0 до 1.0'}), 400)
        except (ValueError, TypeError):
            return None, None, None, (jsonify({'error': 'top_p должен быть числом'}), 400)
    
    # Формируем payload
    payload = {
        'model': model,
        'messages': [
            {
                'role': 'user',
                'content': message
            }
        ],
        'stream': True  # Включаем streaming для OpenRouter
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
    
    return message, model, payload, None


@api_bp.route('/chat/stream', methods=['POST'])
def chat_stream():
    """
    Проксирует потоковый запрос к OpenRouter API через Server-Sent Events (SSE)
    
    Принимает:
    {
        "message": "текст сообщения",
        "model": "openai/gpt-4"
    }
    
    Возвращает:
    SSE поток с событиями:
    - data: {"token": "текст", "done": false}\n\n - промежуточные токены
    - data: {"token": "", "done": true, "model": "...", "cost": {...}}\n\n - финальное сообщение
    """
    try:
        # Получаем данные из запроса
        data = request.get_json()
        
        # Валидация параметров
        message, model, payload, error_response = _validate_chat_params(data)
        if error_response:
            return error_response
        
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
        
        def generate():
            """Генератор для SSE событий"""
            try:
                # Отправляем запрос к OpenRouter с streaming
                response = requests.post(
                    OPENROUTER_API_URL,
                    headers=headers,
                    json=payload,
                    stream=True,
                    timeout=120
                )
                
                if response.status_code != 200:
                    # Обработка ошибок от OpenRouter
                    try:
                        error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                        error_message = error_data.get('error', {}).get('message', f'Ошибка при запросе к OpenRouter (HTTP {response.status_code})')
                    except Exception:
                        error_message = f'Ошибка при запросе к OpenRouter (HTTP {response.status_code})'
                    
                    error_event = {
                        'error': error_message,
                        'status_code': response.status_code
                    }
                    yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
                    return
                
                # Переменные для накопления данных
                accumulated_content = ""
                used_model = model
                finish_reason = None
                usage_data = None
                
                # Парсим потоковые данные от OpenRouter
                try:
                    for line in response.iter_lines():
                        if not line:
                            continue
                        
                        # Декодируем строку
                        try:
                            line_str = line.decode('utf-8')
                        except UnicodeDecodeError as decode_error:
                            logger.warning(f"Ошибка декодирования строки: {decode_error}")
                            continue
                        
                        # Пропускаем служебные строки SSE
                        if line_str.startswith('data: '):
                            data_str = line_str[6:]  # Убираем "data: "
                            
                            # Проверяем на завершение потока
                            if data_str.strip() == '[DONE]':
                                # Отправляем финальное сообщение с метаданными
                                final_data = {
                                    'token': '',
                                    'done': True,
                                    'model': used_model,
                                    'finish_reason': finish_reason
                                }
                                
                                # Добавляем информацию о стоимости, если доступна
                                if usage_data:
                                    cost_info = calculate_cost_rub({'usage': usage_data, 'model': used_model}, used_model)
                                    if cost_info:
                                        final_data['cost'] = {
                                            'total_cost_rub': cost_info['total_cost_rub'],
                                            'prompt_tokens': cost_info['prompt_tokens'],
                                            'completion_tokens': cost_info['completion_tokens'],
                                            'total_tokens': cost_info['total_tokens']
                                        }
                                        
                                        # Логируем стоимость
                                        logger.info("=" * 60)
                                        logger.info(f"СТОИМОСТЬ STREAMING ЗАПРОСА:")
                                        logger.info(f"Модель: {used_model}")
                                        logger.info(f"Токенов (prompt/completion/total): {cost_info['prompt_tokens']}/{cost_info['completion_tokens']}/{cost_info['total_tokens']}")
                                        logger.info(f"Общая стоимость: {cost_info['total_cost_rub']:.2f} руб.")
                                        logger.info("=" * 60)
                                
                                yield f"data: {json.dumps(final_data, ensure_ascii=False)}\n\n"
                                break
                            
                            # Парсим JSON данные
                            try:
                                chunk_data = json.loads(data_str)
                                
                                # Извлекаем модель из первого чанка
                                if 'model' in chunk_data:
                                    used_model = chunk_data['model']
                                
                                # Извлекаем usage данные (приходят в последнем чанке)
                                if 'usage' in chunk_data:
                                    usage_data = chunk_data['usage']
                                
                                # Извлекаем содержимое токена
                                if 'choices' in chunk_data and len(chunk_data['choices']) > 0:
                                    choice = chunk_data['choices'][0]
                                    
                                    # Получаем delta контент
                                    delta = choice.get('delta', {})
                                    token_content = delta.get('content', '')
                                    
                                    # Получаем finish_reason (если есть)
                                    if 'finish_reason' in choice:
                                        finish_reason = choice['finish_reason']
                                    
                                    # Если есть новый токен, отправляем его клиенту
                                    if token_content:
                                        accumulated_content += token_content
                                        event_data = {
                                            'token': token_content,
                                            'done': False
                                        }
                                        yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"
                            
                            except json.JSONDecodeError:
                                # Пропускаем некорректные JSON строки
                                continue
                except requests.exceptions.ChunkedEncodingError as e:
                    # Ошибка при чтении chunked потока (обрыв соединения)
                    logger.error(f"Ошибка чтения потока данных: {e}")
                    error_event = {
                        'error': 'Ошибка чтения потока данных: соединение прервано',
                        'status_code': 500
                    }
                    yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
                except requests.exceptions.ConnectionError as e:
                    # Ошибка подключения
                    logger.error(f"Ошибка подключения к OpenRouter: {e}")
                    error_event = {
                        'error': f'Ошибка подключения к OpenRouter: {str(e)}',
                        'status_code': 503
                    }
                    yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
                
            except requests.exceptions.Timeout:
                error_event = {
                    'error': 'Таймаут при запросе к OpenRouter',
                    'status_code': 504
                }
                yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
            
            except requests.exceptions.RequestException as e:
                error_event = {
                    'error': f'Ошибка сети: {str(e)}',
                    'status_code': 500
                }
                yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
            
            except Exception as e:
                error_event = {
                    'error': f'Внутренняя ошибка сервера: {str(e)}',
                    'status_code': 500
                }
                yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
        
        # Возвращаем SSE ответ
        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'  # Отключаем буферизацию для nginx
            }
        )
    
    except Exception as e:
        return jsonify({'error': f'Внутренняя ошибка сервера: {str(e)}'}), 500

