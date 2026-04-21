import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const MODEL = 'llama-3.3-70b-versatile'

export async function generateText(prompt: string): Promise<string> {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1024,
  })
  return res.choices[0]?.message?.content?.trim() ?? ''
}

export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  // Groq vision: llama-4-scout supports vision
  const res = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  })
  return res.choices[0]?.message?.content?.trim() ?? ''
}
