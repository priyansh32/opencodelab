const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

export const nowISO = (): string => new Date().toISOString()

export const formatTimestamp = (value: string | undefined): string => {
  if (value == null || value === '') {
    return 'Unknown'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return dateTimeFormatter.format(date)
}
