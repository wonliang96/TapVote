'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlusIcon, FireIcon, Squares2X2Icon, UserIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import LanguageSwitcher from './LanguageSwitcher'
import Logo from './Logo'

interface User {
  id: string
  email: string
  username?: string
  preferredLanguage: string
}

export default function Header() {
  const { t } = useTranslation()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    // Check for logged in user
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')
      
      if (token && userData) {
        try {
          setUser(JSON.parse(userData))
        } catch (error) {
          console.error('Error parsing user data:', error)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        }
      }
    }
  }, [])

  const handleSignOut = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setShowUserMenu(false)
    router.push('/')
  }

  const handleUserIconClick = () => {
    if (user) {
      setShowUserMenu(!showUserMenu)
    } else {
      router.push('/login')
    }
  }

  return (
    <header className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-gray-200/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="group hover:scale-105 transition-transform duration-200">
            <Logo size="md" showText={true} />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            <Link 
              href="/" 
              className="group flex items-center space-x-2 px-4 py-2 rounded-xl text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-all duration-200"
            >
              <FireIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">{t('trending')}</span>
            </Link>
            <Link 
              href="/categories" 
              className="group flex items-center space-x-2 px-4 py-2 rounded-xl text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
            >
              <Squares2X2Icon className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">{t('categories')}</span>
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            <Link
              href="/create"
              className="group inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <PlusIcon className="h-4 w-4 group-hover:rotate-90 transition-transform duration-200" />
              <span className="font-semibold">{t('createPoll')}</span>
            </Link>
            
            <LanguageSwitcher />
            
            <div className="relative">
              <button 
                onClick={handleUserIconClick}
                className="group relative p-2.5 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
              >
                {user && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                )}
                <UserIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && user && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 z-20 mt-3 w-56 bg-white rounded-xl shadow-2xl ring-1 ring-black ring-opacity-5 border border-gray-100">
                    <div className="py-2">
                      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {(user.username || user.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{user.username || 'User'}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors group"
                      >
                        <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3 group-hover:scale-110 transition-transform" />
                        <span className="font-medium">{t('signOut')}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200">
        <div className="flex justify-around py-2">
          <Link 
            href="/" 
            className="flex flex-col items-center space-y-1 p-2 text-gray-700"
          >
            <FireIcon className="h-5 w-5" />
            <span className="text-xs">{t('trending')}</span>
          </Link>
          <Link 
            href="/categories" 
            className="flex flex-col items-center space-y-1 p-2 text-gray-700"
          >
            <Squares2X2Icon className="h-5 w-5" />
            <span className="text-xs">{t('categories')}</span>
          </Link>
          <Link 
            href="/create" 
            className="flex flex-col items-center space-y-1 p-2 text-blue-600"
          >
            <PlusIcon className="h-5 w-5" />
            <span className="text-xs">{t('createPoll')}</span>
          </Link>
          <button 
            onClick={handleUserIconClick}
            className="flex flex-col items-center space-y-1 p-2 text-gray-700"
          >
            <UserIcon className="h-5 w-5" />
            <span className="text-xs">{user ? t('profile') : t('signIn')}</span>
          </button>
        </div>
      </div>
    </header>
  )
}