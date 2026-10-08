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

    const { textA, textB, nameA, nameB } = await request.json()

    if (!textA || !textB) {
      return NextResponse.json({ error: 'Both documents are required' }, { status: 400 })
    }


    const prompt = `You are a legal document assistant comparing two versions of a contract. Respond in this exact format:

OVERVIEW:
(1-2 sentences on what these two documents appear to be and how similar/different they are overall)

CHANGES:
(bullet list of every meaningful difference between Version A and Version B — dates, amounts, obligations, termination terms, added or removed clauses. For each change, briefly note who it favors: Company, Contractor, neither, or unclear)

NEW RISKS INTRODUCED:
(bullet list of anything in Version B that is riskier for either party than Version A — write "None identified" if nothing stands out)

RISKS REMOVED:
(bullet list of anything that used to be risky in Version A but was fixed/removed in Version B — write "None identified" if nothing stands out)

DISCLAIMER:
This is general information only and not a substitute for advice from a licensed attorney.

VERSION A (${nameA || 'Document A'}):
${textA}

VERSION B (${nameB || 'Document B'}):
${textB}`

   const comparison = await generateText(prompt)

    return NextResponse.json({ success: true, comparison })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}