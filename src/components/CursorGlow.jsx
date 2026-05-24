import { useEffect, useRef } from 'react'

export default function CursorGlow() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const trailRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    const dot = dotRef.current
    const ring = ringRef.current
    const trailCanvas = trailRef.current
    if (!dot || !ring || !trailCanvas) return

    const ctx = trailCanvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let mx = -100, my = -100, dx = -100, dy = -100, rx = -100, ry = -100
    let visible = false
    let hue = 265
    const trail = []
    const MAX_TRAIL = 28

    function resize() {
      trailCanvas.width = window.innerWidth * dpr
      trailCanvas.height = window.innerHeight * dpr
      trailCanvas.style.width = window.innerWidth + 'px'
      trailCanvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    function onMove(e) {
      mx = e.clientX
      my = e.clientY
      if (!visible) {
        visible = true
        dot.classList.add('visible')
        ring.classList.add('visible')
        trailCanvas.style.opacity = '1'
      }
      trail.push({ x: mx, y: my, age: 0 })
      if (trail.length > MAX_TRAIL) trail.shift()
    }

    function onLeave() {
      visible = false
      dot.classList.remove('visible')
      ring.classList.remove('visible')
      trailCanvas.style.opacity = '0'
    }

    function onOver(e) {
      const el = e.target.closest('a, button, input, textarea, select, [role="button"], .clickable')
      const isText = e.target.closest('input, textarea')
      ring.classList.toggle('is-magnetic', Boolean(el && !isText))
      ring.classList.toggle('is-text', Boolean(isText))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseover', onOver)

    let animId
    function loop() {
      // Smooth follow
      dx += (mx - dx) * 0.18
      dy += (my - dy) * 0.18
      rx += (mx - rx) * 0.1
      ry += (my - ry) * 0.1

      // Color cycling
      hue += 0.15
      if (hue > 360) hue -= 360
      const color = hue < 200 ? `hsl(${hue}, 80%, 72%)` : `hsl(${hue}, 70%, 68%)`

      dot.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      dot.style.boxShadow = `0 0 8px 2px hsla(${hue},80%,65%,.45), 0 0 20px 4px hsla(${hue},80%,55%,.18)`
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      ring.style.borderColor = `hsla(${hue}, 60%, 70%, 0.55)`

      // Trail
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (let i = 0; i < trail.length; i++) {
        trail[i].age++
        const t = trail[i]
        const life = 1 - (t.age / 35)
        if (life <= 0) continue
        const r = life * 2.8
        ctx.beginPath()
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${(hue + i * 4) % 360}, 75%, 68%, ${life * 0.45})`
        ctx.fill()
        // Outer glow
        ctx.beginPath()
        ctx.arc(t.x, t.y, r * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${(hue + i * 4) % 360}, 75%, 68%, ${life * 0.08})`
        ctx.fill()
      }
      // Remove dead particles
      while (trail.length > 0 && trail[0].age > 34) trail.shift()

      animId = requestAnimationFrame(loop)
    }

    loop()

    return () => {
      cancelAnimationFrame(animId)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseover', onOver)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <canvas ref={trailRef} className="cursor-trail" />
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}
