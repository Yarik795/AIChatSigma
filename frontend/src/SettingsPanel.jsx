import { useState, useEffect } from 'react'

// Предустановка для деловой переписки (новые значения по умолчанию)
const BUSINESS_CORRESPONDENCE_SETTINGS = {
  temperature: 0.3,
  max_tokens: null,
  verbosity: 'medium',
  frequency_penalty: 0.3,
  top_p: 0.9,
  use_system_prompt: true
}

// Классические настройки (старые значения по умолчанию)
const CLASSIC_SETTINGS = {
  temperature: 1.0,
  max_tokens: null,
  verbosity: 'medium',
  frequency_penalty: 0.0,
  top_p: 1.0,
  use_system_prompt: true
}

// Используем настройки деловой переписки как значения по умолчанию
const DEFAULT_SETTINGS = BUSINESS_CORRESPONDENCE_SETTINGS

// Значение по умолчанию для показа оценки стоимости
const DEFAULT_SHOW_COST_ESTIMATE = true

// Экспортируем для использования в других компонентах
export { BUSINESS_CORRESPONDENCE_SETTINGS, CLASSIC_SETTINGS, DEFAULT_SETTINGS, DEFAULT_SHOW_COST_ESTIMATE }

const PARAMETER_HINTS = {
  temperature: "Контролирует креативность ответов. Низкие значения = более предсказуемые ответы, высокие = более креативные",
  max_tokens: "Максимальное количество токенов в ответе. Оставьте пустым для безлимитной генерации. Больше токенов = длиннее ответ (выше стоимость)",
  verbosity: "Детальность ответа. Low = кратко, Medium = сбалансированно, High = подробно",
  frequency_penalty: "Штраф за повторение слов. Положительные значения уменьшают повторения, отрицательные - увеличивают",
  top_p: "Ограничивает выбор токенов. Низкие значения = более предсказуемые ответы, 1.0 = полный выбор"
}

