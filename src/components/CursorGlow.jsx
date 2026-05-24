import { useEffect, useRef } from 'react'

export default function CursorGlow() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const glowRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const dot = dotRef.current
    const ring = ringRef.current
    const glow = glowRef.current
    if (!dot || !ring || !glow) return

    let mx = -100, my = -100
    let dx = -100, dy = -100
    let rx = -100, ry = -100
    let visible = false
    let isClicking = false

    const onMove = (e) => {
      mx = e.clientX; my = e.clientY
      // Update the glow background position
      glow.style.background = `radial-gradient(600px circle at ${mx}px ${my}px, rgba(139, 92, 246, .06), transparent 40%)`
      if (!visible) {
        visible = true
        dot.classList.add('visible')
        ring.classList.add('visible')
      }
    }

    const onLeave = () => {
      visible = false
      dot.classList.remove('visible')
      ring.classList.remove('visible')
    }

    const onOver = (e) => {
      const el = e.target.closest('a,button,input,textarea,select,[role="button"],.clickable')
      const isText = e.target.closest('input,textarea')
      ring.classList.toggle('is-magnetic', Boolean(el && !isText))
      ring.classList.toggle('is-text', Boolean(isText))
    }

    const onDown = () => {
      isClicking = true
      ring.classList.add('is-clicking')
    }

    const onUp = () => {
      isClicking = false
      ring.classList.remove('is-clicking')
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('mouseup', onUp)

    let id
    const loop = () => {
      // Dot follows instantly with slight smoothing
      dx += (mx - dx) * 0.25
      dy += (my - dy) * 0.25
      // Ring follows with more delay
      rx += (mx - rx) * 0.1
      ry += (my - ry) * 0.1
      dot.style.transform = `translate3d(${dx}px,${dy}px,0)`
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`
      id = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <>
      <div ref={glowRef} className="cursor-glow-bg" />
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}
