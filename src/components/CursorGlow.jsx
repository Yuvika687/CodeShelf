import { useEffect, useRef } from 'react'

export default function CursorGlow() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const pos = useRef({ x: -100, y: -100 })
  const smooth = useRef({ x: -100, y: -100 })
  const raf = useRef()

  useEffect(() => {
    const onMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const tick = () => {
      const dx = pos.current.x - smooth.current.x
      const dy = pos.current.y - smooth.current.y
      smooth.current.x += dx * 0.12
      smooth.current.y += dy * 0.12
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${smooth.current.x}px, ${smooth.current.y}px, 0)`
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onMove)
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