function SettingsPanel({ isOpen, onClose, settings, onSettingsChange }) {
  const [localSettings, setLocalSettings] = useState(() => {
    // Инициализируем из localStorage или используем переданные settings
    const saved = localStorage.getItem('chatSettings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.max_tokens === 1000) {
          parsed.max_tokens = null
        }
        return { ...DEFAULT_SETTINGS, ...parsed }
      } catch (e) {
        return DEFAULT_SETTINGS
      }
    }
    return settings || DEFAULT_SETTINGS
  })
  const [showCostEstimate, setShowCostEstimate] = useState(() => {
    const saved = localStorage.getItem('showCostEstimate')
    return saved !== null ? saved === 'true' : DEFAULT_SHOW_COST_ESTIMATE
  })
  const [tooltipKey, setTooltipKey] = useState(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const fetchSystemPrompt = async () => {
    setIsLoadingPrompt(true)
    try {
      const response = await fetch('/api/system-prompt')
      if (!response.ok) {
        throw new Error('Ошибка загрузки системного промпта')
      }
      const data = await response.json()
      setSystemPrompt(data.prompt || '')
    } catch (error) {
      console.error('Ошибка при загрузке системного промпта:', error)
      setSystemPrompt('Не удалось загрузить системный промпт')
    } finally {
      setIsLoadingPrompt(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      // Загружаем сохраненные настройки из localStorage
      const saved = localStorage.getItem('chatSettings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // Если max_tokens === 1000 (старое значение по умолчанию), заменяем на null
          if (parsed.max_tokens === 1000) {
            parsed.max_tokens = null
          }
          setLocalSettings({ ...DEFAULT_SETTINGS, ...parsed })
          onSettingsChange({ ...DEFAULT_SETTINGS, ...parsed })
        } catch (e) {
          console.error('Ошибка загрузки настроек:', e)
          // При ошибке используем значения по умолчанию
          setLocalSettings(DEFAULT_SETTINGS)
          onSettingsChange(DEFAULT_SETTINGS)
        }
      } else {
        // Если нет сохраненных настроек, применяем значения по умолчанию
        setLocalSettings(DEFAULT_SETTINGS)
        onSettingsChange(DEFAULT_SETTINGS)
        localStorage.setItem('chatSettings', JSON.stringify(DEFAULT_SETTINGS))
      }
      
      // Загружаем системный промпт
      fetchSystemPrompt()
    }
  }, [isOpen])

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(systemPrompt)
      // Можно добавить визуальную обратную связь (например, временно изменить текст кнопки)
      alert('Системный промпт скопирован в буфер обмена')
    } catch (error) {
      console.error('Ошибка при копировании:', error)
      alert('Не удалось скопировать промпт')
    }
  }

  const handleChange = (key, value) => {
    const newSettings = { ...localSettings, [key]: value }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
    // Сохраняем в localStorage
    localStorage.setItem('chatSettings', JSON.stringify(newSettings))
  }

  const handleBusinessCorrespondence = () => {
    setLocalSettings(BUSINESS_CORRESPONDENCE_SETTINGS)
    onSettingsChange(BUSINESS_CORRESPONDENCE_SETTINGS)
    localStorage.setItem('chatSettings', JSON.stringify(BUSINESS_CORRESPONDENCE_SETTINGS))
  }

  const handleReset = () => {
    setLocalSettings(CLASSIC_SETTINGS)
    onSettingsChange(CLASSIC_SETTINGS)
    localStorage.setItem('chatSettings', JSON.stringify(CLASSIC_SETTINGS))
  }

  const handleToggleCostEstimate = (checked) => {
    setShowCostEstimate(checked)
    localStorage.setItem('showCostEstimate', checked.toString())
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Проверка соответствия текущих настроек пресету "Деловая переписка"
  const isBusinessCorrespondenceActive = () => {
    const current = localSettings
    const preset = BUSINESS_CORRESPONDENCE_SETTINGS
    
    // Сравниваем все ключевые параметры
    return (
      Math.abs(current.temperature - preset.temperature) < 0.01 &&
      current.max_tokens === preset.max_tokens &&
      current.verbosity === preset.verbosity &&
      Math.abs(current.frequency_penalty - preset.frequency_penalty) < 0.01 &&
      Math.abs(current.top_p - preset.top_p) < 0.01 &&
      current.use_system_prompt === preset.use_system_prompt
    )
  }

  if (!isOpen) return null

  return (
    <>
      <div className="settings-overlay" onClick={handleOverlayClick}></div>
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Настройки генерации</h2>
          <button className="settings-close-button" onClick={onClose} aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="settings-content">
          {/* Основные настройки */}
          <div className="settings-section">
            <h3>Основные настройки</h3>

            {/* Temperature */}
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="temperature">Креативность (Temperature)</label>
                <div className="tooltip-container">
                  <button
                    className="tooltip-icon"
                    onMouseEnter={() => setTooltipKey('temperature')}
                    onMouseLeave={() => setTooltipKey(null)}
                    aria-label="Подсказка"
                  >
                    ?
                  </button>
                  {tooltipKey === 'temperature' && (
                    <div className="tooltip">{PARAMETER_HINTS.temperature}</div>
                  )}
                </div>
              </div>
              <div className="setting-control">
                <input
                  type="range"
                  id="temperature"
                  min="0"
                  max="2"
                  step="0.1"
                  value={localSettings.temperature}
                  onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                />
                <span className="setting-value">{localSettings.temperature.toFixed(1)}</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="max_tokens">Максимальная длина (Max Tokens)</label>
                <div className="tooltip-container">
                  <button
                    className="tooltip-icon"
                    onMouseEnter={() => setTooltipKey('max_tokens')}
                    onMouseLeave={() => setTooltipKey(null)}
                    aria-label="Подсказка"
                  >
                    ?
                  </button>
                  {tooltipKey === 'max_tokens' && (
                    <div className="tooltip">{PARAMETER_HINTS.max_tokens}</div>
                  )}
                </div>
              </div>
              <div className="setting-control">
                <input
                  type="number"
                  id="max_tokens"
                  max="4000"
                  step="50"
                  value={localSettings.max_tokens || ''}
                  placeholder="Без лимита"
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '' || value === null) {
                      handleChange('max_tokens', null)
                    } else {
                      const parsed = parseInt(value)
                      if (!isNaN(parsed) && parsed > 0) {
                        handleChange('max_tokens', parsed)
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Verbosity */}
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="verbosity">Детальность (Verbosity)</label>
                <div className="tooltip-container">
                  <button
                    className="tooltip-icon"
                    onMouseEnter={() => setTooltipKey('verbosity')}
                    onMouseLeave={() => setTooltipKey(null)}
                    aria-label="Подсказка"
                  >
                    ?
                  </button>
                  {tooltipKey === 'verbosity' && (
                    <div className="tooltip">{PARAMETER_HINTS.verbosity}</div>
                  )}
                </div>
              </div>
              <div className="setting-control">
                <select
                  id="verbosity"
                  value={localSettings.verbosity}
                  onChange={(e) => handleChange('verbosity', e.target.value)}
                >
                  <option value="low">Low (Кратко)</option>
                  <option value="medium">Medium (Сбалансированно)</option>
                  <option value="high">High (Подробно)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Дополнительные настройки */}
          <div className="settings-section">
            <h3>Дополнительные настройки</h3>

            {/* Frequency Penalty */}
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="frequency_penalty">Штраф за повторения (Frequency Penalty)</label>
                <div className="tooltip-container">
                  <button
                    className="tooltip-icon"
                    onMouseEnter={() => setTooltipKey('frequency_penalty')}
                    onMouseLeave={() => setTooltipKey(null)}
                    aria-label="Подсказка"
                  >
                    ?
                  </button>
                  {tooltipKey === 'frequency_penalty' && (
                    <div className="tooltip">{PARAMETER_HINTS.frequency_penalty}</div>
                  )}
                </div>
              </div>
              <div className="setting-control">
                <input
                  type="range"
                  id="frequency_penalty"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={localSettings.frequency_penalty}
                  onChange={(e) => handleChange('frequency_penalty', parseFloat(e.target.value))}
                />
                <span className="setting-value">{localSettings.frequency_penalty.toFixed(1)}</span>
              </div>
            </div>

            {/* Top P */}
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="top_p">Разнообразие выбора (Top P)</label>
                <div className="tooltip-container">
                  <button
                    className="tooltip-icon"
                    onMouseEnter={() => setTooltipKey('top_p')}
                    onMouseLeave={() => setTooltipKey(null)}
                    aria-label="Подсказка"
                  >
                    ?
                  </button>
                  {tooltipKey === 'top_p' && (
                    <div className="tooltip">{PARAMETER_HINTS.top_p}</div>
                  )}
                </div>
              </div>
              <div className="setting-control">
                <input
                  type="range"
                  id="top_p"
                  min="0"
                  max="1"
                  step="0.05"
                  value={localSettings.top_p}
                  onChange={(e) => handleChange('top_p', parseFloat(e.target.value))}
                />
                <span className="setting-value">{localSettings.top_p.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Интерфейс */}
          <div className="settings-section">
            <h3>Интерфейс</h3>

            {/* Показывать оценку стоимости */}
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="show-cost-estimate">Показывать оценку стоимости</label>
              </div>
              <div className="setting-control">
                <input
                  type="checkbox"
                  id="show-cost-estimate"
                  checked={showCostEstimate}
                  onChange={(e) => handleToggleCostEstimate(e.target.checked)}
                />
              </div>
            </div>
          </div>

          {/* Системный промпт */}
          <div className="settings-section">
            <h3>Системный промпт</h3>
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="system-prompt">Текущий системный промпт</label>
              </div>
              <div className="setting-control">
                {isLoadingPrompt ? (
                  <div className="prompt-loading">Загрузка...</div>
                ) : (
                  <>
                    <textarea
                      id="system-prompt"
                      className="system-prompt-textarea"
                      readOnly={true}
                      value={systemPrompt}
                      rows={10}
                    />
                    <button
                      type="button"
                      className="settings-copy-button"
                      onClick={handleCopyPrompt}
                      disabled={!systemPrompt || isLoadingPrompt}
                    >
                      Копировать
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="use-system-prompt">Использовать системный промпт</label>
              </div>
              <div className="setting-control">
                <input
                  type="checkbox"
                  id="use-system-prompt"
                  checked={localSettings.use_system_prompt !== false}
                  onChange={(e) => handleChange('use_system_prompt', e.target.checked)}
                />
              </div>
            </div>
          </div>

          {/* Кнопки предустановок */}
          <div className="settings-footer">
            <button 
              className={`settings-reset-button ${isBusinessCorrespondenceActive() ? 'active' : ''}`}
              onClick={handleBusinessCorrespondence}
            >
              Деловая переписка
            </button>
            <button className="settings-reset-button" onClick={handleReset}>
              Сброс
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default SettingsPanel

