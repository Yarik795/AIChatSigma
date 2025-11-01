import { useState, useEffect } from 'react'
import Chat from './Chat'
import ModelSelector from './ModelSelector'
import SettingsPanel, { DEFAULT_SETTINGS } from './SettingsPanel'

function App() {
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-pro')
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
        <h1>OpenRouter Chat</h1>
        <div className="header-controls">
          <button 
            className="theme-toggle-button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
            title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
          >
            {theme === 'dark' ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 3.33333V1.66667M10 18.3333V16.6667M16.6667 10H18.3333M1.66667 10H3.33333M15.7733 4.22667L16.8867 3.11333M3.11333 16.8867L4.22667 15.7733M15.7733 15.7733L16.8867 16.8867M3.11333 3.11333L4.22667 4.22667M14.1667 10C14.1667 12.3012 12.3012 14.1667 10 14.1667C7.69882 14.1667 5.83333 12.3012 5.83333 10C5.83333 7.69882 7.69882 5.83333 10 5.83333C12.3012 5.83333 14.1667 7.69882 14.1667 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 16.25C13.4518 16.25 16.25 13.4518 16.25 10C16.25 6.54822 13.4518 3.75 10 3.75C6.54822 3.75 3.75 6.54822 3.75 10C3.75 13.4518 6.54822 16.25 10 16.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 3.33333V1.66667M10 18.3333V16.6667M16.6667 10H18.3333M1.66667 10H3.33333M15.7733 4.22667L16.8867 3.11333M3.11333 16.8867L4.22667 15.7733M15.7733 15.7733L16.8867 16.8867M3.11333 3.11333L4.22667 4.22667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          <button 
            className="settings-button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Открыть настройки"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16.875 10.625C16.875 10.8321 16.8321 11.0392 16.875 11.25C16.6679 11.4571 16.4571 11.4179 16.25 11.5C16.0429 11.5821 15.9179 11.7071 15.75 11.875C15.5821 12.0429 15.4571 12.1679 15.25 12.25C15.0429 12.3321 14.8321 12.2929 14.625 12.375C14.4179 12.4571 14.3321 12.6679 14.125 12.875C13.9179 13.0821 13.7071 13.1679 13.5 13.25C13.2929 13.3321 13.1679 13.4571 13 13.625C12.8321 13.7929 12.7071 13.9179 12.5 14C12.2929 14.0821 12.0821 14.0429 11.875 14.125C11.6679 14.2071 11.5821 14.4179 11.375 14.625C11.1679 14.8321 10.9571 14.9179 10.75 15C10.5429 15.0821 10.4179 15.2071 10.25 15.375C10.0821 15.5429 9.95714 15.6679 9.75 15.75C9.54286 15.8321 9.33214 15.7929 9.125 15.875C8.91786 15.9571 8.83214 16.1679 8.625 16.375C8.41786 16.5821 8.20714 16.6679 8 16.75C7.79286 16.8321 7.66786 16.9571 7.5 17.125C7.33214 17.2929 7.20714 17.4179 7 17.5C6.79286 17.5821 6.58214 17.5429 6.375 17.625C6.16786 17.7071 6.08214 17.9179 5.875 18.125C5.66786 18.3321 5.45714 18.4179 5.25 18.5C5.04286 18.5821 4.91786 18.7071 4.75 18.875C4.58214 19.0429 4.45714 19.1679 4.25 19.25C4.04286 19.3321 3.83214 19.2929 3.625 19.375C3.41786 19.4571 3.33214 19.6679 3.125 19.875C2.91786 20.0821 2.70714 20.1679 2.5 20.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.125 9.375C3.125 9.16786 3.16786 8.96071 3.125 8.75C3.33214 8.54286 3.54286 8.58214 3.75 8.5C3.95714 8.41786 4.08214 8.29286 4.25 8.125C4.41786 7.95714 4.54286 7.83214 4.75 7.75C4.95714 7.66786 5.16786 7.70714 5.375 7.625C5.58214 7.54286 5.66786 7.33214 5.875 7.125C6.08214 6.91786 6.29286 6.83214 6.5 6.75C6.70714 6.66786 6.83214 6.54286 7 6.375C7.16786 6.20714 7.29286 6.08214 7.5 6C7.70714 5.91786 7.91786 5.95714 8.125 5.875C8.33214 5.79286 8.41786 5.58214 8.625 5.375C8.83214 5.16786 9.04286 5.08214 9.25 5C9.45714 4.91786 9.58214 4.79286 9.75 4.625C9.91786 4.45714 10.0429 4.33214 10.25 4.25C10.4571 4.16786 10.6679 4.20714 10.875 4.125C11.0821 4.04286 11.1679 3.83214 11.375 3.625C11.5821 3.41786 11.7929 3.33214 12 3.25C12.2071 3.16786 12.3321 3.04286 12.5 2.875C12.6679 2.70714 12.7929 2.58214 13 2.5C13.2071 2.41786 13.4179 2.45714 13.625 2.375C13.8321 2.29286 13.9179 2.08214 14.125 1.875C14.3321 1.66786 14.5429 1.58214 14.75 1.5C14.9571 1.41786 15.0821 1.29286 15.25 1.125C15.4179 0.957143 15.5429 0.832143 15.75 0.75C15.9571 0.667857 16.1679 0.707143 16.375 0.625C16.5821 0.542857 16.6679 0.332143 16.875 0.125" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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

