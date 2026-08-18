import React from 'react'
import {
  WindowGetPosition,
  WindowGetSize,
  WindowSetPosition,
  WindowSetSize,
} from '../../wailsjs/runtime/runtime'

export default function ResizeHandles() {
  const handlePointerDown = (direction: string) => async (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const target = e.currentTarget
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    const startScreenX = e.screenX
    const startScreenY = e.screenY

    let initialPos = { x: 0, y: 0 }
    let initialSize = { w: 890, h: 800 }

    try {
      const [pos, size] = await Promise.all([
        WindowGetPosition(),
        WindowGetSize(),
      ])
      if (pos) initialPos = pos
      if (size) initialSize = size
    } catch {
      // ignore
    }

    const minW = 500
    const minH = 400

    let lastW = initialSize.w
    let lastH = initialSize.h
    let lastX = initialPos.x
    let lastY = initialPos.y

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.screenX - startScreenX
      const dy = moveEvent.screenY - startScreenY

      let newW = initialSize.w
      let newH = initialSize.h
      let newX = initialPos.x
      let newY = initialPos.y

      if (direction.includes('right')) {
        newW = Math.max(minW, initialSize.w + dx)
      }
      if (direction.includes('bottom')) {
        newH = Math.max(minH, initialSize.h + dy)
      }
      if (direction.includes('left')) {
        const desiredW = initialSize.w - dx
        if (desiredW >= minW) {
          newW = desiredW
          newX = initialPos.x + dx
        } else {
          newW = minW
          newX = initialPos.x + (initialSize.w - minW)
        }
      }
      if (direction.includes('top')) {
        const desiredH = initialSize.h - dy
        if (desiredH >= minH) {
          newH = desiredH
          newY = initialPos.y + dy
        } else {
          newH = minH
          newY = initialPos.y + (initialSize.h - minH)
        }
      }

      lastW = newW
      lastH = newH
      lastX = newX
      lastY = newY

      WindowSetSize(newW, newH)
      if (newX !== initialPos.x || newY !== initialPos.y) {
        WindowSetPosition(newX, newY)
      }
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      target.removeEventListener('pointermove', onPointerMove)
      target.removeEventListener('pointerup', onPointerUp)
      target.removeEventListener('pointercancel', onPointerUp)
      try {
        target.releasePointerCapture(upEvent.pointerId)
      } catch {
        // ignore
      }

      try {
        const saved = localStorage.getItem('widget-position-size')
        const parsed = saved ? JSON.parse(saved) : {}
        localStorage.setItem(
          'widget-position-size',
          JSON.stringify({
            ...parsed,
            x: lastX,
            y: lastY,
            width: lastW,
            height: lastH,
          })
        )
      } catch {
        // ignore
      }
    }

    target.addEventListener('pointermove', onPointerMove)
    target.addEventListener('pointerup', onPointerUp)
    target.addEventListener('pointercancel', onPointerUp)
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 select-none overflow-hidden"
      style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
    >
      {/* Top Edge */}
      <div
        onPointerDown={handlePointerDown('top')}
        className="pointer-events-auto absolute top-0 left-4 right-4 h-2 cursor-ns-resize"
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      />
      {/* Bottom Edge */}
      <div
        onPointerDown={handlePointerDown('bottom')}
        className="pointer-events-auto absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize"
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      />
      {/* Left Edge */}
      <div
        onPointerDown={handlePointerDown('left')}
        className="pointer-events-auto absolute top-4 bottom-4 left-0 w-2 cursor-ew-resize"
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      />
      {/* Right Edge */}
      <div
        onPointerDown={handlePointerDown('right')}
        className="pointer-events-auto absolute top-4 bottom-4 right-0 w-2 cursor-ew-resize"
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      />

      {/* Top-Left Corner */}
      <div
        onPointerDown={handlePointerDown('top-left')}
        className="pointer-events-auto absolute top-0 left-0 h-4 w-4 cursor-nwse-resize"
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      />
      {/* Top-Right Corner */}
      <div
        onPointerDown={handlePointerDown('top-right')}
        className="pointer-events-auto absolute top-0 right-0 h-4 w-4 cursor-nesw-resize"
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      />
      {/* Bottom-Left Corner */}
      <div
        onPointerDown={handlePointerDown('bottom-left')}
        className="pointer-events-auto absolute bottom-0 left-0 h-4 w-4 cursor-nesw-resize"
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      />
      {/* Bottom-Right Corner */}
      <div
        onPointerDown={handlePointerDown('bottom-right')}
        className="pointer-events-auto absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
      />
    </div>
  )
}
