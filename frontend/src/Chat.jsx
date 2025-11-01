import { useState, useRef, useEffect } from 'react'
import Message from './Message'

function Chat({ selectedModel, settings }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

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

    try {
      const requestPayload = {
        message: userMessage,
        model: selectedModel,
        temperature: settings.temperature,
        verbosity: settings.verbosity,
        frequency_penalty: settings.frequency_penalty,
        top_p: settings.top_p
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
          body: JSON.stringify(requestPayload)
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
            // Ошибка при чтении потока (может быть из-за обрыва соединения)
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
        try {
          reader.releaseLock()
        } catch (e) {
          // Игнорируем ошибки при закрытии
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
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
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
        {isLoading && (
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
          <button 
            type="submit" 
            className="send-button"
            disabled={!input.trim() || isLoading}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}

export default Chat

