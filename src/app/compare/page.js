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

  const [combinedText, setCombinedText] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

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
    setChatMessages([])
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

      // Build one combined text block so chat can reference both documents + the comparison itself
      const combined = `VERSION A (${fileA.name}):\n${textA}\n\nVERSION B (${fileB.name}):\n${textB}\n\nAI-GENERATED COMPARISON OF THESE TWO VERSIONS:\n${data.comparison}`
      setCombinedText(combined)
    } catch (err) {
      setStatus('❌ Something went wrong comparing these documents. Please try again.')
      console.error('Compare error:', err.message)
    } finally {
      setComparing(false)
    }
  }

  async function handleSendChat() {
    if (!chatInput.trim() || !combinedText) return

    const question = chatInput.trim()
    const newMessages = [...chatMessages, { role: 'user', content: question }]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        extractedText: combinedText,
        question,
        history: newMessages,
      }),
    })

    const data = await res.json()
    setChatLoading(false)

    if (!res.ok) {
      setChatMessages([...newMessages, { role: 'assistant', content: '❌ Something went wrong. Please try asking again.' }])
      console.error('Chat error:', data.error)
      return
    }

    setChatMessages([...newMessages, { role: 'assistant', content: data.answer }])
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

      {combinedText && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Ask a question about these two versions</h2>

          <div style={{ border: '1px solid #ccc', padding: '1rem', minHeight: '100px', marginBottom: '1rem' }}>
            {chatMessages.length === 0 && (
              <p style={{ color: '#888' }}>
                No questions yet. Try asking something like "Which version is better for the contractor?"
              </p>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} style={{ marginBottom: '0.75rem' }}>
                <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            ))}

            {chatLoading && <p>🤖 Thinking...</p>}
          </div>

          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder="Ask a question about these versions..."
            style={{ width: '75%', padding: '0.5rem' }}
          />
          <button onClick={handleSendChat} style={{ marginLeft: '1rem' }} disabled={chatLoading}>
            Send
          </button>
        </div>
      )}
    </main>
  )
}