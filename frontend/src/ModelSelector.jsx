import { useState } from 'react'

const MODELS = [
  { 
    value: 'google/gemini-3.1-pro-preview', 
    label: 'Gemini 3.1 Pro', 
    icon: '💎',
    logo: '/images/models/GoogleGemini.svg'
  },
  { 
    value: 'anthropic/claude-sonnet-4.6', 
    label: 'Claude Sonnet 4.6', 
    icon: '🤖',
    logo: '/images/models/Anthropic.svg'
  },
  { 
    value: 'openai/gpt-5.4', 
    label: 'GPT-5.4', 
    icon: '🧠',
    logo: '/images/models/OpenAI.svg'
  },
  { 
    value: 'deepseek/deepseek-v3.2-speciale', 
    label: 'DeepSeek V3.2 Speciale', 
    icon: '🔍',
    logo: '/images/models/deepseek.svg'
  },
  { 
    value: 'x-ai/grok-4.1-fast', 
    label: 'Grok 4.1 Fast', 
    icon: '⚡',
    logo: '/images/models/grok.svg'
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

