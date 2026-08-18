import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/language-provider'
import { GetSettings, UpdateSettings, SetOpacity, SetWindowPinMode } from '../../../wailsjs/go/main/App'
import type { main } from '../../../wailsjs/go/models'
import StatusBanner from '../status-banner'

const countryOptions = [
  { code: 'KR', label: '대한민국', calendarId: 'ko.south_korea#holiday@group.v.calendar.google.com' },
  { code: 'US', label: '미국', calendarId: 'en.usa#holiday@group.v.calendar.google.com' },
  { code: 'GB', label: '영국', calendarId: 'en.uk#holiday@group.v.calendar.google.com' },
] as const

type PinMode = 'normal' | 'bottom' | 'top'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onChange: (code: string) => void
  weekStartsOn: 0 | 1
  onChangeWeekStartsOn: (value: 0 | 1) => void
}

export default function CalendarSettingsDialog({
  open,
  onOpenChange,
  value,
  onChange,
  weekStartsOn,
  onChangeWeekStartsOn,
}: Props) {
  const { resolvedLanguage } = useLanguage()
  const [selected, setSelected] = useState<string>(value || 'KR')
  const [selectedWeekStart, setSelectedWeekStart] = useState<'sunday' | 'monday'>(
    weekStartsOn === 1 ? 'monday' : 'sunday'
  )
  const [autoStart, setAutoStart] = useState(true)
  const [showTrayIcon, setShowTrayIcon] = useState(true)
  const [showOnTaskbar, setShowOnTaskbar] = useState(false)
  const [opacity, setOpacity] = useState(100)
  const [initialOpacity, setInitialOpacity] = useState(100)
  const [windowPinMode, setWindowPinModeState] = useState<PinMode>('normal')
  const [initialWindowPinMode, setInitialWindowPinMode] = useState<PinMode>('normal')
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelected(value || 'KR')
    setSelectedWeekStart(weekStartsOn === 1 ? 'monday' : 'sunday')
  }, [value, open, weekStartsOn])

  useEffect(() => {
    if (!open) return
    async function load() {
      setLoadingSettings(true)
      setError(null)
      try {
        const s: main.AppSettings = await GetSettings()
        setAutoStart(s.autoStart ?? true)
        setShowTrayIcon(s.showTrayIcon ?? true)
        setShowOnTaskbar(s.showOnTaskbar ?? false)
        const op = s.opacity ?? 100
        setOpacity(op)
        setInitialOpacity(op)
        const pin = (s.windowPinMode as PinMode) || 'normal'
        setWindowPinModeState(pin)
        setInitialWindowPinMode(pin)
      } catch (err: any) {
        setError(err?.message ?? String(err))
      } finally {
        setLoadingSettings(false)
      }
    }
    void load()
  }, [open])

  const title = resolvedLanguage === 'ko' ? '캘린더 설정' : 'Calendar settings'
  const desc =
    resolvedLanguage === 'ko'
      ? '공휴일 국가, 주 시작 요일, 시작 시 자동 실행 및 표시 설정을 관리하세요.'
      : 'Choose holiday country, week start, auto-launch, and display behavior.'
  const saveLabel = resolvedLanguage === 'ko' ? '저장' : 'Save'
  const weekStartLabel =
    resolvedLanguage === 'ko' ? '주 시작 요일' : 'Week starts on'
  const autoStartLabel =
    resolvedLanguage === 'ko' ? 'Windows 시작 시 자동 실행' : 'Launch at Windows startup'
  const autoStartDesc =
    resolvedLanguage === 'ko'
      ? '로그인 후 자동으로 위젯을 실행합니다.'
      : 'Start the widget automatically after you log in.'
  const trayIconLabel =
    resolvedLanguage === 'ko' ? '시스템 트레이 아이콘 표시' : 'Show system tray icon'
  const trayIconDesc =
    resolvedLanguage === 'ko'
      ? '작업 표시줄 오른쪽 알림 영역(트레이)에 캘린더 아이콘을 표시합니다.'
      : 'Show calendar icon in the Windows notification area (tray).'
  const taskbarLabel =
    resolvedLanguage === 'ko' ? '작업 표시줄에 표시' : 'Show on taskbar'
  const taskbarDesc =
    resolvedLanguage === 'ko'
      ? 'Windows 작업 표시줄에 캘린더 프로그램 버튼을 표시합니다.'
      : 'Show the calendar program button on the Windows taskbar.'

  const pinModeTitle =
    resolvedLanguage === 'ko' ? '창 위치 고정 (계층 우선순위)' : 'Window layer position'
  const pinModeDesc =
    resolvedLanguage === 'ko'
      ? '캘린더 창이 다른 프로그램들과 겹칠 때의 앞/뒤 위치를 결정합니다.'
      : 'Control whether the calendar window stays in front, normal, or in the background.'

  const pinModeOptions: { value: PinMode; label: string; desc: string }[] = [
    {
      value: 'normal',
      label: resolvedLanguage === 'ko' ? '기존처럼 유지 (기본)' : 'Normal (Default)',
      desc:
        resolvedLanguage === 'ko'
          ? '일반 창처럼 작동하며 클릭이나 포커스에 따라 자유롭게 앞/뒤로 이동합니다.'
          : 'Behaves like a regular window, moving forward or backward on focus.',
    },
    {
      value: 'bottom',
      label:
        resolvedLanguage === 'ko'
          ? '항상 창의 맨 뒤에 위치 (바탕화면 고정)'
          : 'Always on bottom (Desktop widget)',
      desc:
        resolvedLanguage === 'ko'
          ? '다른 모든 프로그램 창보다 항상 뒤에 위치하여 바탕화면 위젯처럼 사용합니다.'
          : 'Stays behind all other application windows like a desktop widget.',
    },
    {
      value: 'top',
      label:
        resolvedLanguage === 'ko' ? '항상 창의 맨 앞에 위치 (항상 위)' : 'Always on top',
      desc:
        resolvedLanguage === 'ko'
          ? '다른 어떤 창을 열어도 항상 맨 위에 캘린더를 띄워둡니다.'
          : 'Stays visible on top of all other windows.',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 overflow-y-auto pr-1">
          {error && <StatusBanner tone="error" message={error} />}
          <div className="flex flex-col gap-2">
            <Label htmlFor="country-select">
              {resolvedLanguage === 'ko' ? '공휴일 국가' : 'Holiday country'}
            </Label>
            <select
              id="country-select"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-start-toggle" className="font-semibold cursor-pointer">
                {autoStartLabel}
              </Label>
              <input
                id="auto-start-toggle"
                type="checkbox"
                className="h-4 w-4 cursor-pointer"
                checked={autoStart}
                disabled={loadingSettings}
                onChange={(e) => setAutoStart(e.target.checked)}
              />
            </div>
            <p className="text-xs text-muted-foreground">{autoStartDesc}</p>
          </div>
          <div className="flex flex-col gap-1 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="tray-icon-toggle" className="font-semibold cursor-pointer">
                {trayIconLabel}
              </Label>
              <input
                id="tray-icon-toggle"
                type="checkbox"
                className="h-4 w-4 cursor-pointer"
                checked={showTrayIcon}
                disabled={loadingSettings}
                onChange={(e) => setShowTrayIcon(e.target.checked)}
              />
            </div>
            <p className="text-xs text-muted-foreground">{trayIconDesc}</p>
          </div>
          <div className="flex flex-col gap-1 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="taskbar-toggle" className="font-semibold cursor-pointer">
                {taskbarLabel}
              </Label>
              <input
                id="taskbar-toggle"
                type="checkbox"
                className="h-4 w-4 cursor-pointer"
                checked={showOnTaskbar}
                disabled={loadingSettings}
                onChange={(e) => setShowOnTaskbar(e.target.checked)}
              />
            </div>
            <p className="text-xs text-muted-foreground">{taskbarDesc}</p>
          </div>

          {/* Window Pin Mode (Normal / Bottom / Top) */}
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">{pinModeTitle}</Label>
            </div>
            <p className="text-xs text-muted-foreground">{pinModeDesc}</p>
            <div className="grid grid-cols-1 gap-2 pt-1">
              {pinModeOptions.map((opt) => {
                const isSelected = windowPinMode === opt.value
                return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-border/60 hover:bg-accent/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="window-pin-mode"
                      value={opt.value}
                      checked={isSelected}
                      disabled={loadingSettings}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
                      onChange={() => {
                        setWindowPinModeState(opt.value)
                        void SetWindowPinMode(opt.value)
                      }}
                    />
                    <div className="flex flex-col">
                      <span className={`font-medium ${isSelected ? 'text-foreground font-semibold' : 'text-foreground'}`}>
                        {opt.label}
                      </span>
                      <span className="text-muted-foreground text-[11px] leading-snug mt-0.5">
                        {opt.desc}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="opacity-slider" className="font-semibold cursor-pointer">
                {resolvedLanguage === 'ko' ? '위젯 불투명도' : 'Widget opacity'}
              </Label>
              <span className="text-sm font-bold text-primary">{opacity}%</span>
            </div>
            <input
              id="opacity-slider"
              type="range"
              min="20"
              max="100"
              step="5"
              value={opacity}
              disabled={loadingSettings}
              className="w-full cursor-pointer accent-primary"
              onChange={(e) => {
                const val = Number(e.target.value)
                setOpacity(val)
                void SetOpacity(val)
              }}
            />
            <p className="text-xs text-muted-foreground">
              {resolvedLanguage === 'ko'
                ? '캘린더 위젯의 투명도를 조절합니다 (20% ~ 100%).'
                : 'Adjust the calendar widget transparency (20% ~ 100%).'}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="week-start-select">{weekStartLabel}</Label>
            <select
              id="week-start-select"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedWeekStart}
              onChange={(e) =>
                setSelectedWeekStart(
                  e.target.value === 'monday' ? 'monday' : 'sunday'
                )
              }
            >
              <option value="sunday">
                {resolvedLanguage === 'ko' ? '일요일' : 'Sunday'}
              </option>
              <option value="monday">
                {resolvedLanguage === 'ko' ? '월요일' : 'Monday'}
              </option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t mt-2">
          <Button
            variant="outline"
            onClick={() => {
              void SetOpacity(initialOpacity)
              void SetWindowPinMode(initialWindowPinMode)
              onOpenChange(false)
            }}
          >
            {resolvedLanguage === 'ko' ? '취소' : 'Cancel'}
          </Button>
          <Button
            disabled={loadingSettings}
            onClick={() => {
              onChange(selected)
              onChangeWeekStartsOn(selectedWeekStart === 'monday' ? 1 : 0)
              void UpdateSettings({
                autoStart,
                showTrayIcon,
                showOnTaskbar,
                opacity,
                windowPinMode,
              })
              onOpenChange(false)
            }}
          >
            {saveLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
