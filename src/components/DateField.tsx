import { Platform, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useRef, useState } from 'react'
import DateTimePicker from '@react-native-community/datetimepicker'
import { C } from '../theme'

// "YYYY-MM-DD" 문자열 <-> Date 변환 (로컬 타임존 기준)
function parse(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}
function format(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 오늘 날짜 (로컬 타임존 기준 "YYYY-MM-DD")
export function todayLocal(): string {
  return format(new Date())
}

export default function DateField({
  value, onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [show, setShow] = useState(false)

  // ── 웹: HTML date input, 어디를 눌러도 캘린더가 열림 ──
  if (Platform.OS === 'web') {
    return (
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        onClick={() => ref.current?.showPicker?.()}
        style={webStyle}
      />
    )
  }

  // ── 모바일: 누르면 네이티브 캘린더 ──
  return (
    <>
      <TouchableOpacity style={s.input} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Text style={s.inputText}>{value}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={parse(value)}
          mode="date"
          display="calendar"
          onChange={(_, selected) => {
            setShow(false)
            if (selected) onChange(format(selected))
          }}
        />
      )}
    </>
  )
}

const webStyle = {
  borderWidth: 1.5,
  borderStyle: 'solid' as const,
  borderColor: C.border,
  borderRadius: 10,
  paddingTop: 13,
  paddingBottom: 13,
  paddingLeft: 14,
  paddingRight: 14,
  fontSize: 17,
  color: C.text,
  backgroundColor: C.bg,
  width: '100%',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

const s = StyleSheet.create({
  input: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: C.bg,
  },
  inputText: { fontSize: 17, color: C.text },
})
