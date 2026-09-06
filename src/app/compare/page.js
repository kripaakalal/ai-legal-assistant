'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Compare() {
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [fileA, setFileA] = useState(null)
  const [fileB, setFileB] = useState(null)
  const [status, setStatus] = useState('')
  const [comparing, setComparing] = useState(false)
  const [comparison, setComparison] = useState(null)

  const router = useRouter()

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
      }
      setCheckingAuth(false)
    }
    checkUser()
  }, [router])

  async function extractText(file) {
    const { data: { session } } = await supabase.auth.getSession()

    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', user.id)

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to process file')
    }

    return data.document.extracted_text
  }

  async function handleCompare() {
    if (!fileA || !fileB) {
      setStatus('Please select both documents.')
      return
    }

    setStatus('Extracting text from both documents...')
    setComparison(null)
    setComparing(true)

    try {
      const [textA, textB] = await Promise.all([
        extractText(fileA),
        extractText(fileB),
      ])

      setStatus('Comparing versions...')

      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          textA,
          textB,
          nameA: fileA.name,
          nameB: fileB.name,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Comparison failed')
      }

      setStatus('✅ Comparison complete!')
      setComparison(data.comparison)
    } catch (err) {
      setStatus('❌ Something went wrong comparing these documents. Please try again.')
      console.error('Compare error:', err.message)
    } finally {
      setComparing(false)
    }
  }

  if (checkingAuth) {
    return <main style={{ padding: '2rem' }}>Checking login status...</main>
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '700px' }}>
      <h1>Compare Contract Versions</h1>
      <p><a href="/">← Back to home</a></p>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <strong>Version A (older):</strong>
        </label>
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={(e) => setFileA(e.target.files[0])}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <strong>Version B (newer):</strong>
        </label>
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={(e) => setFileB(e.target.files[0])}
        />
      </div>

      <button onClick={handleCompare} disabled={comparing}>
        {comparing ? 'Comparing...' : 'Compare Documents'}
      </button>

      <p>{status}</p>

      {comparison && (
        <div style={{ marginTop: '1.5rem', border: '1px solid #ccc', padding: '1rem', whiteSpace: 'pre-wrap' }}>
          {comparison}
        </div>
      )}
    </main>
  )
}