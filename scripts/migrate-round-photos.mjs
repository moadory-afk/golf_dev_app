import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const BUCKET = 'round-photos'

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]

    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }

  const [header, ...body] = rows.filter((item) => item.length > 1)
  const keys = header.map((key) => key.trim())
  return body.map((values) => Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ''])))
}

function decodeDataUrl(value) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw new Error('Invalid image data URL')
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

async function main() {
  const csvPath = process.argv[2] ?? 'scripts/round-photo-base64.csv'
  const shouldUpdateDb = process.argv.includes('--update-db')
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const csvText = await readFile(csvPath, 'utf8')
  const rows = parseCsv(csvText)
    .map((row) => ({
      roundId: row.round_id,
      photoIndex: Number(row.photo_index),
      base64Data: row.base64_data,
    }))
    .filter((row) => row.roundId && Number.isInteger(row.photoIndex) && row.base64Data.startsWith('data:image/'))

  if (rows.length === 0) throw new Error('No base64 round photos found in CSV.')

  const updateSql = []
  const uploaded = []

  for (const row of rows) {
    const { contentType, buffer } = decodeDataUrl(row.base64Data)
    const ext = contentType.includes('png') ? 'png' : 'jpg'
    const objectPath = `${row.roundId}/${row.photoIndex}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buffer, {
        contentType,
        upsert: true,
      })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`
    uploaded.push({ ...row, publicUrl })

    updateSql.push(
      [
        'update rounds',
        `set photo_data = jsonb_set(photo_data, '{${row.photoIndex}}', to_jsonb(${sqlString(publicUrl)}::text))`,
        `where id = ${sqlString(row.roundId)};`,
      ].join('\n'),
    )

    if (shouldUpdateDb) {
      const { data: roundRow, error: loadError } = await supabase
        .from('rounds')
        .select('photo_data')
        .eq('id', row.roundId)
        .maybeSingle()
      if (loadError) throw loadError
      const nextPhotoData = Array.isArray(roundRow?.photo_data) ? [...roundRow.photo_data] : []
      nextPhotoData[row.photoIndex] = publicUrl

      const { error: updateError } = await supabase
        .from('rounds')
        .update({ photo_data: nextPhotoData })
        .eq('id', row.roundId)
      if (updateError) throw updateError
    }
  }

  await mkdir('scripts', { recursive: true })
  const sqlPath = path.join('scripts', 'round-photo-migration.sql')
  const reportPath = path.join('scripts', 'round-photo-migration-report.json')
  await writeFile(sqlPath, `${updateSql.join('\n\n')}\n`, 'utf8')
  await writeFile(reportPath, `${JSON.stringify(uploaded.map(({ base64Data, ...item }) => item), null, 2)}\n`, 'utf8')

  console.log(`Uploaded ${uploaded.length} photos.`)
  console.log(`SQL written to ${sqlPath}`)
  console.log(`Report written to ${reportPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
