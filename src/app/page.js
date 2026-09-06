'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleUpload() {
    if (!file) {
      setStatus('Please select a file first.')
      return
    }

    setStatus('Uploading and extracting text...')
    setAnalysis(null)

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
      setStatus('❌ Something went wrong uploading your file. Please try again, or use a different file.')
      console.error('Upload error:', data.error) // full detail stays in browser console for you to debug
      return
    }

    setStatus('✅ Upload successful! Analyzing document...')
    handleAnalyze(data.document)
  }

  async function handleAnalyze(doc) {
    setAnalyzing(true)

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: doc.id,
        extractedText: doc.extracted_text,
      }),
    })

    const data = await res.json()
    setAnalyzing(false)

    if (!res.ok) {
      setStatus('❌ Something went wrong analyzing your document. Please try again in a moment.')
      console.error('Analyze error:', data.error)
      return
    }

    setStatus('✅ Analysis complete!')
    setAnalysis(data.analysis)
  }

  if (checkingAuth) {
    return <main style={{ padding: '2rem' }}>Checking login status...</main>
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>AI Legal Document Assistant</h1>
        <button onClick={handleLogout}>Log Out</button>
      </div>
      <p>Logged in as: {user?.email}</p>

      <input
        type="file"
        accept=".pdf,.docx"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button onClick={handleUpload} style={{ marginLeft: '1rem' }}>
        Upload
      </button>

      <p>{status}</p>

      {analyzing && <p>🤖 Gemini is analyzing your document...</p>}

      {analysis && (
        <div style={{ marginTop: '1rem', border: '1px solid #ccc', padding: '1rem', whiteSpace: 'pre-wrap' }}>
          {analysis}
        </div>
      )}
    </main>
  )
}