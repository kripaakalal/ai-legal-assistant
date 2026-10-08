import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Tried in order. If the first stays overloaded, we fall back to the next.
const MODELS = ['gemini-flash-lite-latest', 'gemini-3.6-flash']
const ATTEMPTS_PER_MODEL = 3

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Only temporary problems are worth retrying
function isRetryable(err) {
  const msg = String(err?.message || '')
  return (
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('fetch failed')
  )
}

export async function generateText(prompt) {
  let lastError

  for (const modelName of MODELS) {
    const model = genAI.getGenerativeModel({ model: modelName })

    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      const started = Date.now()
      try {
        const result = await model.generateContent(prompt)
        console.log(`[gemini] ${modelName} attempt ${attempt} succeeded in ${Date.now() - started}ms`)
        return result.response.text()
      } catch (err) {
        lastError = err
        console.log(`[gemini] ${modelName} attempt ${attempt} failed after ${Date.now() - started}ms: ${String(err.message).slice(0, 80)}`)
        if (!isRetryable(err)) throw err
        if (attempt < ATTEMPTS_PER_MODEL) {
          await sleep(1000 * attempt)
        }
      }
    }
  }

  throw lastError
}