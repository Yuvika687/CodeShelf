import { useEffect, useRef } from 'react'

export default function CursorGlow() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const pos = useRef({ x: -100, y: -100 })
  const delayedPos = useRef({ x: -100, y: -100 })
  const frameRef = useRef()

  useEffect(() => {
    const handleMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`
      }
    }
    window.addEventListener('pointermove', handleMove)

    const updateRing = () => {
      const dx = pos.current.x - delayedPos.current.x
      const dy = pos.current.y - delayedPos.current.y
      
      delayedPos.current.x += dx * 0.15
      delayedPos.current.y += dy * 0.15

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${delayedPos.current.x}px, ${delayedPos.current.y}px, 0)`
      }
      frameRef.current = requestAnimationFrame(updateRing)
    }
    frameRef.current = requestAnimationFrame(updateRing)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}

