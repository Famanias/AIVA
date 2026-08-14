'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleAuth = async (action: 'login' | 'signup') => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, action }),
      })

      const data = await res.json()
      if (!res.ok || data.status === 'error') {
        throw new Error(data.error || 'Authentication failed')
      }

      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Login to AIVA</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-900 text-red-400 rounded text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleAuth('login')}
              disabled={isLoading}
              className="flex-1 bg-white text-black font-semibold rounded-lg px-4 py-2 hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              Sign In
            </button>
            <button
              onClick={() => handleAuth('signup')}
              disabled={isLoading}
              className="flex-1 bg-zinc-800 text-white font-semibold rounded-lg px-4 py-2 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
