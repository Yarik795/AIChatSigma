import { useState } from 'react'

const MODELS = [
  { 
    value: 'google/gemini-2.5-pro', 
    label: 'Gemini 2.5 Pro', 
    icon: '💎',
    logo: '/images/models/GoogleGemini.svg'
  },
  { 
    value: 'anthropic/claude-sonnet-4.5', 
    label: 'Claude Sonnet 4.5', 
    icon: '🤖',
    logo: '/images/models/Anthropic.svg'
  },
  { 
    value: 'x-ai/grok-4-fast', 
    label: 'Grok 4 Fast', 
    icon: '⚡',
    logo: '/images/models/Grok.png'
  },
  { 
    value: 'deepseek/deepseek-chat-v3-0324', 
    label: 'DeepSeek Chat v3', 
    icon: '🔍',
    logo: '/images/models/DeepSeek.png'
  },
  { 
    value: 'qwen/qwen3-235b-a22b-2507', 
    label: 'Qwen3 235B', 
    icon: '🧠',
    logo: '/images/models/Qwen.png'
  },
  { 
    value: 'google/gemini-3-pro-preview', 
    label: 'Gemini 3 Pro Preview', 
    icon: '💎',
    logo: '/images/models/GoogleGemini.svg'
  },
]

function ModelSelector({ selectedModel, onModelChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [imageErrors, setImageErrors] = useState({})

  const selectedModelData = MODELS.find(m => m.value === selectedModel)
  const selectedLabel = selectedModelData?.label || selectedModel
  const selectedIcon = selectedModelData?.icon || '🤖'
  const selectedLogo = selectedModelData?.logo

  const handleImageError = (modelValue) => {
    setImageErrors(prev => ({ ...prev, [modelValue]: true }))
  }

  const renderModelIcon = (model, isSelected = false) => {
    if (!model || !model.value) {
      return <span className="model-icon-emoji">🤖</span>
    }
    
    const hasError = imageErrors[model.value]
    const shouldShowLogo = model.logo && !hasError

    if (shouldShowLogo) {
      return (
        <img 
          src={model.logo} 
          alt={`${model.label} logo`}
          className="model-logo"
          onError={(e) => {
            console.log(`Failed to load logo for ${model.label}:`, model.logo)
            if (model.value) {
              handleImageError(model.value)
            }
          }}
          onLoad={() => {
            console.log(`Successfully loaded logo for ${model.label}`)
          }}
        />
      )
    }
    return <span className="model-icon-emoji">{model.icon || '🤖'}</span>
  }

  return (
    <div className="model-selector">
      <button 
        className="model-selector-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        {renderModelIcon(selectedModelData, true)}
        <span>{selectedLabel}</span>
        <span className="arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="model-dropdown">
          {MODELS.map(model => (
            <button
              key={model.value}
              className={`model-option ${selectedModel === model.value ? 'active' : ''}`}
              onClick={() => {
                onModelChange(model.value)
                setIsOpen(false)
              }}
            >
              {renderModelIcon(model)}
              <span>{model.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ModelSelector

