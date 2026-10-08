'use client'

import jsPDF from 'jspdf'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [document, setDocument] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

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
    setDocument(null)
    setChatMessages([])

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
      setStatus('❌ ' + (data.userFacing ? data.error : 'Something went wrong uploading your file. Please try again.'))
      console.error('Upload error:', data.error)
      return
    }
    
    setStatus('✅ Upload successful! Analyzing document...')
    setDocument(data.document)
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
      setStatus('❌ Something went wrong analyzing your document. Please try again.')
      console.error('Analyze error:', data.error)
      return
    }

    setStatus('✅ Analysis complete!')
    setAnalysis(data.analysis)
  }

  function handleDownloadPDF() {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const usableWidth = pageWidth - margin * 2
  const bottomMargin = 20
  let y = 20

  // Clean characters jsPDF's default fonts can't render correctly
  const safeAnalysis = analysis
    .replace(/₹/g, 'Rs. ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, '-')

  function ensureSpace(neededHeight) {
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage()
      y = 20
    }
  }

  function writeParagraph(text, fontSize = 11) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, usableWidth)
    lines.forEach((line) => {
      ensureSpace(6)
      doc.text(line, margin, y)
      y += 6
    })
  }

  function writeBullet(text) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const bulletIndent = 6
    const lines = doc.splitTextToSize(text, usableWidth - bulletIndent)

    // Keep the whole bullet together if it reasonably fits on one page
    ensureSpace(lines.length * 6)

    lines.forEach((line, i) => {
      ensureSpace(6)
      if (i === 0) {
        doc.text('•', margin, y)
      }
      doc.text(line, margin + bulletIndent, y)
      y += 6
    })
    y += 1 // small gap after each bullet
  }

  function writeHeading(text) {
    ensureSpace(12)
    y += 3
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(text, margin, y)
    y += 7
  }

  // --- Title block ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('AI Legal Document Analysis', margin, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Document: ${document.file_name}`, margin, y)
  y += 5
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y)
  y += 4
  doc.setTextColor(0)

  // Divider line
  ensureSpace(6)
  y += 2
  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // --- Parse the analysis into sections ---
  const knownHeadings = ['SUMMARY:', 'KEY CLAUSES:', 'RISK FLAGS:', 'DISCLAIMER:']
  const rawLines = safeAnalysis.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)

  let currentHeading = null
  let currentBuffer = []

  function flushBuffer() {
    currentBuffer.forEach((line) => {
      if (line.startsWith('*') || line.startsWith('-')) {
        const cleaned = line.replace(/^[\*\-]\s*/, '').replace(/\*\*/g, '')
        writeBullet(cleaned)
      } else {
        writeParagraph(line.replace(/\*\*/g, ''))
      }
    })
    currentBuffer = []
  }

  rawLines.forEach((line) => {
    const matchedHeading = knownHeadings.find((h) => line.toUpperCase().startsWith(h))
    if (matchedHeading) {
      flushBuffer()
      currentHeading = matchedHeading.replace(':', '')
      writeHeading(currentHeading)
    } else {
      currentBuffer.push(line)
    }
  })
  flushBuffer()

  doc.save(`${document.file_name.replace(/\.[^/.]+$/, '')}-analysis.pdf`)
}

  async function handleSendChat() {
    if (!chatInput.trim() || !document) return

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
        extractedText: document.extracted_text,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>AI Legal Document Assistant</h1>
        <button onClick={handleLogout}>Log Out</button>
      </div>
      <p><a href="/compare">Compare two contract versions →</a></p>
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
        <div style={{ marginTop: '1rem' }}>
          <button onClick={handleDownloadPDF} style={{ marginBottom: '1rem' }}>
            📄 Download as PDF
          </button>
          <div style={{ border: '1px solid #ccc', padding: '1rem', whiteSpace: 'pre-wrap' }}>
            {analysis}
          </div>
        </div>
      )}

      {document && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Ask a question about this document</h2>

          <div style={{ border: '1px solid #ccc', padding: '1rem', minHeight: '100px', marginBottom: '1rem' }}>
            {chatMessages.length === 0 && <p style={{ color: '#888' }}>No questions yet. Try asking something like "What happens if I terminate early?"</p>}

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
            placeholder="Ask a question about this document..."
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