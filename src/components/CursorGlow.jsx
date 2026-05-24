import { useEffect, useRef } from 'react'

export default function CursorGlow() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let mx = -100, my = -100, dx = -100, dy = -100, rx = -100, ry = -100
    let visible = false

    const onMove = (e) => {
      mx = e.clientX; my = e.clientY
      if (!visible) { visible = true; dot.classList.add('visible'); ring.classList.add('visible') }
    }
    const onLeave = () => { visible = false; dot.classList.remove('visible'); ring.classList.remove('visible') }
    const onOver = (e) => {
      const el = e.target.closest('a,button,input,textarea,select,[role="button"],.clickable')
      const isText = e.target.closest('input,textarea')
      ring.classList.toggle('is-magnetic', Boolean(el && !isText))
      ring.classList.toggle('is-text', Boolean(isText))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseover', onOver)

    let id
    const loop = () => {
      dx += (mx - dx) * 0.2; dy += (my - dy) * 0.2
      rx += (mx - rx) * 0.08; ry += (my - ry) * 0.08
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
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}
