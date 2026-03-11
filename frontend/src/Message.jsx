import { useState } from 'react'
import { Copy, Check, User, Bot, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

function Message({ message, isLastAssistant, onRetry }) {
  const isUser = message.role === 'user'
  const isError = message.isError
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState(null) // 'up' | 'down' | null

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

  /** Стиль подсветки кода в зависимости от темы */
  const codeStyle = typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'light'
    ? oneLight
    : oneDark

  /** Кастомный рендер кода для ReactMarkdown */
  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : 'text'
      return !inline ? (
        <SyntaxHighlighter
          style={codeStyle}
          language={language}
          PreTag="div"
          customStyle={{
            margin: '0.75em 0',
            borderRadius: '0.5rem',
            fontSize: '0.875em',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
          }}
          codeTagProps={{ style: { fontFamily: 'inherit' } }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }
  }

  return (
    <div className={`message ${message.role} ${isError ? 'error' : ''} ${isStreamingEmpty ? 'loading' : ''}`}>
      <div className="message-avatar">
        {isUser ? <User size={18} strokeWidth={1.75} /> : <Bot size={18} strokeWidth={1.75} />}
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
                <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
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
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
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
        {/* Feedback: thumbs up/down и retry для ответов ассистента */}
        {!isUser && !message.isStreaming && !isError && (
          <div className="message-feedback">
            <button
              type="button"
              className={`feedback-btn ${feedback === 'up' ? 'active' : ''}`}
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
              aria-label="Хороший ответ"
              title="Хороший ответ"
            >
              <ThumbsUp size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={`feedback-btn ${feedback === 'down' ? 'active' : ''}`}
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
              aria-label="Плохой ответ"
              title="Плохой ответ"
            >
              <ThumbsDown size={14} strokeWidth={1.75} />
            </button>
            {isLastAssistant && onRetry && (
              <button
                type="button"
                className="feedback-btn"
                onClick={onRetry}
                aria-label="Перегенерировать ответ"
                title="Перегенерировать ответ"
              >
                <RotateCcw size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Message

