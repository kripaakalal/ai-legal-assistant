'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('Working...')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setStatus('❌ ' + error.message)
        return
      }
      setStatus('✅ Account created! You are now logged in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setStatus('❌ ' + error.message)
        return
      }
      setStatus('✅ Logged in!')
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '400px' }}>
      <h1>{mode === 'login' ? 'Log In' : 'Sign Up'}</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '0.5rem' }}>
          {mode === 'login' ? 'Log In' : 'Sign Up'}
        </button>
      </form>

      <p>{status}</p>

      <p>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </main>
  )
}