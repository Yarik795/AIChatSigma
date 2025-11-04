"""
Утилита для загрузки системного промпта из файла или переменной окружения
"""
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Кэш для промпта в памяти
_cached_prompt = None
_cached_additional_prompt = None


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


def get_additional_ia_prompt() -> str:
    """
    Загружает дополнительный промпт "Стиль И.А." из файла.
    
    Приоритет:
    1. Файл app/config/style_ia_prompt.txt
    2. Пустая строка (fallback)
    
    Returns:
        str: Дополнительный промпт или пустая строка
    """
    global _cached_additional_prompt
    
    # Если промпт уже закэширован, возвращаем его
    if _cached_additional_prompt is not None:
        return _cached_additional_prompt
    
    # Определяем путь к файлу дополнительного промпта
    current_file = Path(__file__)
    prompt_file = current_file.parent / 'style_ia_prompt.txt'
    
    try:
        # Читаем промпт из файла
        if prompt_file.exists() and prompt_file.is_file():
            with open(prompt_file, 'r', encoding='utf-8') as f:
                prompt_content = f.read().strip()
                
            if prompt_content:
                logger.info(f"Загружен дополнительный промпт 'Стиль И.А.' из файла: {prompt_file}")
                _cached_additional_prompt = prompt_content
                return _cached_additional_prompt
            else:
                logger.info(f"Файл дополнительного промпта пуст: {prompt_file}")
        else:
            logger.info(f"Файл дополнительного промпта не найден: {prompt_file}")
    
    except Exception as e:
        logger.error(f"Ошибка при чтении файла дополнительного промпта: {e}")
    
    # Fallback: возвращаем пустую строку
    _cached_additional_prompt = ""
    return _cached_additional_prompt


def get_combined_system_prompt(use_ia_style: bool = False) -> str:
    """
    Возвращает объединенный системный промпт с учетом настройки 'Стиль И.А.'.
    
    Args:
        use_ia_style: Если True, добавляет дополнительный промпт после основного
    
    Returns:
        str: Объединенный системный промпт или только основной, если use_ia_style=False
    """
    main_prompt = get_system_prompt()
    
    if not use_ia_style:
        return main_prompt
    
    additional_prompt = get_additional_ia_prompt()
    
    if not additional_prompt:
        # Если дополнительный промпт пуст, возвращаем только основной
        return main_prompt
    
    # Объединяем промпты через два переноса строки
    combined = f"{main_prompt}\n\n{additional_prompt}"
    return combined


def clear_cache():
    """
    Очищает кэш промптов. Полезно для тестирования или при изменении промпта во время выполнения.
    """
    global _cached_prompt, _cached_additional_prompt
    _cached_prompt = None
    _cached_additional_prompt = None
    logger.info("Кэш системных промптов очищен")

