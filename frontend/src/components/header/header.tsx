import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { HeaderThemeToggle } from './header-theme-toggle'
import CalendarHeaderDateChevrons from '@/components/calendar/header/date/calendar-header-date-chevrons'
import CalendarHeaderActionsAdd from '@/components/calendar/header/actions/calendar-header-actions-add'
import CalendarHeaderActionsSync from '@/components/calendar/header/actions/calendar-header-actions-sync'
import { useCalendarContext } from '@/components/calendar/calendar-context'
import HeaderMenu from './header-menu'
import { useLanguage } from '../language-provider'
import AccountDialog from './account-dialog'

type Props = {
  countryCode: string
  setCountryCode: (code: string) => void
  weekStartsOn: 0 | 1
  setWeekStartsOn: (value: 0 | 1) => void
}

export default function Header({
  countryCode,
  setCountryCode,
  weekStartsOn,
  setWeekStartsOn,
}: Props) {
  const { setDate } = useCalendarContext()
  const [now, setNow] = useState(new Date())
  const { locale } = useLanguage()
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className="wails-drag grid w-full grid-cols-[1fr_auto_1fr] items-center px-4 py-3 min-h-[54px] select-none cursor-default"
      style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
    >
      <div
        className="wails-drag flex items-center h-full py-1"
        style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
      >
        <div
          onClick={() => setDate(new Date())}
          className="wails-drag text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors select-none py-1 pr-4 cursor-default"
          style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
          title="클릭 시 오늘 날짜로 이동"
        >
          {format(now, 'yyyy-MM-dd (EEE) a hh:mm', { locale })}
        </div>
      </div>
      <div
        className="wails-drag flex items-center justify-center gap-3 h-full"
        style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
      >
        <CalendarHeaderDateChevrons />
      </div>
      <div
        className="wails-drag flex items-center justify-end h-full"
        style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
      >
        <div
          className="wails-no-drag flex items-center gap-2 cursor-default"
          style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
        >
          <CalendarHeaderActionsSync
            onOpenAccountDialog={() => setAccountDialogOpen(true)}
          />
          <CalendarHeaderActionsAdd />
          <HeaderThemeToggle />
          <HeaderMenu
            countryCode={countryCode}
            setCountryCode={setCountryCode}
            weekStartsOn={weekStartsOn}
            setWeekStartsOn={setWeekStartsOn}
            onOpenAccountDialog={() => setAccountDialogOpen(true)}
          />
        </div>
      </div>
      <AccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
      />
    </div>
  )
}
