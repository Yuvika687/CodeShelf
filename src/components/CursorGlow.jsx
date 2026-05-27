import { useEffect, useRef } from 'react'

export default function CursorGlow() {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let w, h, dpr
    let mx = -200, my = -200
    let cx = -200, cy = -200
    let visible = false
    let hovering = false
    let clicking = false
    let textMode = false
    let trail = []
    const TRAIL_LEN = 12

    function resize() {
      dpr = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e) => {
      mx = e.clientX; my = e.clientY
      if (!visible) visible = true
    }
    const onLeave = () => { visible = false }
    const onOver = (e) => {
      const el = e.target.closest('a,button,input,textarea,select,[role="button"],.clickable')
      const isText = e.target.closest('input,textarea')
      hovering = Boolean(el && !isText)
      textMode = Boolean(isText)
    }
    const onDown = () => { clicking = true }
    const onUp = () => { clicking = false }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('mouseup', onUp)

    let animId
    function frame() {
      ctx.clearRect(0, 0, w, h)

      // Smooth follow
      cx += (mx - cx) * 0.18
      cy += (my - cy) * 0.18

      // Update trail
      trail.unshift({ x: mx, y: my })
      if (trail.length > TRAIL_LEN) trail.length = TRAIL_LEN

      if (!visible) { animId = requestAnimationFrame(frame); return }

      // --- Ambient glow ---
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 180)
      grad.addColorStop(0, 'rgba(139,92,246,0.06)')
      grad.addColorStop(0.5, 'rgba(98,213,200,0.02)')
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(mx - 200, my - 200, 400, 400)

      // --- Comet trail ---
      if (trail.length > 2) {
        for (let i = 1; i < trail.length; i++) {
          const t = 1 - i / trail.length
          const alpha = t * 0.35
          const size = t * 2.5
          ctx.beginPath()
          ctx.arc(trail[i].x, trail[i].y, size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(139,92,246,${alpha})`
          ctx.fill()
        }
      }

      // --- Outer ring ---
      const ringSize = clicking ? 14 : hovering ? 28 : 18
      const ringAlpha = hovering ? 0.6 : 0.3

      if (!textMode) {
        // Ring with gradient stroke
        ctx.beginPath()
        ctx.arc(cx, cy, ringSize, 0, Math.PI * 2)
        ctx.strokeStyle = hovering
          ? `rgba(139,92,246,${ringAlpha})`
          : `rgba(255,255,255,${ringAlpha})`
        ctx.lineWidth = hovering ? 2 : 1.5
        ctx.stroke()

        // Hover glow
        if (hovering) {
          ctx.beginPath()
          ctx.arc(cx, cy, ringSize + 4, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(139,92,246,0.12)'
          ctx.lineWidth = 6
          ctx.stroke()
        }

        // Click ripple
        if (clicking) {
          ctx.beginPath()
          ctx.arc(cx, cy, ringSize + 8, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(139,92,246,0.08)'
          ctx.fill()
        }
      } else {
        // Text cursor beam
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.fillRect(cx - 1, cy - 14, 2, 28)
      }

      // --- Center dot with glow ---
      // Outer halo
      ctx.beginPath()
      ctx.arc(mx, my, 8, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(139,92,246,0.12)'
      ctx.fill()

      // Inner dot
      ctx.beginPath()
      ctx.arc(mx, my, 3, 0, Math.PI * 2)
      const dotGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 3)
      dotGrad.addColorStop(0, '#fff')
      dotGrad.addColorStop(1, 'rgba(139,92,246,0.9)')
      ctx.fillStyle = dotGrad
      ctx.fill()

      // Bright center
      ctx.beginPath()
      ctx.arc(mx, my, 1.2, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()

      animId = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  return <canvas ref={canvasRef} className="cursor-canvas" />
}
