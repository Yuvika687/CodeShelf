import { useEffect, useRef } from 'react'

export default function NebulaParticles({ className = '', starCount = 90, nebulaCount = 3 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId, w, h
    const dpr = window.devicePixelRatio || 1
    const stars = []
    const clouds = []

    function resize() {
      const parent = canvas.parentElement
      w = parent.offsetWidth
      h = parent.offsetHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function seed() {
      stars.length = 0
      clouds.length = 0
      const hues = [265, 175, 220, 0]
      for (let i = 0; i < starCount; i++) {
        const isColored = Math.random() > 0.45
        stars.push({
          x: Math.random() * w, y: Math.random() * h,
          r: Math.random() * 1.6 + 0.3,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.018 + 0.004,
          hue: isColored ? hues[Math.floor(Math.random() * 3)] : 0,
          sat: isColored ? 72 : 0,
          lit: Math.random() * 25 + 65,
        })
      }
      for (let i = 0; i < nebulaCount; i++) {
        clouds.push({
          x: Math.random() * w, y: Math.random() * h,
          radius: Math.random() * 200 + 80,
          vx: (Math.random() - 0.5) * 0.06,
          vy: (Math.random() - 0.5) * 0.06,
          hue: [265, 175, 220][i % 3],
          alpha: Math.random() * 0.035 + 0.015,
        })
      }
    }

    resize()
    seed()
    window.addEventListener('resize', () => { resize(); seed() })

    function frame() {
      ctx.clearRect(0, 0, w, h)

      clouds.forEach(c => {
        c.x += c.vx; c.y += c.vy
        if (c.x < -c.radius) c.x = w + c.radius
        if (c.x > w + c.radius) c.x = -c.radius
        if (c.y < -c.radius) c.y = h + c.radius
        if (c.y > h + c.radius) c.y = -c.radius
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius)
        g.addColorStop(0, `hsla(${c.hue},80%,50%,${c.alpha})`)
        g.addColorStop(1, `hsla(${c.hue},80%,50%,0)`)
        ctx.fillStyle = g
        ctx.fillRect(c.x - c.radius, c.y - c.radius, c.radius * 2, c.radius * 2)
      })

      stars.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.phase += s.speed
        if (s.x < 0) s.x = w; if (s.x > w) s.x = 0
        if (s.y < 0) s.y = h; if (s.y > h) s.y = 0
        const twinkle = 0.5 + 0.5 * Math.sin(s.phase)
        const a = 0.25 + twinkle * 0.55
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${s.hue},${s.sat}%,${s.lit}%,${a})`
        ctx.fill()
        if (s.r > 1) {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${s.hue},${s.sat}%,${s.lit}%,${a * 0.12})`
          ctx.fill()
        }
      })

      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x
          const dy = stars[i].y - stars[j].y
          const d = dx * dx + dy * dy
          if (d < 14400) {
            ctx.beginPath()
            ctx.moveTo(stars[i].x, stars[i].y)
            ctx.lineTo(stars[j].x, stars[j].y)
            ctx.strokeStyle = `hsla(265,50%,60%,${0.06 * (1 - Math.sqrt(d) / 120)})`
            ctx.lineWidth = 0.4
            ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(frame)
    }

    frame()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [starCount, nebulaCount])

  return <canvas ref={canvasRef} className={`nebula-canvas ${className}`} />
}
