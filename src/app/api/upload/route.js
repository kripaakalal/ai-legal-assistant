import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import mammoth from 'mammoth'

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

    const formData = await request.formData()
    const file = formData.get('file')
    const userId = formData.get('userId')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Extract text based on file type
    let extractedText = ''
    if (file.type === 'application/pdf') {
      try {
        const pdfData = await pdfParse(buffer)
        extractedText = pdfData.text
      } catch (parseErr) {
        console.error('PDF parse error:', parseErr.message)
        return NextResponse.json(
        {
        error: 'This PDF could not be read. It may be damaged or saved in an unsupported way. Try re-saving it (open it, then Print > Save as PDF) and upload again.',
        userFacing: true,
        },
        { status: 422 }
       )
      }
    } else if (
      file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF or DOCX.' },
        { status: 400 }
      )
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract any text from this file.' },
        { status: 400 }
      )
    }

    // Upload the original file to Supabase Storage
    const fileName = `${Date.now()}-${file.name}`
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(fileName, buffer, { contentType: file.type })

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 })
    }

    // Save a record in the documents table
    const { data: dbData, error: dbError } = await supabase
      .from('documents')
      .insert({
        file_name: file.name,
        extracted_text: extractedText,
        user_id: userId,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, document: dbData })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}