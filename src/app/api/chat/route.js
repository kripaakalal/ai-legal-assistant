import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateText } from '@/lib/gemini'

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { extractedText, question, history } = await request.json()

    if (!extractedText || !question) {
      return NextResponse.json({ error: 'Missing document text or question' }, { status: 400 })
    }

  

    const historyText = (history || [])
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')

    const prompt = `You are a legal document assistant answering follow-up questions about a specific document. Only answer based on the document text provided below. If the answer isn't in the document, say so clearly instead of guessing. Keep answers concise and in plain English. If the question asks for advice or a recommendation, remind the user this is general information, not legal advice.

DOCUMENT TEXT:
${extractedText}

CONVERSATION SO FAR:
${historyText}

New question: ${question}

Answer:`

    
    const answer = await generateText(prompt)

    return NextResponse.json({ success: true, answer })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}