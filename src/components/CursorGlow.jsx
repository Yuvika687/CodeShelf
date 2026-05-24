import { useEffect, useRef } from 'react'

const interactiveSelector = 'a, button, [role="button"], input, textarea, select, .clickable'
const textSelector = 'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]'

export default function CursorGlow() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const pointer = useRef({ x: -100, y: -100 })
  const dot = useRef({ x: -100, y: -100 })
  const ring = useRef({ x: -100, y: -100 })
  const magnet = useRef(null)
  const isText = useRef(false)
  const raf = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return undefined

    const setVisible = () => {
      dotRef.current?.classList.add('visible')
      ringRef.current?.classList.add('visible')
    }

    const clearMagnet = () => {
      magnet.current = null
      isText.current = false
      ringRef.current?.classList.remove('is-magnetic', 'is-text')
    }

    const updateTarget = (target) => {
      const element = target instanceof Element ? target.closest(interactiveSelector) : null
      if (!element) {
        clearMagnet()
        return
      }
      magnet.current = element
      isText.current = Boolean(element.matches(textSelector))
      ringRef.current?.classList.toggle('is-text', isText.current)
      ringRef.current?.classList.toggle('is-magnetic', !isText.current)
    }

    const onPointerMove = (event) => {
      pointer.current = { x: event.clientX, y: event.clientY }
      dot.current = { x: event.clientX, y: event.clientY }
      setVisible()
      updateTarget(event.target)
      dotRef.current?.style.setProperty('transform', `translate3d(${event.clientX}px, ${event.clientY}px, 0)`)
    }

    const onPointerLeave = () => {
      dotRef.current?.classList.remove('visible')
      ringRef.current?.classList.remove('visible')
      clearMagnet()
    }

    const tick = () => {
      let targetX = pointer.current.x
      let targetY = pointer.current.y
      let strength = 0.18

      if (magnet.current && document.contains(magnet.current)) {
        const box = magnet.current.getBoundingClientRect()
        targetX = box.left + box.width / 2
        targetY = box.top + box.height / 2
        strength = isText.current ? 0.26 : 0.24
      }

      ring.current.x += (targetX - ring.current.x) * strength
      ring.current.y += (targetY - ring.current.y) * strength
      ringRef.current?.style.setProperty('transform', `translate3d(${ring.current.x}px, ${ring.current.y}px, 0)`)
      raf.current = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)
    raf.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}
