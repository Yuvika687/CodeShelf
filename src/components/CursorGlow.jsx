import { useEffect, useRef } from 'react'

/*
  Mouse-Move Fluid Effect — ultra smooth version.
  Soft organic blobs spawn from cursor movement, drift outward, and dissolve.
  No trails. Just flowing liquid energy.
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
    let pmx = -200, pmy = -200
    let smx = -200, smy = -200  // smoothed mouse
    let cx = -200, cy = -200
    let visible = false
    let hovering = false
    let clicking = false
    let textMode = false

    // Fluid blobs
    const blobs = []
    const MAX_BLOBS = 80

    // Parallax
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

      // Parallax — smooth
      const px = (mx / w - 0.5) * 2
      const py = (my / h - 0.5) * 2
      parallaxEls.forEach((el, i) => {
        const depth = (i % 3 + 1) * 0.5
        const tx = px * depth * 6
        const ty = py * depth * 4
        el.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)'
        el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`
      })
    }

    const onLeave = () => {
      visible = false
      parallaxEls.forEach(el => {
        el.style.transform = ''
        el.style.transition = 'transform .8s cubic-bezier(.2,.8,.2,1)'
      })
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

      // Ultra-smooth mouse interpolation
      smx += (mx - smx) * 0.25
      smy += (my - smy) * 0.25
      cx += (mx - cx) * 0.14
      cy += (my - cy) * 0.14

      // Velocity from smoothed coords
      const velX = smx - pmx
      const velY = smy - pmy
      const speed = Math.sqrt(velX * velX + velY * velY)

      if (!visible) { animId = requestAnimationFrame(frame); return }

      // ─── Spawn fluid blobs based on movement ───
      if (speed > 0.8 && blobs.length < MAX_BLOBS) {
        const count = Math.min(Math.ceil(speed * 0.15), 3)
        for (let i = 0; i < count; i++) {
          const angle = Math.atan2(velY, velX) + (Math.random() - 0.5) * 3.0
          const force = speed * (0.2 + Math.random() * 0.4)
          const isAccent = Math.random() > 0.6
          blobs.push({
            x: smx + (Math.random() - 0.5) * 8,
            y: smy + (Math.random() - 0.5) * 8,
            vx: Math.cos(angle) * force * 0.08,
            vy: Math.sin(angle) * force * 0.08,
            r: 12 + Math.random() * 40,
            life: 1,
            decay: 0.005 + Math.random() * 0.008, // slower decay = smoother
            hue: isAccent ? 175 : 265,
            sat: 55 + Math.random() * 25,
            lit: 50 + Math.random() * 15,
          })
        }
      }

      // ─── Render fluid blobs ───
      ctx.globalCompositeOperation = 'lighter'
      for (let i = blobs.length - 1; i >= 0; i--) {
        const b = blobs[i]
        b.x += b.vx
        b.y += b.vy
        b.vx *= 0.985  // very light friction = floaty
        b.vy *= 0.985
        b.life -= b.decay

        if (b.life <= 0) {
          blobs.splice(i, 1)
          continue
        }

        // Smooth easing for alpha — cubic ease-out
        const t = b.life
        const easedAlpha = t * t * 0.06
        const r = b.r * (0.5 + t * 0.5)

        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
        grad.addColorStop(0, `hsla(${b.hue}, ${b.sat}%, ${b.lit}%, ${easedAlpha * 2})`)
        grad.addColorStop(0.3, `hsla(${b.hue}, ${b.sat}%, ${b.lit - 5}%, ${easedAlpha * 0.8})`)
        grad.addColorStop(0.7, `hsla(${b.hue}, ${b.sat}%, ${b.lit - 10}%, ${easedAlpha * 0.2})`)
        grad.addColorStop(1, `hsla(${b.hue}, ${b.sat}%, ${b.lit - 15}%, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      // ─── Ambient glow under cursor ───
      const glowR = hovering ? 90 : 60
      const ambGrad = ctx.createRadialGradient(smx, smy, 0, smx, smy, glowR)
      ambGrad.addColorStop(0, 'rgba(139,92,246,0.035)')
      ambGrad.addColorStop(0.5, 'rgba(98,213,200,0.01)')
      ambGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = ambGrad
      ctx.fillRect(smx - glowR, smy - glowR, glowR * 2, glowR * 2)

      // ─── Cursor ring — smooth follow ───
      const targetRing = clicking ? 5 : hovering ? 14 : 9
      const ringAlpha = hovering ? 0.45 : 0.2

      if (!textMode) {
        ctx.beginPath()
        ctx.arc(cx, cy, targetRing, 0, Math.PI * 2)
        ctx.strokeStyle = hovering
          ? `rgba(139,92,246,${ringAlpha})`
          : `rgba(255,255,255,${ringAlpha})`
        ctx.lineWidth = hovering ? 1.5 : 0.8
        ctx.stroke()

        if (hovering) {
          ctx.beginPath()
          ctx.arc(cx, cy, targetRing + 3, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(139,92,246,0.06)'
          ctx.lineWidth = 3
          ctx.stroke()
        }

        if (clicking) {
          ctx.beginPath()
          ctx.arc(cx, cy, targetRing + 5, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(139,92,246,0.05)'
          ctx.fill()
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.fillRect(cx - 0.5, cy - 9, 1, 18)
      }

      // ─── Center dot — ultra tiny ───
      ctx.beginPath()
      ctx.arc(smx, smy, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(139,92,246,0.05)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(smx, smy, 1.5, 0, Math.PI * 2)
      const dotGrad = ctx.createRadialGradient(smx, smy, 0, smx, smy, 1.5)
      dotGrad.addColorStop(0, 'rgba(255,255,255,0.95)')
      dotGrad.addColorStop(1, 'rgba(139,92,246,0.7)')
      ctx.fillStyle = dotGrad
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
      parallaxEls.forEach(el => { el.style.transform = ''; el.style.transition = '' })
    }
  }, [])

  return <canvas ref={canvasRef} className="cursor-canvas" />
}
