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
    let vx = 0, vy = 0
    let visible = false
    let hovering = false
    let clicking = false
    let textMode = false
    let trail = []
    const TRAIL_LEN = 28
    let time = 0

    // Parallax targets
    let parallaxEls = []
    function collectParallaxTargets() {
      parallaxEls = Array.from(document.querySelectorAll(
        '.cmd-brain, .wk-orb, .login-orb, .pro-avatar-zone, .nebula-canvas, .login-bg, .cmd-scan, .wk-mid'
      ))
    }
    collectParallaxTargets()
    const pObserver = new MutationObserver(() => setTimeout(collectParallaxTargets, 200))
    pObserver.observe(document.body, { childList: true, subtree: true })

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

      // Apply parallax to page elements
      const px = (mx / w - 0.5) * 2
      const py = (my / h - 0.5) * 2
      parallaxEls.forEach((el, i) => {
        const depth = (i % 3 + 1) * 0.6
        const tx = px * depth * 8
        const ty = py * depth * 5
        el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`
      })
    }
    const onLeave = () => {
      visible = false
      parallaxEls.forEach(el => { el.style.transform = '' })
    }
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
      time += 0.016

      // Velocity
      const dx = mx - cx, dy = my - cy
      vx = dx * 0.2
      vy = dy * 0.2
      cx += vx
      cy += vy
      const speed = Math.sqrt(vx * vx + vy * vy)

      // Trail
      trail.unshift({ x: mx, y: my, vx, vy })
      if (trail.length > TRAIL_LEN) trail.length = TRAIL_LEN

      if (!visible) { animId = requestAnimationFrame(frame); return }

      // ─── Fluid ribbon trail ───
      if (trail.length > 3 && speed > 0.5) {
        ctx.beginPath()
        ctx.moveTo(trail[0].x, trail[0].y)
        for (let i = 1; i < trail.length - 1; i++) {
          const xc = (trail[i].x + trail[i + 1].x) / 2
          const yc = (trail[i].y + trail[i + 1].y) / 2
          ctx.quadraticCurveTo(trail[i].x, trail[i].y, xc, yc)
        }
        const ribbonWidth = Math.min(speed * 0.15, 3)
        ctx.lineWidth = ribbonWidth
        const grad = ctx.createLinearGradient(trail[0].x, trail[0].y, trail[trail.length - 1].x, trail[trail.length - 1].y)
        grad.addColorStop(0, 'rgba(139,92,246,0.35)')
        grad.addColorStop(0.5, 'rgba(98,213,200,0.15)')
        grad.addColorStop(1, 'rgba(139,92,246,0)')
        ctx.strokeStyle = grad
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()
      }

      // ─── Fluid particles along trail ───
      if (speed > 2) {
        const count = Math.min(Math.floor(speed * 0.3), 5)
        for (let i = 0; i < count; i++) {
          const t = Math.random()
          const idx = Math.floor(t * Math.min(trail.length - 1, 8))
          const pt = trail[idx]
          if (!pt) continue
          const scatter = speed * 0.6
          const px = pt.x + (Math.random() - 0.5) * scatter
          const py = pt.y + (Math.random() - 0.5) * scatter
          const alpha = (1 - t) * 0.4
          const size = (1 - t) * 1.5 + 0.3
          ctx.beginPath()
          ctx.arc(px, py, size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(139,92,246,${alpha})`
          ctx.fill()
        }
      }

      // ─── Ambient glow (subtle) ───
      const glowR = hovering ? 120 : 90
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, glowR)
      grad.addColorStop(0, 'rgba(139,92,246,0.04)')
      grad.addColorStop(0.4, 'rgba(98,213,200,0.015)')
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(mx - glowR, my - glowR, glowR * 2, glowR * 2)

      // ─── Outer ring (small & tight) ───
      const ringSize = clicking ? 6 : hovering ? 16 : 10
      const ringAlpha = hovering ? 0.55 : 0.25

      if (!textMode) {
        ctx.beginPath()
        ctx.arc(cx, cy, ringSize, 0, Math.PI * 2)
        const ringColor = hovering
          ? `rgba(139,92,246,${ringAlpha})`
          : `rgba(255,255,255,${ringAlpha})`
        ctx.strokeStyle = ringColor
        ctx.lineWidth = hovering ? 1.5 : 1
        ctx.stroke()

        // Hover magnetic glow
        if (hovering) {
          ctx.beginPath()
          ctx.arc(cx, cy, ringSize + 3, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(139,92,246,0.08)'
          ctx.lineWidth = 4
          ctx.stroke()
        }

        // Click ripple
        if (clicking) {
          ctx.beginPath()
          ctx.arc(cx, cy, ringSize + 5, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(139,92,246,0.06)'
          ctx.fill()
        }
      } else {
        // Text cursor — thin beam
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillRect(cx - 0.6, cy - 10, 1.2, 20)
      }

      // ─── Center dot (tiny & precise) ───
      // Subtle halo
      ctx.beginPath()
      ctx.arc(mx, my, 4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(139,92,246,0.08)'
      ctx.fill()

      // Core dot
      ctx.beginPath()
      ctx.arc(mx, my, 1.8, 0, Math.PI * 2)
      const dotGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 1.8)
      dotGrad.addColorStop(0, '#fff')
      dotGrad.addColorStop(1, 'rgba(139,92,246,0.85)')
      ctx.fillStyle = dotGrad
      ctx.fill()

      // Hot pixel center
      ctx.beginPath()
      ctx.arc(mx, my, 0.7, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()

      animId = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(animId)
      pObserver.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('mouseup', onUp)
      parallaxEls.forEach(el => { el.style.transform = '' })
    }
  }, [])

  return <canvas ref={canvasRef} className="cursor-canvas" />
}
