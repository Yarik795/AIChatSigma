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

