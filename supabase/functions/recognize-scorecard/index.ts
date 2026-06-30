// Follow this setup if the editor cannot resolve Deno globals:
// https://supabase.com/docs/guides/functions/development-environment

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RecognizedPlayer = {
  name: string
  diffs: Array<number | null>
}

type RecognizedScorecard = {
  players: RecognizedPlayer[]
  pars: Array<number | null>
  courseName?: string
  recognizedCourseName?: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function cleanNumberArray(value: unknown, maxLength = 18): Array<number | null> {
  if (!Array.isArray(value)) return []
  return value.slice(0, maxLength).map((item) =>
    typeof item === 'number' && Number.isFinite(item) ? item : null
  )
}

function normalizePayload(value: unknown): RecognizedScorecard {
  const raw = (value ?? {}) as {
    players?: unknown
    pars?: unknown
    courseName?: unknown
    course_name?: unknown
    recognizedCourseName?: unknown
    recognized_course_name?: unknown
  }
  const players = Array.isArray(raw.players) ? raw.players : []
  const courseName = typeof raw.courseName === 'string'
    ? raw.courseName
    : typeof raw.course_name === 'string'
      ? raw.course_name
      : ''
  const recognizedCourseName = typeof raw.recognizedCourseName === 'string'
    ? raw.recognizedCourseName
    : typeof raw.recognized_course_name === 'string'
      ? raw.recognized_course_name
      : ''

  return {
    players: players.slice(0, 8).map((player) => {
      const p = (player ?? {}) as { name?: unknown; diffs?: unknown }
      return {
        name: typeof p.name === 'string' ? p.name.trim() : '',
        diffs: cleanNumberArray(p.diffs),
      }
    }),
    pars: cleanNumberArray(raw.pars),
    courseName: courseName.trim() || undefined,
    recognizedCourseName: recognizedCourseName.trim() || undefined,
  }
}

function parseJsonFromText(text: string) {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('OCR response did not contain JSON.')
    return JSON.parse(match[0])
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return jsonResponse({ error: 'ANTHROPIC_API_KEY is not configured for this Edge Function.' }, 500)
    }

    const { imageBase64, mediaType = 'image/jpeg' } = await req.json().catch(() => ({})) as {
      imageBase64?: string
      mediaType?: string
    }
    if (!imageBase64) {
      return jsonResponse({ error: 'imageBase64 is required.' }, 400)
    }

    const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6'
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0,
        system: [
          'You read golf scorecard images and return JSON only.',
          'Return this shape: {"players":[{"name":"string","diffs":[number|null]}],"pars":[number|null],"courseName":"string","recognizedCourseName":"string"}.',
          'diffs are strokes relative to par for each visible hole. birdie=-1, par=0, bogey=1, double=2.',
          'Use null for unreadable cells. Keep hole order exactly as shown.',
          'Do not include markdown fences or explanatory text.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the players, hole pars, course name, and score differences from this golf scorecard.',
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      return jsonResponse({ error: `Anthropic request failed (${response.status}): ${detail}` }, 502)
    }

    const result = await response.json()
    const text = Array.isArray(result?.content)
      ? result.content
        .filter((part: { type?: unknown; text?: unknown }) => part?.type === 'text' && typeof part.text === 'string')
        .map((part: { text: string }) => part.text)
        .join('\n')
      : ''
    if (!text.trim()) {
      return jsonResponse({ error: 'Anthropic returned an empty OCR response.' }, 502)
    }

    return jsonResponse(normalizePayload(parseJsonFromText(text)))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return jsonResponse({ error: message }, 500)
  }
})
