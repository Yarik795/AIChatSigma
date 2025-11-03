"""
Утилита для расчета стоимости запросов к OpenRouter API
"""
import requests
import logging

# Курс доллара к рублю
USD_TO_RUB = 110.0

# URL для получения списка моделей и их тарифов
MODELS_API_URL = "https://openrouter.ai/api/v1/models"

# Кэш для тарифов моделей (чтобы не запрашивать каждый раз)
_model_pricing_cache = {}

# Коэффициенты для оценки токенов
# Примерное соотношение: для русского языка ~2-2.5 символа на токен, для английского ~3-4 символа
# Используем консервативное значение 2.5 для смешанного контента
CHARS_PER_TOKEN_RU = 2.5  # для русского текста
CHARS_PER_TOKEN_EN = 4.0  # для английского текста
DEFAULT_CHARS_PER_TOKEN = 2.7  # усреднённое значение для смешанного контента

# Средняя оценка выходных токенов (если max_tokens не задан)
DEFAULT_COMPLETION_TOKENS = 400  # средний ответ ассистента


def get_model_pricing(model_id: str) -> dict:
    """
    Получает тарифы для модели из OpenRouter API
    
    Args:
        model_id: ID модели (например, 'anthropic/claude-sonnet-4.5')
    
    Returns:
        dict: Словарь с тарифами {'prompt': float, 'completion': float, 'request': float}
              или None если тарифы не найдены
    """
    # Проверяем кэш
    if model_id in _model_pricing_cache:
        return _model_pricing_cache[model_id]
    
    try:
        models_response = requests.get(MODELS_API_URL, timeout=30)
        if models_response.status_code == 200:
            models_data = models_response.json()
            
            # Ищем тарифы для используемой модели
            model_pricing = None
            for model in models_data.get('data', []):
                if model.get('id') == model_id or model.get('canonical_slug') == model_id:
                    pricing = model.get('pricing')
                    if pricing:
                        model_pricing = {
                            'prompt': float(pricing.get('prompt', '0')),
                            'completion': float(pricing.get('completion', '0')),
                            'request': float(pricing.get('request', '0'))
                        }
                    break
            
            # Сохраняем в кэш
            if model_pricing:
                _model_pricing_cache[model_id] = model_pricing
            
            return model_pricing
        else:
            logging.warning(f"Не удалось получить список моделей: HTTP {models_response.status_code}")
            return None
    except Exception as e:
        logging.warning(f"Ошибка при получении тарифов: {str(e)}")
        return None


def calculate_cost_rub(response_data: dict, model_id: str = None) -> dict:
    """
    Вычисляет стоимость запроса в рублях с округлением до копеек
    
    Args:
        response_data: Ответ от OpenRouter API (должен содержать 'usage' и 'model')
        model_id: ID модели (если не указан, берется из response_data)
    
    Returns:
        dict: {
            'total_cost_rub': float,  # Общая стоимость в рублях (округлено до копеек)
            'prompt_tokens': int,
            'completion_tokens': int,
            'total_tokens': int,
            'cost_breakdown': {
                'prompt_cost_rub': float,
                'completion_cost_rub': float,
                'request_cost_rub': float
            }
        } или None если не удалось рассчитать
    """
    # Получаем информацию об использовании токенов
    usage = response_data.get('usage', {})
    if not usage:
        return None
    
    prompt_tokens = usage.get('prompt_tokens', 0)
    completion_tokens = usage.get('completion_tokens', 0)
    total_tokens = usage.get('total_tokens', 0)
    
    # Получаем ID модели
    if not model_id:
        model_id = response_data.get('model')
    
    if not model_id:
        return None
    
    # Получаем тарифы модели
    pricing = get_model_pricing(model_id)
    if not pricing:
        return None
    
    # Вычисляем стоимость в USD
    prompt_cost_usd = prompt_tokens * pricing['prompt']
    completion_cost_usd = completion_tokens * pricing['completion']
    request_cost_usd = pricing['request']
    total_cost_usd = prompt_cost_usd + completion_cost_usd + request_cost_usd
    
    # Конвертируем в рубли
    prompt_cost_rub = prompt_cost_usd * USD_TO_RUB
    completion_cost_rub = completion_cost_usd * USD_TO_RUB
    request_cost_rub = request_cost_usd * USD_TO_RUB
    total_cost_rub = total_cost_usd * USD_TO_RUB
    
    # Округляем до копеек (2 знака после запятой)
    prompt_cost_rub = round(prompt_cost_rub, 2)
    completion_cost_rub = round(completion_cost_rub, 2)
    request_cost_rub = round(request_cost_rub, 2)
    total_cost_rub = round(total_cost_rub, 2)
    
    return {
        'total_cost_rub': total_cost_rub,
        'prompt_tokens': prompt_tokens,
        'completion_tokens': completion_tokens,
        'total_tokens': total_tokens,
        'cost_breakdown': {
            'prompt_cost_rub': prompt_cost_rub,
            'completion_cost_rub': completion_cost_rub,
            'request_cost_rub': request_cost_rub
        }
    }


