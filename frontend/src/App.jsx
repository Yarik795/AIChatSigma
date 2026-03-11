import { useState, useEffect } from 'react'
import { Sun, Moon, Settings } from 'lucide-react'
import Chat from './Chat'
import ModelSelector from './ModelSelector'
import SettingsPanel, { DEFAULT_SETTINGS } from './SettingsPanel'

function App() {
  const [selectedModel, setSelectedModel] = useState('google/gemini-3.1-pro-preview')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [theme, setTheme] = useState(() => {
    // Загружаем сохраненную тему из localStorage или используем 'dark' по умолчанию
    const savedTheme = localStorage.getItem('theme')
    return savedTheme || 'dark'
  })

  useEffect(() => {
    // Загружаем сохраненные настройки при загрузке приложения
    const saved = localStorage.getItem('chatSettings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Если max_tokens === 1000 (старое значение по умолчанию), заменяем на null
        if (parsed.max_tokens === 1000) {
          parsed.max_tokens = null
        }
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      } catch (e) {
        console.error('Ошибка загрузки настроек:', e)
        // При ошибке используем значения по умолчанию
        setSettings(DEFAULT_SETTINGS)
        localStorage.setItem('chatSettings', JSON.stringify(DEFAULT_SETTINGS))
      }
    } else {
      // Если нет сохраненных настроек, применяем и сохраняем значения по умолчанию
      setSettings(DEFAULT_SETTINGS)
      localStorage.setItem('chatSettings', JSON.stringify(DEFAULT_SETTINGS))
    }
  }, [])

  useEffect(() => {
    // Применяем тему к body элементу
    document.body.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-brand">
          <img src="/images/sb.png" alt="Логотип" className="header-logo" />
          <span className="header-title">Помощник по бюрократии</span>
        </div>
        <div className="header-controls">
          <button 
            className="theme-toggle-button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
            title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
          >
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
          </button>
          <button 
            className="settings-button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Открыть настройки"
          >
            <Settings size={18} strokeWidth={1.75} />
            <span>Настройки</span>
          </button>
          <ModelSelector 
            selectedModel={selectedModel} 
            onModelChange={setSelectedModel} 
          />
        </div>
      </div>
      <Chat selectedModel={selectedModel} settings={settings} />
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  )
}

export default App

