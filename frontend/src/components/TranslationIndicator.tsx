'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { translationManager } from '@/lib/translation'

interface TranslationIndicatorProps {
  originalText: string
  originalLanguage: string
  className?: string
}

export default function TranslationIndicator({
  originalText,
  originalLanguage,
  className = ''
}: TranslationIndicatorProps) {
  const { t, i18n } = useTranslation()
  const [showOriginal, setShowOriginal] = useState(false)
  const [translatedText, setTranslatedText] = useState<string>('')
  const [isMachineTranslated, setIsMachineTranslated] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)

  const currentLanguage = i18n.language
  const needsTranslation = originalLanguage !== currentLanguage

  useEffect(() => {
    if (needsTranslation) {
      translateText()
    }
  }, [originalText, originalLanguage, currentLanguage])

  const translateText = async () => {
    if (!needsTranslation) return

    setIsTranslating(true)
    try {
      const result = await translationManager.translateText(
        originalText,
        originalLanguage,
        currentLanguage
      )
      setTranslatedText(result.text)
      setIsMachineTranslated(result.isMachineTranslated)
    } catch (error) {
      console.error('Translation failed:', error)
      setTranslatedText(originalText)
      setIsMachineTranslated(false)
    } finally {
      setIsTranslating(false)
    }
  }

  if (!needsTranslation) {
    return <span className={className}>{originalText}</span>
  }

  const displayText = showOriginal ? originalText : translatedText || originalText

  return (
    <div className="space-y-1">
      <div className={className}>
        {isTranslating ? (
          <div className="flex items-center space-x-2">
            <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-gray-500">Translating...</span>
          </div>
        ) : (
          displayText
        )}
      </div>
      
      {!isTranslating && translatedText && (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            <LanguageIcon className="h-3 w-3" />
            <span>
              {showOriginal ? 'Show Translated' : t('showOriginal')}
            </span>
          </button>
          
          {isMachineTranslated && !showOriginal && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {t('machineTranslated')}
            </span>
          )}

          <span className="text-xs text-gray-400">
            {originalLanguage.toUpperCase()} → {currentLanguage.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  )
}