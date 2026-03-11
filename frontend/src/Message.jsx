import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function Message({ message }) {
  const isUser = message.role === 'user'
  const isError = message.isError
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea')
      textArea.value = message.content
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Не удалось скопировать текст:', err)
      }
      document.body.removeChild(textArea)
    }
  }

  const isStreamingEmpty = message.isStreaming && !message.content

  return (
    <div className={`message ${message.role} ${isError ? 'error' : ''} ${isStreamingEmpty ? 'loading' : ''}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        <div className="message-text">
          {!isStreamingEmpty && (
            <button 
              className="copy-button"
              onClick={handleCopy}
              title={copied ? 'Скопировано!' : 'Копировать сообщение'}
              aria-label="Копировать сообщение"
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  {/* Задний лист (оригинал) */}
                  <rect x="3" y="9" width="9" height="12" rx="1" stroke="currentColor" strokeWidth="2"/>
                  {/* Передний лист (копия), накладывается на задний */}
                  <rect x="10" y="3" width="9" height="12" rx="1" stroke="currentColor" strokeWidth="2"/>
                </svg>
              )}
            </button>
          )}
          {isStreamingEmpty ? (
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ) : message.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          ) : (
            <span style={{ opacity: 0.5 }}>...</span>
          )}
        </div>
        {message.finish_reason === 'length' && !isUser && (
          <div className="message-warning" style={{ 
            marginTop: '8px', 
            padding: '8px', 
            backgroundColor: 'rgba(255, 193, 7, 0.1)', 
            borderRadius: '4px',
            fontSize: '0.875rem',
            color: '#ffc107'
          }}>
            ⚠️ Ответ был обрезан из-за достижения лимита токенов
          </div>
        )}
        {message.model && !isUser && !message.isStreaming && (
          <div className="message-model">
            {message.model}
            {message.cost && (
              <span className="message-cost"> • {message.cost.total_cost_rub.toFixed(2)} руб.</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Message

