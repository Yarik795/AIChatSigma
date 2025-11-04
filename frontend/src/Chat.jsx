import { useState, useRef, useEffect, useCallback } from 'react'
import Message from './Message'

function Chat({ selectedModel, settings }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [costEstimate, setCostEstimate] = useState(null)
  const [isEstimating, setIsEstimating] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const abortControllerRef = useRef(null)
  const readerRef = useRef(null)
  const estimateTimeoutRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const autoResizeTextarea = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      const maxHeight = 200 // максимальная высота в пикселях
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    autoResizeTextarea()
  }, [input])

  // Функция для получения истории чата в формате для API
  const getChatHistory = useCallback(() => {
    return messages
      .filter(msg => {
        // Исключаем streaming сообщения
        if (msg.isStreaming) return false
        // Исключаем сообщения с ошибками
        if (msg.isError) return false
        // Включаем только user и assistant сообщения
        return msg.role === 'user' || msg.role === 'assistant'
      })
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }))
  }, [messages])

  // Функция оценки стоимости
  const estimateCost = useCallback(async (messageText) => {
    if (!messageText.trim() || isLoading) {
      setCostEstimate(null)
      return
    }

    setIsEstimating(true)

    try {
      // Получаем историю чата для оценки
      const history = getChatHistory()

      const requestPayload = {
        message: messageText,
        model: selectedModel,
        history: history.length > 0 ? history : undefined,
        max_tokens: settings.max_tokens || undefined,
        use_system_prompt: settings.use_system_prompt !== false,
        use_ia_style: settings.use_ia_style === true
      }

      const response = await fetch('/api/estimate-cost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      })

      if (response.ok) {
        const data = await response.json()
        setCostEstimate(data)
      } else {
        // Если ошибка - просто не показываем оценку
        setCostEstimate(null)
      }
    } catch (error) {
      // При ошибке просто не показываем оценку
      setCostEstimate(null)
    } finally {
      setIsEstimating(false)
    }
  }, [isLoading, selectedModel, settings.max_tokens, settings.use_system_prompt, settings.use_ia_style, getChatHistory])

  // Debounce для оценки стоимости при вводе текста
  useEffect(() => {
    // Очищаем предыдущий таймер
    if (estimateTimeoutRef.current) {
      clearTimeout(estimateTimeoutRef.current)
    }

    // Если поле пустое - очищаем оценку
    if (!input.trim()) {
      setCostEstimate(null)
      return
    }

    // Читаем настройку из localStorage
    const showEstimate = localStorage.getItem('showCostEstimate')
    if (showEstimate === 'false') {
      setCostEstimate(null)
      return
    }

    // Устанавливаем таймер на 500мс для debounce
    estimateTimeoutRef.current = setTimeout(() => {
      estimateCost(input)
    }, 500)

    // Очистка при размонтировании или изменении зависимостей
    return () => {
      if (estimateTimeoutRef.current) {
        clearTimeout(estimateTimeoutRef.current)
      }
    }
  }, [input, estimateCost])

  // Обновляем оценку при изменении модели или настроек
  useEffect(() => {
    if (input.trim() && !isLoading) {
      // Очищаем старую оценку при смене модели
      setCostEstimate(null)
      
      // Читаем настройку из localStorage
      const showEstimate = localStorage.getItem('showCostEstimate')
      if (showEstimate !== 'false') {
        // Пересчитываем с небольшой задержкой
        const timeoutId = setTimeout(() => {
          estimateCost(input)
        }, 300)
        
        return () => clearTimeout(timeoutId)
      }
    }
  }, [selectedModel, settings.max_tokens, settings.use_system_prompt, input, isLoading, estimateCost])

  const handleStreamingSend = async (userMessage) => {
    // Создаем placeholder сообщение ассистента
    const placeholderMessage = {
      role: 'assistant',
      content: '',
      model: selectedModel,
      isStreaming: true // Флаг для идентификации streaming сообщения
    }
    
    setMessages(prev => [...prev, placeholderMessage])
    setIsLoading(true)

    // Создаем новый AbortController для этого запроса
    abortControllerRef.current = new AbortController()
    readerRef.current = null

    try {
      // Получаем историю чата (исключая текущее сообщение пользователя, которое передается отдельно)
      const history = getChatHistory()
      // Убираем последнее сообщение пользователя из истории, так как оно передается как текущее message
      const historyWithoutLastUser = history.length > 0 && history[history.length - 1].role === 'user'
        ? history.slice(0, -1)
        : history

      const requestPayload = {
        message: userMessage,
        model: selectedModel,
        temperature: settings.temperature,
        verbosity: settings.verbosity,
        frequency_penalty: settings.frequency_penalty,
        top_p: settings.top_p,
        use_system_prompt: settings.use_system_prompt !== false,
        use_ia_style: settings.use_ia_style === true
      }
      
      // Передаем историю только если она не пустая
      if (historyWithoutLastUser.length > 0) {
        requestPayload.history = historyWithoutLastUser
      }
      
      // Передаем max_tokens только если он установлен (не null и > 0)
      if (settings.max_tokens !== null && settings.max_tokens > 0) {
        requestPayload.max_tokens = settings.max_tokens
      }
      
      // Отправляем запрос к streaming endpoint
      let response
      try {
        response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestPayload),
          signal: abortControllerRef.current.signal
        })
      } catch (fetchError) {
        // Обработка сетевых ошибок (network error, CORS, timeout и т.д.)
        if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
          throw new Error('Ошибка сети: не удалось подключиться к серверу. Проверьте подключение к интернету.')
        }
        throw new Error(`Ошибка сети: ${fetchError.message || 'Неизвестная ошибка'}`)
      }

      if (!response) {
        throw new Error('Не получен ответ от сервера')
      }

      if (!response.ok) {
        // Пытаемся получить детали ошибки из ответа
        let errorMessage = `Ошибка HTTP ${response.status}`
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // Если не удалось распарсить JSON, используем стандартное сообщение
          errorMessage = `Ошибка HTTP ${response.status}: ${response.statusText || 'Неизвестная ошибка'}`
        }
        throw new Error(errorMessage)
      }

      // Проверяем наличие body перед чтением
      if (!response.body) {
        throw new Error('Пустой ответ от сервера')
      }

      // Получаем ReadableStream
      const reader = response.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      
      let buffer = ''
      let accumulatedContent = ''
      let finalModel = selectedModel
      let finishReason = null
      let costInfo = null

      try {
        while (true) {
          let readResult
          try {
            readResult = await reader.read()
          } catch (readError) {
            // Ошибка при чтении потока (может быть из-за обрыва соединения или прерывания запроса)
            if (readError.name === 'AbortError') {
              // Запрос был прерван пользователем
              throw readError
            }
            throw new Error(`Ошибка чтения потока данных: ${readError.message || 'Соединение прервано'}`)
          }
          
          const { done, value } = readResult
          
          if (done) {
            break
          }

          // Проверяем наличие данных
          if (value === undefined || value === null) {
            throw new Error('Получены пустые данные из потока')
          }

          // Декодируем chunk
          try {
            buffer += decoder.decode(value, { stream: true })
          } catch (decodeError) {
            throw new Error(`Ошибка декодирования данных: ${decodeError.message}`)
          }
          
          // Парсим SSE события (формат: "data: {...}\n\n")
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Оставляем неполную строку в буфере

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6) // Убираем "data: "
              
              try {
                const eventData = JSON.parse(dataStr)
                
                // Проверяем на ошибку
                if (eventData.error) {
                  throw new Error(eventData.error)
                }
                
                // Если поток завершен
                if (eventData.done) {
                  finalModel = eventData.model || selectedModel
                  finishReason = eventData.finish_reason
                  costInfo = eventData.cost
                  break
                }
                
                // Получаем токен и добавляем к накопленному контенту
                if (eventData.token) {
                  accumulatedContent += eventData.token
                  
                  // Обновляем последнее сообщение ассистента (streaming)
                  setMessages(prev => {
                    const newMessages = [...prev]
                    // Находим последнее сообщение ассистента с флагом isStreaming
                    for (let i = newMessages.length - 1; i >= 0; i--) {
                      if (newMessages[i].role === 'assistant' && newMessages[i].isStreaming) {
                        newMessages[i] = {
                          ...newMessages[i],
                          content: accumulatedContent
                        }
                        break
                      }
                    }
                    return newMessages
                  })
                  
                  // Автопрокрутка при добавлении нового текста
                  setTimeout(() => scrollToBottom(), 0)
                }
              } catch (parseError) {
                // Игнорируем ошибки парсинга отдельных событий (некорректный JSON)
                if (parseError.message && !parseError.message.includes('Unexpected token') && !parseError.message.includes('JSON')) {
                  // Если это не ошибка парсинга JSON, а реальная ошибка - пробрасываем дальше
                  throw parseError
                }
              }
            }
          }
        }
      } finally {
        // Закрываем reader в любом случае
        if (readerRef.current) {
          try {
            readerRef.current.releaseLock()
          } catch (e) {
            // Игнорируем ошибки при закрытии
          }
          readerRef.current = null
        }
      }

      // Финальное обновление сообщения с метаданными (убираем флаг isStreaming)
      setMessages(prev => {
        const newMessages = [...prev]
        // Находим последнее сообщение ассистента с флагом isStreaming
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].role === 'assistant' && newMessages[i].isStreaming) {
            newMessages[i] = {
              ...newMessages[i],
              content: accumulatedContent,
              model: finalModel,
              finish_reason: finishReason,
              cost: costInfo,
              isStreaming: undefined // Убираем флаг
            }
            break
          }
        }
        return newMessages
      })

    } catch (error) {
      // Проверяем, был ли запрос прерван пользователем
      if (error.name === 'AbortError') {
        // Запрос был прерван пользователем - обрабатываем как нормальное прерывание
        setMessages(prev => {
          const newMessages = [...prev]
          // Находим последнее сообщение ассистента с флагом isStreaming
          for (let i = newMessages.length - 1; i >= 0; i--) {
            if (newMessages[i].role === 'assistant' && newMessages[i].isStreaming) {
              // Сохраняем накопленный контент, если есть
              const currentContent = newMessages[i].content || ''
              newMessages[i] = {
                ...newMessages[i],
                content: currentContent || '(Генерация прервана)',
                isStreaming: undefined
              }
              break
            }
          }
          return newMessages
        })
        return // Выходим без показа ошибки
      }
      
      // Определяем понятное сообщение об ошибке
      let errorMessage = 'Произошла ошибка'
      
      if (error instanceof TypeError) {
        // Сетевые ошибки (network error, CORS, etc.)
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Ошибка сети: не удалось подключиться к серверу. Проверьте подключение к интернету и убедитесь, что сервер запущен.'
        } else {
          errorMessage = `Ошибка сети: ${error.message}`
        }
      } else if (error instanceof Error) {
        // Ошибки с сообщением
        errorMessage = error.message
      } else if (typeof error === 'string') {
        // Строковые ошибки
        errorMessage = error
      } else {
        // Прочие ошибки
        errorMessage = `Неизвестная ошибка: ${String(error)}`
      }
      
      // Обновляем сообщение с ошибкой
      setMessages(prev => {
        const newMessages = [...prev]
        // Находим последнее сообщение ассистента с флагом isStreaming
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].role === 'assistant' && newMessages[i].isStreaming) {
            newMessages[i] = {
              ...newMessages[i],
              content: `❌ ${errorMessage}`,
              isError: true,
              isStreaming: undefined
            }
            break
          }
        }
        return newMessages
      })
      
      // Логируем ошибку в консоль для отладки
      console.error('Ошибка при отправке сообщения:', error)
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    // Прерываем запрос через AbortController
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    // Также пытаемся закрыть reader если он есть
    if (readerRef.current) {
      try {
        readerRef.current.cancel()
        readerRef.current.releaseLock()
      } catch (e) {
        // Игнорируем ошибки при закрытии
      }
      readerRef.current = null
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setCostEstimate(null)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setCostEstimate(null)  // Очищаем оценку при отправке
    // Сброс высоты textarea после отправки
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }, 0)
    
    // Добавляем сообщение пользователя
    const newUserMessage = { role: 'user', content: userMessage }
    setMessages(prev => [...prev, newUserMessage])
    
    // Используем streaming отправку
    await handleStreamingSend(userMessage)
  }

  return (
    <div className="chat-container">
      {messages.length > 0 && (
        <div className="chat-header">
          <button 
            className="new-chat-button"
            onClick={handleNewChat}
            aria-label="Начать новый чат"
            title="Начать новый чат"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3.33333V1.33333M8 14.6667V12.6667M14.6667 8H12.6667M3.33333 8H1.33333M12.6187 3.38133L11.528 4.472M4.472 11.528L3.38133 12.6187M12.6187 12.6187L11.528 11.528M4.472 4.472L3.38133 3.38133M11.3333 8C11.3333 9.84095 9.84095 11.3333 8 11.3333C6.15905 11.3333 4.66667 9.84095 4.66667 8C4.66667 6.15905 6.15905 4.66667 8 4.66667C9.84095 4.66667 11.3333 6.15905 11.3333 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Новый чат</span>
          </button>
        </div>
      )}
      <div className="messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Начните диалог</h2>
            <p>Выберите модель и отправьте сообщение</p>
          </div>
        )}
        {messages.map((message, index) => (
          <Message key={index} message={message} />
        ))}
        {isLoading && !messages.some(msg => msg.role === 'assistant' && msg.isStreaming) && (
          <div className="message assistant loading">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="input-form" onSubmit={handleSend}>
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="message-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              autoResizeTextarea()
            }}
            onPaste={(e) => {
              setTimeout(() => {
                autoResizeTextarea()
              }, 0)
            }}
            onInput={autoResizeTextarea}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            placeholder="Введите сообщение..."
            rows="1"
            disabled={isLoading}
          />
          {isLoading ? (
            <button 
              type="button" 
              className="stop-button"
              onClick={handleStop}
              aria-label="Остановить генерацию"
              title="Остановить генерацию"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="6" y="6" width="8" height="8" rx="1" fill="currentColor"/>
              </svg>
            </button>
          ) : (
            <button 
              type="submit" 
              className="send-button"
              disabled={!input.trim() || isLoading}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        {costEstimate && !isLoading && (
          <div className="cost-estimate">
            <span className="cost-estimate-icon">💰</span>
            <span className="cost-estimate-text">
              ~{costEstimate.estimated_cost_rub.toFixed(2)}₽ за этот запрос
            </span>
            {isEstimating && (
              <span className="cost-estimate-loading">...</span>
            )}
          </div>
        )}
      </form>
    </div>
  )
}

export default Chat

