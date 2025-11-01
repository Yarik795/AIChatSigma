"""
Утилита для загрузки системного промпта из файла или переменной окружения
"""
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Кэш для промпта в памяти
_cached_prompt = None


def get_system_prompt() -> str:
    """
    Загружает системный промпт из файла или переменной окружения.
    
    Приоритет:
    1. Переменная окружения SYSTEM_PROMPT (если установлена)
    2. Файл app/config/system_prompt.txt
    3. Пустая строка (fallback)
    
    Returns:
        str: Системный промпт или пустая строка
    """
    global _cached_prompt
    
    # Проверяем переменную окружения (имеет наивысший приоритет)
    env_prompt = os.environ.get('SYSTEM_PROMPT')
    if env_prompt:
        logger.info("Загружен системный промпт из переменной окружения SYSTEM_PROMPT")
        _cached_prompt = env_prompt
        return _cached_prompt
    
    # Если промпт уже закэширован, возвращаем его
    if _cached_prompt is not None:
        return _cached_prompt
    
    # Определяем путь к файлу промпта
    # app/config/prompt_loader.py -> app/config/ -> app/config/system_prompt.txt
    current_file = Path(__file__)
    prompt_file = current_file.parent / 'system_prompt.txt'
    
    try:
        # Читаем промпт из файла
        if prompt_file.exists() and prompt_file.is_file():
            with open(prompt_file, 'r', encoding='utf-8') as f:
                prompt_content = f.read().strip()
                
            if prompt_content:
                logger.info(f"Загружен системный промпт из файла: {prompt_file}")
                _cached_prompt = prompt_content
                return _cached_prompt
            else:
                logger.warning(f"Файл промпта пуст: {prompt_file}")
        else:
            logger.warning(f"Файл промпта не найден: {prompt_file}")
    
    except Exception as e:
        logger.error(f"Ошибка при чтении файла промпта: {e}")
    
    # Fallback: возвращаем пустую строку
    logger.info("Системный промпт не загружен, используется пустая строка")
    _cached_prompt = ""
    return _cached_prompt


def clear_cache():
    """
    Очищает кэш промпта. Полезно для тестирования или при изменении промпта во время выполнения.
    """
    global _cached_prompt
    _cached_prompt = None
    logger.info("Кэш системного промпта очищен")

