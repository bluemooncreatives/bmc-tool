export const SUPPORTED_LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Spanish', value: 'es' },
  { label: 'Portuguese', value: 'pt' },
  { label: 'Russian', value: 'ru' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Korean', value: 'ko' },
  { label: 'Chinese', value: 'zh' },
] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['value']

export function isSupportedLanguage(
  value: unknown
): value is SupportedLanguage {
  return (
    typeof value === 'string' &&
    SUPPORTED_LANGUAGES.some((language) => language.value === value)
  )
}

/** Validates a local calendar date without applying a timezone conversion. */
export function isValidDateOfBirth(value: string, today = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1900) return false
  const parsed = new Date(year, month - 1, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return false
  }
  const latest = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )
  return parsed <= latest
}

export function dateOnlyToLocalDate(value: string): Date | undefined {
  if (!value || !isValidDateOfBirth(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function localDateToDateOnly(value: Date | undefined): string {
  if (!value) return ''
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-')
}
