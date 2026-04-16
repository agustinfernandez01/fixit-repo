export type BatteryIntervalPresetKey = 'lt80' | '81_84' | '85_87' | '88_90' | '91_94' | '95_100'

export type BatteryIntervalPreset = {
  key: BatteryIntervalPresetKey
  label: string
  min: number
  max: number
}

export const BATTERY_INTERVAL_PRESETS: BatteryIntervalPreset[] = [
  { key: 'lt80', label: '<80', min: 0, max: 80 },
  { key: '81_84', label: '81-84', min: 81, max: 84 },
  { key: '85_87', label: '85-87', min: 85, max: 87 },
  { key: '88_90', label: '88-90', min: 88, max: 90 },
  { key: '91_94', label: '91-94', min: 91, max: 94 },
  { key: '95_100', label: '95-100', min: 95, max: 100 },
]

export function getBatteryIntervalByKey(key: BatteryIntervalPresetKey): BatteryIntervalPreset {
  return BATTERY_INTERVAL_PRESETS.find((preset) => preset.key === key) ?? BATTERY_INTERVAL_PRESETS[0]
}

export function getBatteryIntervalPresetKey(min: number, max: number): BatteryIntervalPresetKey | 'custom' {
  const preset = BATTERY_INTERVAL_PRESETS.find((item) => item.min === min && item.max === max)
  return preset ? preset.key : 'custom'
}

export function getBatteryIntervalLabel(min: number, max: number): string {
  const preset = BATTERY_INTERVAL_PRESETS.find((item) => item.min === min && item.max === max)
  return preset ? preset.label : `${min}-${max}`
}

export function parseBatteryIntervalValue(value: string): { min: number; max: number } | null {
  const [minStr, maxStr] = value.split('|')
  const min = Number(minStr)
  const max = Number(maxStr)
  if (!Number.isInteger(min) || !Number.isInteger(max)) return null
  if (min < 0 || max > 100 || min > max) return null
  return { min, max }
}

export function intervalValue(min: number, max: number): string {
  return `${min}|${max}`
}
