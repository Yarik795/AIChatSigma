import { useState } from 'react'

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

  return (
    <div className={`message ${message.role} ${isError ? 'error' : ''}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        <div className="message-text">
          {!isUser && (
            <button 
              className="copy-button"
              onClick={handleCopy}
              title={copied ? 'Скопировано!' : 'Копировать ответ'}
              aria-label="Копировать ответ"
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5.5 4.5H3.5C2.94772 4.5 2.5 4.94772 2.5 5.5V12.5C2.5 13.0523 2.94772 13.5 3.5 13.5H10.5C11.0523 13.5 11.5 13.0523 11.5 12.5V10.5M9.5 2.5H13.5C14.0523 2.5 14.5 2.94772 14.5 3.5V7.5M9.5 2.5H6.5C5.94772 2.5 5.5 2.94772 5.5 3.5V7.5M9.5 2.5L14.5 7.5M14.5 7.5H11.5M14.5 7.5V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          )}
          {message.content ? (
            message.content.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < message.content.split('\n').length - 1 && <br />}
              </span>
            ))
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
        {message.model && !isUser && (
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

