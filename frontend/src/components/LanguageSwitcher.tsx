'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, LanguageIcon } from '@heroicons/react/24/outline'
import { supportedLanguages, type SupportedLanguage } from '@/lib/i18n'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const currentLanguage = i18n.language as SupportedLanguage
  const currentLanguageName = supportedLanguages[currentLanguage] || supportedLanguages.en

  const handleLanguageChange = (language: SupportedLanguage) => {
    i18n.changeLanguage(language)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
      >
        <LanguageIcon className="h-4 w-4" />
        <span>{currentLanguageName}</span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-48 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="py-1">
              {Object.entries(supportedLanguages).map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code as SupportedLanguage)}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    currentLanguage === code 
                      ? 'text-blue-600 bg-blue-50' 
                      : 'text-gray-700'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}