def estimate_token_count(text: str) -> int:
    """
    Оценивает количество токенов в тексте на основе приблизительного соотношения.
    
    Args:
        text: Текст для оценки
    
    Returns:
        int: Приблизительное количество токенов
    """
    if not text:
        return 0
    
    # Определяем соотношение символов к токенам на основе языка
    # Простая эвристика: если много кириллицы, используем коэффициент для русского
    cyrillic_count = sum(1 for char in text if '\u0400' <= char <= '\u04FF')
    total_chars = len(text)
    
    if total_chars == 0:
        return 0
    
    # Если больше 30% кириллицы - используем коэффициент для русского
    if cyrillic_count / total_chars > 0.3:
        chars_per_token = CHARS_PER_TOKEN_RU
    else:
        chars_per_token = CHARS_PER_TOKEN_EN
    
    # Оцениваем количество токенов
    estimated_tokens = int(text.count(' ') + 1)  # минимальная оценка по словам
    # Уточняем оценку по символам
    estimated_by_chars = int(total_chars / chars_per_token)
    
    # Берем максимум из двух оценок (более консервативный подход)
    return max(estimated_tokens, estimated_by_chars)


def estimate_cost_rub(
    message: str,
    model_id: str,
    history: list = None,
    system_prompt: str = None,
    max_tokens: int = None
) -> dict:
    """
    Оценивает стоимость запроса в рублях ДО отправки.
    
    Args:
        message: Текст запроса пользователя
        model_id: ID модели для запроса
        history: История сообщений (список dict с 'role' и 'content')
        system_prompt: Системный промпт (если используется)
        max_tokens: Максимальное количество токенов для ответа (если задано)
    
    Returns:
        dict: {
            'estimated_cost_rub': float,  # Оценка стоимости в рублях
            'estimated_prompt_tokens': int,
            'estimated_completion_tokens': int,
            'estimated_total_tokens': int
        } или None если не удалось оценить
    """
    if not message or not model_id:
        return None
    
    # Получаем тарифы модели
    pricing = get_model_pricing(model_id)
    if not pricing:
        return None
    
    # Оцениваем токены входных данных
    prompt_tokens = 0
    
    # Системный промпт
    if system_prompt:
        prompt_tokens += estimate_token_count(system_prompt)
    
    # История сообщений
    if history:
        for msg in history:
            if isinstance(msg, dict):
                content = msg.get('content', '')
                if content:
                    prompt_tokens += estimate_token_count(content)
                    # Добавляем небольшой overhead на метаданные (role и форматирование)
                    prompt_tokens += 4
    
    # Текущее сообщение пользователя
    prompt_tokens += estimate_token_count(message)
    prompt_tokens += 4  # overhead на метаданные
    
    # Оцениваем выходные токены
    if max_tokens and max_tokens > 0:
        completion_tokens = max_tokens
    else:
        completion_tokens = DEFAULT_COMPLETION_TOKENS
    
    total_tokens = prompt_tokens + completion_tokens
    
    # Рассчитываем стоимость в USD
    prompt_cost_usd = prompt_tokens * pricing['prompt']
    completion_cost_usd = completion_tokens * pricing['completion']
    request_cost_usd = pricing['request']
    total_cost_usd = prompt_cost_usd + completion_cost_usd + request_cost_usd
    
    # Конвертируем в рубли и округляем до копеек
    estimated_cost_rub = round(total_cost_usd * USD_TO_RUB, 2)
    
    return {
        'estimated_cost_rub': estimated_cost_rub,
        'estimated_prompt_tokens': prompt_tokens,
        'estimated_completion_tokens': completion_tokens,
        'estimated_total_tokens': total_tokens
    }

