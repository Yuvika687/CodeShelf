import { useEffect, useRef } from 'react'

/*
  Mouse-Move Fluid Effect — NOT a trail.
  Simulates soft fluid blobs that spawn, drift, and dissolve around the cursor.
  Mouse velocity creates flowing, organic distortion. Parallax shifts bg elements.
*/

export default function CursorGlow() {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let w, h, dpr
    let mx = -200, my = -200
    let pmx = -200, pmy = -200   // previous mouse for velocity
    let cx = -200, cy = -200
    let visible = false
    let hovering = false
    let clicking = false
    let textMode = false
    let time = 0

    // ─── Fluid blobs: spawn from mouse, float away, fade out ───
    const blobs = []
    const MAX_BLOBS = 60

    // ─── Parallax ───
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
      pmx = mx; pmy = my
      mx = e.clientX; my = e.clientY
      if (!visible) visible = true

      // Parallax
      const px = (mx / w - 0.5) * 2
      const py = (my / h - 0.5) * 2
      parallaxEls.forEach((el, i) => {
        const depth = (i % 3 + 1) * 0.6
        const tx = px * depth * 8
        const ty = py * depth * 5
        el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`
      })

      // Spawn fluid blobs based on velocity
      const velX = mx - pmx
      const velY = my - pmy
      const speed = Math.sqrt(velX * velX + velY * velY)

      if (speed > 1.5 && blobs.length < MAX_BLOBS) {
        const count = Math.min(Math.ceil(speed * 0.2), 4)
        for (let i = 0; i < count; i++) {
          const angle = Math.atan2(velY, velX) + (Math.random() - 0.5) * 2.5
          const force = speed * (0.3 + Math.random() * 0.5)
          const hue = Math.random() > 0.5 ? 265 : 175 // purple or teal
          blobs.push({
            x: mx + (Math.random() - 0.5) * 10,
            y: my + (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * force * 0.15,
            vy: Math.sin(angle) * force * 0.15,
            r: 8 + Math.random() * 28,     // blob radius
            life: 1,                         // fades from 1 → 0
            decay: 0.008 + Math.random() * 0.012,
            hue,
            sat: 60 + Math.random() * 20,
          })
        }
      }
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

      // Smooth follow for ring
      cx += (mx - cx) * 0.18
      cy += (my - cy) * 0.18

      if (!visible) { animId = requestAnimationFrame(frame); return }

      // ─── FLUID BLOBS — the main effect ───
      ctx.globalCompositeOperation = 'lighter'
      for (let i = blobs.length - 1; i >= 0; i--) {
        const b = blobs[i]
        b.x += b.vx
        b.y += b.vy
        b.vx *= 0.97  // friction
        b.vy *= 0.97
        b.life -= b.decay

        if (b.life <= 0) {
          blobs.splice(i, 1)
          continue
        }

        const alpha = b.life * 0.08
        const r = b.r * (0.6 + b.life * 0.4) // shrink as fading

        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
        grad.addColorStop(0, `hsla(${b.hue}, ${b.sat}%, 60%, ${alpha * 1.5})`)
        grad.addColorStop(0.4, `hsla(${b.hue}, ${b.sat}%, 50%, ${alpha * 0.6})`)
        grad.addColorStop(1, `hsla(${b.hue}, ${b.sat}%, 40%, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      // ─── Ambient glow under cursor ───
      const glowR = hovering ? 100 : 70
      const ambGrad = ctx.createRadialGradient(mx, my, 0, mx, my, glowR)
      ambGrad.addColorStop(0, 'rgba(139,92,246,0.04)')
      ambGrad.addColorStop(0.4, 'rgba(98,213,200,0.012)')
      ambGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = ambGrad
      ctx.fillRect(mx - glowR, my - glowR, glowR * 2, glowR * 2)

      // ─── Cursor ring (small) ───
      const ringSize = clicking ? 6 : hovering ? 16 : 10
      const ringAlpha = hovering ? 0.5 : 0.22

      if (!textMode) {
        ctx.beginPath()
        ctx.arc(cx, cy, ringSize, 0, Math.PI * 2)
        ctx.strokeStyle = hovering
          ? `rgba(139,92,246,${ringAlpha})`
          : `rgba(255,255,255,${ringAlpha})`
        ctx.lineWidth = hovering ? 1.5 : 1
        ctx.stroke()

        if (hovering) {
          ctx.beginPath()
          ctx.arc(cx, cy, ringSize + 3, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(139,92,246,0.08)'
          ctx.lineWidth = 4
          ctx.stroke()
        }

        if (clicking) {
          ctx.beginPath()
          ctx.arc(cx, cy, ringSize + 5, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(139,92,246,0.06)'
          ctx.fill()
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillRect(cx - 0.6, cy - 10, 1.2, 20)
      }

      // ─── Center dot (tiny) ───
      ctx.beginPath()
      ctx.arc(mx, my, 4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(139,92,246,0.07)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(mx, my, 1.8, 0, Math.PI * 2)
      const dotGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 1.8)
      dotGrad.addColorStop(0, '#fff')
      dotGrad.addColorStop(1, 'rgba(139,92,246,0.85)')
      ctx.fillStyle = dotGrad
      ctx.fill()

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
