'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import Header from '@/components/Header'
import PollCard from '@/components/PollCard'

interface Category {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  color: string
  pollCount: number
}

interface Poll {
  id: string
  question: string
  description?: string
  options: Array<{
    id: string
    text: string
    votes: number
  }>
  totalVotes: number
  category: {
    slug: string
    name: string
  }
  createdAt: Date
  expiresAt: Date | null
  userVoted: boolean
  votedOptionId?: string
  isFromNews: boolean
  newsSourceUrl?: string
  commentsCount: number
}

export default function CategoriesPage() {
  const { t, i18n } = useTranslation()
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryPolls, setCategoryPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [pollsLoading, setPollsLoading] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [i18n.language])

  useEffect(() => {
    if (selectedCategory) {
      fetchCategoryPolls(selectedCategory)
    }
  }, [selectedCategory])

  const fetchCategories = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/categories?language=${i18n.language}`)
      const data = await response.json()
      setCategories(data)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategoryPolls = async (categorySlug: string) => {
    setPollsLoading(true)
    try {
      const response = await fetch(`http://localhost:5000/api/polls?category=${categorySlug}&language=${i18n.language}`)
      const data = await response.json()
      setCategoryPolls(data.polls || [])
    } catch (error) {
      console.error('Failed to fetch category polls:', error)
      setCategoryPolls([])
    } finally {
      setPollsLoading(false)
    }
  }

  const handleCategoryClick = (categorySlug: string) => {
    setSelectedCategory(selectedCategory === categorySlug ? null : categorySlug)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {t('categories')}
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.slug)}
              className={`p-6 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                selectedCategory === category.slug
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-2xl">{category.icon}</span>
                <h3 className="text-lg font-semibold text-gray-900">
                  {category.name}
                </h3>
              </div>
              
              <p className="text-sm text-gray-600 mb-3">
                {category.description}
              </p>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {category.pollCount} polls
                </span>
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: category.color }}
                ></div>
              </div>
            </button>
          ))}
        </div>

        {selectedCategory && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {categories.find(c => c.slug === selectedCategory)?.name} Polls
              </h2>
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear filter
              </button>
            </div>

            {pollsLoading ? (
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : categoryPolls.length > 0 ? (
              <div className="space-y-6">
                {categoryPolls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <span className="text-4xl">📊</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No polls in this category yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Be the first to create a poll in this category!
                </p>
                <Link
                  href="/create"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  {t('createPoll')}
                </Link>
              </div>
            )}
          </div>
        )}

        {!selectedCategory && categories.length > 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <span className="text-4xl">🗂️</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Select a category to view polls
            </h3>
            <p className="text-gray-500">
              Click on any category above to see polls in that topic
            </p>
          </div>
        )}
      </div>
    </div>
  )
}