import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateText } from '@/lib/gemini'

export async function POST(request) {
  try {
    const { documentId, extractedText } = await request.json()

    if (!extractedText) {
      return NextResponse.json({ error: 'No document text provided' }, { status: 400 })
    }

    const prompt = `You are a legal document assistant. You will be given the text of a legal document. Respond in this exact format:

SUMMARY:
(a plain-English summary, max 200 words)

KEY CLAUSES:
(bullet list: parties involved, important dates, obligations, termination terms)

RISK FLAGS:
(bullet list of any unusual or high-risk clauses, explained simply — write "None identified" if nothing stands out)

DISCLAIMER:
This is general information only and not a substitute for advice from a licensed attorney.

Here is the legal document text:

${extractedText}`

    const analysisText = await generateText(prompt)
    

    // Save the analysis back into the documents table
    const { error: dbError } = await supabase
      .from('documents')
      .update({ summary: analysisText })
      .eq('id', documentId)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, analysis: analysisText })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}