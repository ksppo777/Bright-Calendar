import { useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useLanguage } from '@/components/language-provider'
import { useCalendarContext } from '../../calendar-context'
import { colorOptions } from '../../calendar-tailwind-classes'
import { CalendarEvent as CalendarEventType } from '../../calendar-types'

const colorHexMap = Object.fromEntries(colorOptions.map((c) => [c.value, c.hex]))

interface EventSegment {
  event: CalendarEventType
  startCol: number // 0 to 6
  endCol: number // 0 to 6
  span: number // 1 to 7
  isStart: boolean
  isEnd: boolean
  isMultiDay: boolean
}

export default function CalendarBodyMonth() {
  const {
    date,
    events,
    setDate,
    setSelectedEvent,
    setManageEventDialogOpen,
    setDayEventsModalOpen,
    weekStartsOn,
    setNewEventDialogOpen,
  } = useCalendarContext()
  const { resolvedLanguage } = useLanguage()

  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn })

  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [calendarStart.getTime(), calendarEnd.getTime()]
  )

  const weeks = useMemo(() => {
    const rows: Date[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7))
    }
    return rows
  }, [calendarDays])

  const today = new Date()
  const MAX_VISIBLE_SLOTS = 3

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden select-none">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-border divide-x divide-border shrink-0 bg-background/50">
        {(() => {
          const base =
            resolvedLanguage === 'ko'
              ? ['일', '월', '화', '수', '목', '금', '토']
              : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          return weekStartsOn === 1
            ? [...base.slice(1), base[0]]
            : base
        })().map((day, idx) => (
          <div
            key={day}
            className={cn(
              'py-2 text-center text-xs font-semibold text-muted-foreground select-none',
              (weekStartsOn === 0 && (idx === 0 || idx === 6)) ||
              (weekStartsOn === 1 && (idx === 5 || idx === 6))
                ? 'text-foreground/80'
                : ''
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Weeks Container */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={monthStart.toISOString()}
          className="flex flex-col flex-1 h-full min-h-0 divide-y divide-border overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
        >
          {weeks.map((weekDays, weekIndex) => {
            const wStart = startOfDay(weekDays[0])
            const wEnd = endOfDay(weekDays[6])

            // 1. Find all events overlapping this week
            const weekEvents = events.filter((ev) => {
              const eStart = startOfDay(ev.start)
              const eEnd = endOfDay(ev.end)
              return eStart <= wEnd && eEnd >= wStart
            })

            // 2. Build segments for this week
            const segments: EventSegment[] = weekEvents.map((ev) => {
              const eStart = startOfDay(ev.start)
              const eEnd = endOfDay(ev.end)
              const startCol = eStart < wStart ? 0 : differenceInCalendarDays(eStart, wStart)
              const endCol = eEnd > wEnd ? 6 : differenceInCalendarDays(eEnd, wStart)
              const span = Math.max(1, endCol - startCol + 1)
              const isStart = isSameDay(eStart, weekDays[startCol])
              const isEnd = isSameDay(eEnd, weekDays[endCol])
              const totalDays = differenceInCalendarDays(eEnd, eStart)
              const isMultiDay = totalDays >= 1 || ev.allDay

              return {
                event: ev,
                startCol,
                endCol,
                span,
                isStart,
                isEnd,
                isMultiDay,
              }
            })

            // 3. Sort segments: multi-day first, longer span first, earlier start date first
            segments.sort((a, b) => {
              if (a.isMultiDay !== b.isMultiDay) {
                return a.isMultiDay ? -1 : 1
              }
              if (a.span !== b.span) {
                return b.span - a.span
              }
              const startDiff = a.event.start.getTime() - b.event.start.getTime()
              if (startDiff !== 0) return startDiff
              return a.event.title.localeCompare(b.event.title)
            })

            // 4. Pack segments into non-overlapping horizontal tracks (slots)
            const slots: (EventSegment | null)[][] = []
            segments.forEach((seg) => {
              let placed = false
              for (let s = 0; s < slots.length; s++) {
                let canFit = true
                for (let col = seg.startCol; col <= seg.endCol; col++) {
                  if (slots[s][col] !== null) {
                    canFit = false
                    break
                  }
                }
                if (canFit) {
                  for (let col = seg.startCol; col <= seg.endCol; col++) {
                    slots[s][col] = seg
                  }
                  placed = true
                  break
                }
              }
              if (!placed) {
                const newSlot: (EventSegment | null)[] = new Array(7).fill(null)
                for (let col = seg.startCol; col <= seg.endCol; col++) {
                  newSlot[col] = seg
                }
                slots.push(newSlot)
              }
            })

            // 5. Count total events per column to calculate "+N more"
            const colEventCounts = new Array(7).fill(0)
            segments.forEach((seg) => {
              for (let col = seg.startCol; col <= seg.endCol; col++) {
                colEventCounts[col]++
              }
            })

            // Unique segments to render per slot (only first appearance in slot)
            const visibleSlots = slots.slice(0, MAX_VISIBLE_SLOTS)

            return (
              <div
                key={`week-${weekDays[0].toISOString()}`}
                className="relative flex-1 min-h-[70px] overflow-hidden"
              >
                {/* Background Day Cells Grid */}
                <div className="absolute inset-0 grid grid-cols-7 divide-x divide-border">
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, today)
                    const isCurrentMonth = isSameMonth(day, date)
                    const isSelected = isSameDay(day, date)

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          'relative flex flex-col p-1 h-full cursor-pointer transition-colors hover:bg-accent/20',
                          !isCurrentMonth && 'bg-muted/40 text-muted-foreground/60'
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDate(day)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setDate(day)
                          setNewEventDialogOpen(true)
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full select-none',
                              isToday && 'bg-primary text-primary-foreground font-bold shadow-xs',
                              !isToday && isSelected && 'border border-primary font-semibold',
                              !isToday && !isSelected && 'text-foreground/90'
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Event Segments Layer */}
                <div className="relative z-10 pt-7 px-1 flex flex-col gap-[3px] pointer-events-none h-full overflow-hidden">
                  {visibleSlots.map((slot, slotIdx) => {
                    // Extract unique segments in this slot row
                    const rowSegments: EventSegment[] = []
                    const seen = new Set<string>()
                    slot.forEach((seg) => {
                      if (seg && !seen.has(seg.event.id)) {
                        seen.add(seg.event.id)
                        rowSegments.push(seg)
                      }
                    })

                    return (
                      <div
                        key={`slot-${weekIndex}-${slotIdx}`}
                        className="grid grid-cols-7 gap-x-1 h-[20px] pointer-events-auto"
                      >
                        {rowSegments.map((seg) => {
                          const isBar = seg.isMultiDay || seg.event.allDay
                          const colorHex =
                            colorHexMap[seg.event.color as keyof typeof colorHexMap] ??
                            '#039be5'

                          const timeFormatted =
                            !seg.isMultiDay && !seg.event.allDay
                              ? format(seg.event.start, 'HH:mm')
                              : ''

                          return (
                            <div
                              key={`${seg.event.id}-${weekIndex}-${seg.startCol}`}
                              style={{
                                gridColumnStart: seg.startCol + 1,
                                gridColumnEnd: `span ${seg.span}`,
                                backgroundColor: isBar ? colorHex : undefined,
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedEvent(seg.event)
                                setManageEventDialogOpen(true)
                              }}
                              title={`${seg.event.title} (${format(seg.event.start, 'yyyy-MM-dd')} ~ ${format(seg.event.end, 'yyyy-MM-dd')})`}
                              className={cn(
                                'group relative flex items-center h-[20px] px-1.5 text-xs cursor-pointer select-none transition-all truncate',
                                isBar
                                  ? cn(
                                      'text-white font-medium shadow-2xs hover:brightness-110 active:brightness-95',
                                      seg.isStart ? 'rounded-l-md ml-0.5' : 'rounded-l-none ml-0',
                                      seg.isEnd ? 'rounded-r-md mr-0.5' : 'rounded-r-none mr-0'
                                    )
                                  : 'text-foreground font-medium hover:bg-accent/60 active:bg-accent/80 rounded-md border border-border/80 mx-0.5 bg-background/80'
                              )}
                            >
                              {!isBar && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0 mr-1.5"
                                  style={{ backgroundColor: colorHex }}
                                  aria-hidden
                                />
                              )}
                              {timeFormatted && (
                                <span className="text-[10px] text-muted-foreground mr-1 shrink-0 font-normal">
                                  {timeFormatted}
                                </span>
                              )}
                              <span className="truncate leading-tight text-[11px]">
                                {seg.event.title}
                              </span>
                              {seg.event.syncStatus === 'conflict' && (
                                <span className="ml-1 rounded-full bg-destructive text-white px-1 text-[9px] font-bold shrink-0">
                                  !
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  {/* "+N more" Row if there are overflow events */}
                  {slots.length > MAX_VISIBLE_SLOTS && (
                    <div className="grid grid-cols-7 gap-x-1 h-[16px] pointer-events-auto">
                      {weekDays.map((day, colIdx) => {
                        const count = colEventCounts[colIdx]
                        if (count <= MAX_VISIBLE_SLOTS) {
                          return <div key={`more-empty-${colIdx}`} />
                        }
                        const extra = count - MAX_VISIBLE_SLOTS
                        return (
                          <div
                            key={`more-${colIdx}`}
                            className="flex items-center px-1"
                          >
                            <button
                              type="button"
                              className="text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer truncate"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDate(day)
                                setDayEventsModalOpen(true)
                              }}
                            >
                              {resolvedLanguage === 'ko' ? `+${extra}개 더보기` : `+${extra} more`}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
