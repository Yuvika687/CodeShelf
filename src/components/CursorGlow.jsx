import { useEffect, useState } from 'react'

export default function CursorGlow() {
  const [point, setPoint] = useState({ x: -100, y: -100 })

  useEffect(() => {
    const handleMove = (event) => setPoint({ x: event.clientX, y: event.clientY })
    window.addEventListener('pointermove', handleMove)
    return () => window.removeEventListener('pointermove', handleMove)
  }, [])

  return (
    <>
      <div className="cursor-dot" style={{ transform: `translate3d(${point.x}px, ${point.y}px, 0)` }} />
      <div className="cursor-ring" style={{ transform: `translate3d(${point.x}px, ${point.y}px, 0)` }} />
    </>
  )
}
