import { Button } from '@/components/ui/button'
import { useCalendarContext } from '../../calendar-context'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { useLanguage } from '@/components/language-provider'

export default function CalendarHeaderDateChevrons() {
  const { date, setDate } = useCalendarContext()
  const { locale, resolvedLanguage } = useLanguage()

  function handleDateBackward() {
    setDate(subMonths(date, 1))
  }

  function handleDateForward() {
    setDate(addMonths(date, 1))
  }

  return (
    <div
      className="wails-drag flex items-center gap-2 select-none"
      style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
    >
      <Button
        variant="outline"
        className="wails-no-drag h-7 w-7 p-1 cursor-pointer"
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
        onClick={handleDateBackward}
      >
        <ChevronLeft className="min-w-5 min-h-5" />
      </Button>

      <span
        className="wails-drag min-w-[150px] py-1 text-center font-medium select-none cursor-default"
        style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
      >
        {resolvedLanguage === 'ko'
          ? format(date, 'yyyy년 M월 d일', { locale })
          : format(date, 'MMMM d, yyyy', { locale })}
      </span>

      <Button
        variant="outline"
        className="wails-no-drag h-7 w-7 p-1 cursor-pointer"
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
        onClick={handleDateForward}
      >
        <ChevronRight className="min-w-5 min-h-5" />
      </Button>
    </div>
  )
}
