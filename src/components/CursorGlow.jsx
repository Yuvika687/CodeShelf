import { useEffect, useState, useRef } from 'react'

export default function CursorGlow() {
  const [point, setPoint] = useState({ x: -100, y: -100 })
  const ringRef = useRef({ x: -100, y: -100 })
  const requestRef = useRef()

  useEffect(() => {
    const handleMove = (event) => setPoint({ x: event.clientX, y: event.clientY })
    window.addEventListener('pointermove', handleMove)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      cancelAnimationFrame(requestRef.current)
    }
  }, [])

  useEffect(() => {
    const updateRing = () => {
      const dx = point.x - ringRef.current.x
      const dy = point.y - ringRef.current.y
      
      // Dynamic lag factor (0.15 lerp rate) creates beautiful inertia on rapid mouse movements
      ringRef.current.x += dx * 0.15
      ringRef.current.y += dy * 0.15

      const ringEl = document.getElementById('cursor-ring-el')
      if (ringEl) {
        ringEl.style.transform = `translate3d(${ringRef.current.x}px, ${ringRef.current.y}px, 0)`
      }
      requestRef.current = requestAnimationFrame(updateRing)
    }

    requestRef.current = requestAnimationFrame(updateRing)
  }, [point])

  return (
    <>
      <div className="cursor-dot" style={{ transform: `translate3d(${point.x}px, ${point.y}px, 0)` }} />
      <div id="cursor-ring-el" className="cursor-ring" />
    </>
  )
}

