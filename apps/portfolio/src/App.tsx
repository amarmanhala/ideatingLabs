import { useEffect, useRef, useState } from 'react'
import './App.css'

type Point = { x: number; y: number }
type BallKind = 'github' | 'story' | 'notes' | 'things' | 'x' | 'email'

type Ball = Point & {
  vx: number
  vy: number
  radius: number
  mass: number
  rotationX: number
  rotationY: number
  kind: BallKind
}

type Palette = {
  background: string
  foreground: string
  name: string
}

type AudioControls = {
  start: () => Promise<boolean>
  stop: () => void
}

const BALL_LINKS: Partial<Record<BallKind, string>> = {
  github: 'https://github.com/amarmanhala',
  x: 'https://x.com/amarsinghca?s=11',
  email: 'mailto:amar.manhala@gmail.com',
}

const BALL_LABELS: Partial<Record<BallKind, string>> = {
  github: 'GitHub',
  things: 'Things',
  x: 'X',
  email: 'Email',
}

const PALETTES: Palette[] = [
  { background: '#00452f', foreground: '#ffe85a', name: 'forest + sun' },
  { background: '#f3f3f2', foreground: '#df4500', name: 'paper + ember' },
  { background: '#a9bff3', foreground: '#111515', name: 'sky + ink' },
  { background: '#111515', foreground: '#ffe85a', name: 'night + sun' },
  { background: '#df4500', foreground: '#f6f5f3', name: 'ember + paper' },
  { background: '#ffe85a', foreground: '#00452f', name: 'sun + forest' },
]

const STORY_LINES = Array.from(
  { length: 11 },
  () => 'Amarpreet Engineer Designer',
)
const STORY_BAND_OFFSETS = STORY_LINES.map(() => Math.random() * Math.PI * 2)
const GITHUB_ICON_PATH = 'M9.356 1.85C5.05 1.85 1.57 5.356 1.57 9.694a7.84 7.84 0 0 0 5.324 7.44c.387.079.528-.168.528-.376 0-.182-.013-.805-.013-1.454-2.165.467-2.616-.935-2.616-.935-.349-.91-.864-1.143-.864-1.143-.71-.48.051-.48.051-.48.787.051 1.2.805 1.2.805.695 1.194 1.817.857 2.268.649.064-.507.27-.857.49-1.052-1.728-.182-3.545-.857-3.545-3.87 0-.857.31-1.558.8-2.104-.078-.195-.349-1 .077-2.078 0 0 .657-.208 2.14.805a7.5 7.5 0 0 1 1.946-.26c.657 0 1.328.092 1.946.26 1.483-1.013 2.14-.805 2.14-.805.426 1.078.155 1.883.078 2.078.502.546.799 1.247.799 2.104 0 3.013-1.818 3.675-3.558 3.87.284.247.528.714.528 1.454 0 1.052-.012 1.896-.012 2.156 0 .208.142.455.528.377a7.84 7.84 0 0 0 5.324-7.441c.013-4.338-3.48-7.844-7.773-7.844'
const GITHUB_ICON_POSITIONS = [
  { latitude: -0.38, longitude: 0 },
  { latitude: -0.38, longitude: Math.PI / 2 },
  { latitude: -0.38, longitude: Math.PI },
  { latitude: -0.38, longitude: -Math.PI / 2 },
  { latitude: 0.38, longitude: Math.PI / 4 },
  { latitude: 0.38, longitude: Math.PI * 0.75 },
  { latitude: 0.38, longitude: -Math.PI * 0.75 },
  { latitude: 0.38, longitude: -Math.PI / 4 },
]
const isSocialGlobe = (kind: BallKind) =>
  kind === 'github' || kind === 'x' || kind === 'email'

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const colorToRgb = (color: string) => {
  if (color.startsWith('#')) {
    const value = Number.parseInt(color.slice(1), 16)
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    }
  }
  const channels = color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]
  return { r: channels[0] ?? 0, g: channels[1] ?? 0, b: channels[2] ?? 0 }
}

const mixColor = (from: string, to: string, amount: number) => {
  const a = colorToRgb(from)
  const b = colorToRgb(to)
  const mix = (start: number, end: number) => Math.round(start + (end - start) * amount)
  return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`
}

const syncBrowserTheme = (background: string) => {
  const currentThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const nextThemeColor = document.createElement('meta')

  nextThemeColor.name = 'theme-color'
  nextThemeColor.content = background

  if (currentThemeColor) {
    currentThemeColor.replaceWith(nextThemeColor)
  } else {
    document.head.append(nextThemeColor)
  }

  document.documentElement.style.backgroundColor = background
  document.body.style.backgroundColor = background
}

const createSilentAudioUrl = () => {
  const sampleRate = 8000
  const sampleCount = sampleRate / 4
  const dataLength = sampleCount * 2
  const wav = new ArrayBuffer(44 + dataLength)
  const view = new DataView(wav)
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, dataLength, true)

  return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
}

function VintageCasioWatch() {
  const braceletLinks = Array.from({ length: 7 }, (_, index) => index)

  return (
    <svg
      className="vintage-watch"
      viewBox="0 0 360 640"
      role="img"
      aria-labelledby="watch-title watch-description"
    >
      <title id="watch-title">Vintage silver Casio digital watch</title>
      <desc id="watch-description">
        A stainless steel digital Casio watch with a rectangular black face and silver bracelet.
      </desc>
      <defs>
        <linearGradient id="watch-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8e9497" />
          <stop offset="0.18" stopColor="#eef0ef" />
          <stop offset="0.5" stopColor="#aeb3b5" />
          <stop offset="0.82" stopColor="#f7f8f7" />
          <stop offset="1" stopColor="#858b8e" />
        </linearGradient>
        <linearGradient id="watch-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8d0bd" />
          <stop offset="1" stopColor="#aeb9a6" />
        </linearGradient>
        <filter id="watch-shadow" x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="13" floodColor="#000" floodOpacity="0.2" />
        </filter>
      </defs>

      <g fill="url(#watch-steel)" stroke="#747a7d" strokeWidth="2">
        <path d="M126 12h108l-10 190h-88L126 12Z" />
        <path d="M136 438h88l10 190H126l10-190Z" />
        {braceletLinks.map((link) => (
          <g key={`top-${link}`}>
            <path d={`M${132 + link} ${28 + link * 23}h${96 - link * 2}l-2 17h-${92 - link * 2}Z`} />
            <line x1="180" y1={30 + link * 23} x2="180" y2={43 + link * 23} opacity="0.45" />
          </g>
        ))}
        {braceletLinks.map((link) => (
          <g key={`bottom-${link}`}>
            <path d={`M${138 - link} ${457 + link * 23}h${84 + link * 2}l2 17h-${88 + link * 2}Z`} />
            <line x1="180" y1={460 + link * 23} x2="180" y2={473 + link * 23} opacity="0.45" />
          </g>
        ))}
      </g>

      <g filter="url(#watch-shadow)">
        <path
          d="M102 176c4-18 18-29 37-29h82c19 0 33 11 37 29l17 45v174l-17 45c-4 18-18 29-37 29h-82c-19 0-33-11-37-29l-17-45V221l17-45Z"
          fill="url(#watch-steel)"
          stroke="#656a6d"
          strokeWidth="3"
        />
        <rect x="105" y="187" width="150" height="238" rx="12" fill="#17191a" stroke="#5d6264" strokeWidth="3" />
        <text x="180" y="214" fill="#f2f2ef" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="700" textAnchor="middle" letterSpacing="2">CASIO</text>
        <text x="180" y="233" fill="#bfc4c4" fontFamily="Arial, sans-serif" fontSize="7" textAnchor="middle" letterSpacing="1.5">ALARM CHRONOGRAPH</text>
        <rect x="121" y="249" width="118" height="93" rx="4" fill="url(#watch-screen)" stroke="#676d68" strokeWidth="4" />
        <text x="132" y="271" fill="#202521" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700">SU</text>
        <text x="226" y="271" fill="#202521" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" textAnchor="end">16</text>
        <text x="180" y="320" fill="#171b18" fontFamily="monospace" fontSize="50" fontWeight="700" textAnchor="middle" letterSpacing="-4">10:58</text>
        <text x="180" y="367" fill="#e6e7e3" fontFamily="Arial, sans-serif" fontSize="8" textAnchor="middle" letterSpacing="1.8">WATER RESIST</text>
        <circle cx="116" cy="390" r="4" fill="#d04b3d" />
        <text x="180" y="397" fill="#aeb3b3" fontFamily="Arial, sans-serif" fontSize="7" textAnchor="middle" letterSpacing="1.2">LIGHT · MODE · START</text>
      </g>
    </svg>
  )
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioControlsRef = useRef<AudioControls | null>(null)
  const soundEnabledRef = useRef(true)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [thingsOpen, setThingsOpen] = useState(false)

  useEffect(() => {
    syncBrowserTheme(thingsOpen ? '#ffffff' : PALETTES[paletteIndex].background)
    if (!thingsOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setThingsOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [paletteIndex, thingsOpen])

  const toggleSound = () => {
    const enabled = !soundEnabledRef.current
    soundEnabledRef.current = enabled
    setSoundEnabled(enabled)
    if (enabled) {
      void audioControlsRef.current?.start()
    } else {
      audioControlsRef.current?.stop()
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return
    const githubIcon = new Path2D(GITHUB_ICON_PATH)

    let frame = 0
    let width = window.innerWidth
    let height = window.innerHeight
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let lastTime = performance.now()
    let palette = 0
    let previousPalette = 0
    let paletteChangedAt = -1000
    let audioContext: AudioContext | null = null
    let mediaUnlock: HTMLAudioElement | null = null
    let mediaUnlockUrl: string | null = null
    let balls: Ball[] = []
    let draggedBall: Ball | null = null
    let pointer: Point = { x: 0, y: 0 }
    let pointerIsInside = false
    let pointerOffset: Point = { x: 0, y: 0 }
    let pointerDownAt = 0
    let pointerDownPoint: Point = { x: 0, y: 0 }
    let pointerHistory: Array<Point & { time: number }> = []
    let lastImpactAt = 0
    let lastSoundAt = 0
    let initialized = false
    let tooltipBall: Ball | null = null
    let tooltipOpacity = 0
    let deformations = new Map<Ball, { amount: number; angle: number }>()
    let activeBallContacts = new Set<string>()
    const lastBallImpactAt = new Map<string, number>()
    const clickBounces = new Map<Ball, number>()

    const createBalls = () => {
      const small = clamp(Math.min(width * 0.085, height * 0.13), 62, 142)
      const medium = small * 1.18
      const large = clamp(Math.min(width * 0.15, height * 0.23), 120, 238)
      const floor = height - Math.max(18, height * 0.026)
      const left = Math.max(small + 20, width * 0.105)
      const center = width < 720 ? width * 0.5 : width * 0.31
      const notes = width < 720 ? width * 0.76 : width * 0.555
      const things = width < 720 ? width * 0.18 : width * 0.66
      const rightA = width < 720 ? width * 0.72 : width * 0.74
      const rightB = width < 720 ? width * 0.84 : width * 0.91

      balls = [
        {
          kind: 'github', x: left, y: floor - small, vx: 0, vy: 0,
          radius: small, mass: small * small, rotationX: -0.18, rotationY: 0,
        },
        {
          kind: 'story', x: center, y: floor - large, vx: 0, vy: 0,
          radius: large, mass: large * large * 1.18, rotationX: -0.12, rotationY: 0.2,
        },
        {
          kind: 'notes', x: notes, y: floor - medium, vx: 0, vy: 0,
          radius: medium, mass: medium * medium, rotationX: 0, rotationY: 0,
        },
        {
          kind: 'things', x: things, y: floor - small * 3, vx: 0, vy: 0,
          radius: small, mass: small * small, rotationX: 0, rotationY: 0,
        },
        {
          kind: 'x', x: rightA, y: floor - small, vx: 0, vy: 0,
          radius: small, mass: small * small, rotationX: 0, rotationY: 0,
        },
        {
          kind: 'email', x: rightB, y: floor - small, vx: 0, vy: 0,
          radius: small, mass: small * small, rotationX: 0, rotationY: 0,
        },
      ]
      deformations = new Map(
        balls.map((ball) => [ball, { amount: 0, angle: 0 }]),
      )

      if (width < 720) {
        balls[0].x = width * 0.18
        balls[0].y = floor - small
        balls[1].x = width * 0.48
        balls[1].y = floor - large * 1.02
        balls[2].x = width * 0.76
        balls[2].y = floor - medium * 3.1
        balls[3].x = width * 0.18
        balls[3].y = floor - small * 4.7
        balls[4].x = width * 0.73
        balls[4].y = floor - small * 1.92
        balls[5].x = width * 0.83
        balls[5].y = floor - small * 0.82
      }

      for (let pass = 0; pass < 8; pass += 1) {
        for (let i = 0; i < balls.length; i += 1) {
          for (let j = i + 1; j < balls.length; j += 1) {
            const a = balls[i]
            const b = balls[j]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const distance = Math.hypot(dx, dy) || 1
            const overlap = a.radius + b.radius - distance
            if (overlap > 0) {
              const nx = dx / distance
              const ny = dy / distance
              a.x -= nx * overlap * 0.5
              a.y -= ny * overlap * 0.5
              b.x += nx * overlap * 0.5
              b.y += ny * overlap * 0.5
            }
          }
        }
      }
    }

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!initialized) {
        createBalls()
        initialized = true
      } else {
        balls.forEach((ball) => {
          ball.x = clamp(ball.x, ball.radius, width - ball.radius)
          ball.y = clamp(ball.y, ball.radius, height - ball.radius)
        })
      }
    }

    const ensureAudio = (): Promise<boolean> => {
      if (!soundEnabledRef.current) return Promise.resolve(false)

      if (!mediaUnlock) {
        mediaUnlockUrl = createSilentAudioUrl()
        mediaUnlock = new Audio(mediaUnlockUrl)
        mediaUnlock.loop = true
        mediaUnlock.preload = 'auto'
        mediaUnlock.setAttribute('playsinline', '')
      }
      const mediaReady = mediaUnlock.play().catch(() => undefined)

      if (!audioContext) {
        const AudioContextConstructor = window.AudioContext ||
          (window as typeof window & {
            webkitAudioContext?: typeof AudioContext
          }).webkitAudioContext
        if (!AudioContextConstructor) return Promise.resolve(false)
        audioContext = new AudioContextConstructor()
      }

      if (audioContext.state === 'closed') return Promise.resolve(false)

      // iOS Safari will often create a suspended context until audio is
      // started inside the same user gesture. A silent source unlocks the
      // output route without adding an audible click.
      const unlockSource = audioContext.createBufferSource()
      unlockSource.buffer = audioContext.createBuffer(
        1,
        1,
        audioContext.sampleRate,
      )
      unlockSource.connect(audioContext.destination)
      unlockSource.start(0)

      if (audioContext.state === 'running') {
        return mediaReady.then(() => true)
      }

      const contextToResume = audioContext
      const contextReady = contextToResume.resume()
        .then(() => true)
        .catch(() => false)

      return Promise.all([mediaReady, contextReady])
        .then(([, resumed]) => {
          return resumed && contextToResume.state === 'running'
        })
    }

    const playImpact = (strength: number) => {
      if (!soundEnabledRef.current || !audioContext || audioContext.state !== 'running') return
      const now = audioContext.currentTime
      const volume = clamp(strength / 1800, 0.018, 0.12)
      const hardness = 0.98 + Math.random() * 0.04
      const master = audioContext.createGain()
      const compressor = audioContext.createDynamicsCompressor()
      master.gain.value = 1
      compressor.threshold.value = -18
      compressor.knee.value = 7
      compressor.ratio.value = 5
      compressor.attack.value = 0.001
      compressor.release.value = 0.05
      master.connect(compressor).connect(audioContext.destination)

      // A round, two-ball "clack": less attack and less high-frequency energy
      // than the sharp crack produced by a cue tip striking the cue ball.
      const resonances = [
        { frequency: 480, level: 0.56, decay: 0.052, wave: 'triangle' as OscillatorType },
        { frequency: 910, level: 0.32, decay: 0.034, wave: 'sine' as OscillatorType },
        { frequency: 1580, level: 0.12, decay: 0.018, wave: 'sine' as OscillatorType },
      ]
      resonances.forEach(({ frequency, level, decay, wave }) => {
        const oscillator = audioContext!.createOscillator()
        const gain = audioContext!.createGain()
        oscillator.type = wave
        oscillator.frequency.setValueAtTime(frequency * hardness, now)
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * hardness * 0.965,
          now + decay,
        )
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(volume * level, now + 0.0024)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay)
        oscillator.connect(gain).connect(master)
        oscillator.start(now)
        oscillator.stop(now + decay + 0.008)
      })

    }

    const stopAudio = () => {
      if (mediaUnlock) mediaUnlock.pause()
      if (audioContext?.state === 'running') void audioContext.suspend()
    }

    audioControlsRef.current = { start: ensureAudio, stop: stopAudio }

    const registerImpact = (strength: number, isBallCollision = false) => {
      const now = performance.now()
      if (strength < 80) return
      if (isBallCollision && now - lastSoundAt > 55) {
        lastSoundAt = now
        playImpact(strength)
      }
      if (now - lastImpactAt < 1250) return
      lastImpactAt = now
      previousPalette = palette
      const nextPalette = (palette + 1) % PALETTES.length
      syncBrowserTheme(PALETTES[nextPalette].background)
      palette = nextPalette
      paletteChangedAt = now
      setPaletteIndex(palette)
    }

    const drawSphere = (
      ball: Ball,
      foreground: string,
      background: string,
      palettePulse: number,
      now: number,
    ) => {
      const { x, y, radius } = ball
      const deformation = deformations.get(ball) ?? { amount: 0, angle: 0 }
      const clickStartedAt = clickBounces.get(ball)
      let depthScale = 1
      if (clickStartedAt !== undefined) {
        const elapsed = (now - clickStartedAt) / 1000
        if (elapsed > 1.25) {
          clickBounces.delete(ball)
        } else {
          depthScale += Math.sin(elapsed * 20) * Math.exp(-elapsed * 4.4) * 0.11
        }
      }
      context.save()
      context.translate(x, y)
      context.rotate(deformation.angle)
      context.scale(
        1 - deformation.amount,
        1 + deformation.amount * 0.62,
      )
      context.rotate(-deformation.angle)
      context.scale(palettePulse * depthScale, palettePulse * depthScale)
      context.beginPath()
      context.arc(0, 0, radius, 0, Math.PI * 2)
      context.clip()

      const socialGlobe = isSocialGlobe(ball.kind)
      const isGlobe = ball.kind === 'story' || socialGlobe
      const baseColor = ball.kind === 'story' ? background : foreground
      if (isGlobe) {
        const highlight = socialGlobe ? 0.055 : 0.018
        const midShadow = socialGlobe ? 0.025 : 0.011
        const edgeShadow = socialGlobe ? 0.075 : 0.028
        const body = context.createRadialGradient(
          -radius * 0.38,
          -radius * 0.46,
          radius * 0.035,
          radius * 0.08,
          radius * 0.08,
          radius * 1.08,
        )
        body.addColorStop(0, mixColor(baseColor, '#ffffff', highlight))
        body.addColorStop(0.42, baseColor)
        body.addColorStop(0.78, mixColor(baseColor, '#000000', midShadow))
        body.addColorStop(1, mixColor(baseColor, '#000000', edgeShadow))
        context.fillStyle = body
      } else {
        context.fillStyle = foreground
      }
      context.fillRect(-radius, -radius, radius * 2, radius * 2)
      context.fillStyle = ball.kind === 'story' ? foreground : background
      context.textAlign = 'center'
      context.textBaseline = 'middle'

      const drawSocialGlobeIcons = (drawIcon: () => void) => {
        const cosY = Math.cos(ball.rotationY)
        const sinY = Math.sin(ball.rotationY)
        const cosX = Math.cos(ball.rotationX)
        const sinX = Math.sin(ball.rotationX)
        const iconScale = radius * 0.86 / 19

        GITHUB_ICON_POSITIONS.forEach(({ latitude, longitude }) => {
          const latitudeCurve = Math.cos(latitude)
          const sinLatitude = Math.sin(latitude)
          const sinLongitude = Math.sin(longitude)
          const cosLongitude = Math.cos(longitude)

          const localX = latitudeCurve * sinLongitude
          const localY = sinLatitude
          const localZ = latitudeCurve * cosLongitude
          const xAfterY = localX * cosY + localZ * sinY
          const zAfterY = -localX * sinY + localZ * cosY
          const yAfterX = localY * cosX - zAfterY * sinX
          const zAfterX = localY * sinX + zAfterY * cosX
          if (zAfterX <= 0.025) return

          const eastX = cosLongitude
          const eastY = 0
          const eastZ = -sinLongitude
          const eastXAfterY = eastX * cosY + eastZ * sinY
          const eastZAfterY = -eastX * sinY + eastZ * cosY
          const eastYAfterX = eastY * cosX - eastZAfterY * sinX

          const northX = -sinLatitude * sinLongitude
          const northY = latitudeCurve
          const northZ = -sinLatitude * cosLongitude
          const northXAfterY = northX * cosY + northZ * sinY
          const northZAfterY = -northX * sinY + northZ * cosY
          const northYAfterX = northY * cosX - northZAfterY * sinX

          context.save()
          context.translate(xAfterY * radius, yAfterX * radius)
          context.transform(
            eastXAfterY * iconScale,
            eastYAfterX * iconScale,
            northXAfterY * iconScale,
            northYAfterX * iconScale,
            0,
            0,
          )
          context.translate(-9.5, -9.5)
          context.globalAlpha = 1
          drawIcon()
          context.restore()
        })
      }

      if (ball.kind === 'github') {
        drawSocialGlobeIcons(() => {
          context.fillStyle = background
          context.fill(githubIcon, 'evenodd')
        })
        context.globalAlpha = 1
      } else if (ball.kind === 'x') {
        drawSocialGlobeIcons(() => {
          context.fillStyle = background
          context.font = '300 17px Arial, sans-serif'
          context.fillText('𝕏', 9.5, 9.8)
        })
        context.globalAlpha = 1
      } else if (ball.kind === 'notes') {
        const iconSize = radius * 0.34
        const iconLeft = -iconSize * 0.5
        const iconTop = -radius * 0.63
        context.save()
        context.strokeStyle = background
        context.lineWidth = radius * 0.035
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.beginPath()
        context.roundRect(iconLeft, iconTop, iconSize, iconSize, radius * 0.035)
        context.stroke()
        ;[0.35, 0.56, 0.77].forEach((line, index) => {
          context.beginPath()
          context.moveTo(iconLeft + iconSize * 0.2, iconTop + iconSize * line)
          context.lineTo(
            iconLeft + iconSize * (index === 2 ? 0.62 : 0.8),
            iconTop + iconSize * line,
          )
          context.stroke()
        })
        context.restore()

        context.fillStyle = background
        context.font = `400 ${radius * 0.32}px Arial, sans-serif`
        context.fillText('notes', 0, radius * 0.04)
        context.font = `500 ${radius * 0.11}px Arial, sans-serif`
        context.fillText('project', 0, radius * 0.34)
      } else if (ball.kind === 'things') {
        context.fillStyle = background
        context.font = `600 ${radius * 0.25}px Arial, sans-serif`
        context.fillText('things', 0, -radius * 0.025)
        context.font = `500 ${radius * 0.1}px Arial, sans-serif`
        context.fillText('collection', 0, radius * 0.25)
      } else if (ball.kind === 'email') {
        drawSocialGlobeIcons(() => {
          context.strokeStyle = background
          context.lineWidth = 1.7
          context.lineCap = 'round'
          context.lineJoin = 'round'
          context.beginPath()
          context.roundRect(2.2, 4.2, 14.6, 10.6, 1.8)
          context.moveTo(3.3, 5.2)
          context.lineTo(9.5, 10.1)
          context.lineTo(15.7, 5.2)
          context.stroke()
        })
        context.globalAlpha = 1
      } else {
        context.fillStyle = foreground
        STORY_LINES.forEach((line, index) => {
          const latitudeStep = Math.PI / (STORY_LINES.length + 1.4)
          const latitude = (index - (STORY_LINES.length - 1) / 2) * latitudeStep
          const latitudeCurve = Math.cos(latitude)
          const ringRadius = latitudeCurve * radius
          const fontSize = radius * (0.12 + latitudeCurve * 0.12)
          context.font = `700 ${fontSize}px Arial, sans-serif`
          const letterSpacing = fontSize * 0.07
          const separator = '  '
          const source = `${line}${separator}`
          const sourceWidth = [...source].reduce(
            (width, character) => width + context.measureText(character).width + letterSpacing,
            0,
          )
          const circumference = Math.PI * 2 * Math.max(ringRadius, 1)
          const repeatCount = Math.max(2, Math.ceil(circumference / Math.max(sourceWidth, 1)) + 1)
          const characters = [...source.repeat(repeatCount)]
          const widths = characters.map(
            (character) => context.measureText(character).width + letterSpacing,
          )
          let cursor = 0

          characters.forEach((character, characterIndex) => {
            const characterWidth = widths[characterIndex]
            const distanceAlongRing = cursor + characterWidth * 0.5
            cursor += characterWidth
            if (distanceAlongRing > circumference) return
            const baseLongitude =
              (distanceAlongRing / Math.max(circumference, 1)) * Math.PI * 2 - Math.PI
            const bandOffset = STORY_BAND_OFFSETS[index]
            const longitude = Math.atan2(
              Math.sin(baseLongitude + bandOffset),
              Math.cos(baseLongitude + bandOffset),
            )

            const localX = latitudeCurve * Math.sin(longitude)
            const localY = Math.sin(latitude)
            const localZ = latitudeCurve * Math.cos(longitude)
            const tangentX = latitudeCurve * Math.cos(longitude)
            const tangentY = 0
            const tangentZ = -latitudeCurve * Math.sin(longitude)

            const cosY = Math.cos(ball.rotationY)
            const sinY = Math.sin(ball.rotationY)
            const xAfterY = localX * cosY + localZ * sinY
            const zAfterY = -localX * sinY + localZ * cosY
            const tangentXAfterY = tangentX * cosY + tangentZ * sinY
            const tangentZAfterY = -tangentX * sinY + tangentZ * cosY
            const cosX = Math.cos(ball.rotationX)
            const sinX = Math.sin(ball.rotationX)
            const yAfterX = localY * cosX - zAfterY * sinX
            const zAfterX = localY * sinX + zAfterY * cosX
            const tangentYAfterX = tangentY * cosX - tangentZAfterY * sinX

            if (zAfterX <= 0.025) return
            const surfaceDepth = Math.max(0.06, zAfterX)
            const tangentAngle = Math.atan2(tangentYAfterX, tangentXAfterY)
            context.save()
            context.translate(xAfterY * radius, yAfterX * radius)
            context.rotate(tangentAngle)
            context.scale(surfaceDepth ** 0.72, 0.9 + surfaceDepth * 0.1)
            context.globalAlpha = surfaceDepth ** 0.62
            context.fillText(character, 0, 0)
            context.restore()
          })
        })
        context.globalAlpha = 1
      }

      if (isGlobe) {
        const edgeOpacity = socialGlobe ? 0.095 : 0.025
        const specularOpacity = socialGlobe ? 0.07 : 0.025
        const edgeFalloff = context.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius)
        edgeFalloff.addColorStop(0, 'rgba(0,0,0,0)')
        edgeFalloff.addColorStop(0.76, 'rgba(0,0,0,0.015)')
        edgeFalloff.addColorStop(1, `rgba(0,0,0,${edgeOpacity})`)
        context.fillStyle = edgeFalloff
        context.fillRect(-radius, -radius, radius * 2, radius * 2)

        const specular = context.createRadialGradient(
          -radius * 0.42,
          -radius * 0.5,
          0,
          -radius * 0.4,
          -radius * 0.48,
          radius * 0.55,
        )
        specular.addColorStop(0, `rgba(255,255,255,${specularOpacity})`)
        specular.addColorStop(1, 'rgba(255,255,255,0)')
        context.fillStyle = specular
        context.fillRect(-radius, -radius, radius * 2, radius * 2)
      }
      context.restore()
    }

    const drawTooltip = (
      ball: Ball,
      label: string,
      foreground: string,
      background: string,
      opacity: number,
    ) => {
      context.save()
      context.globalAlpha = opacity
      context.font = '600 12px Arial, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const paddingX = 13
      const tooltipHeight = 30
      const tooltipWidth = context.measureText(label).width + paddingX * 2
      const tooltipX = clamp(
        ball.x,
        tooltipWidth * 0.5 + 10,
        width - tooltipWidth * 0.5 - 10,
      )
      const preferredY = ball.y - ball.radius - 18 - tooltipHeight * 0.5
      const tooltipY = preferredY < 12
        ? ball.y + ball.radius + 18 + tooltipHeight * 0.5
        : preferredY

      context.fillStyle = foreground
      context.beginPath()
      context.roundRect(
        tooltipX - tooltipWidth * 0.5,
        tooltipY - tooltipHeight * 0.5,
        tooltipWidth,
        tooltipHeight,
        tooltipHeight * 0.5,
      )
      context.fill()
      context.fillStyle = background
      context.fillText(label, tooltipX, tooltipY + 0.5)
      context.restore()
    }

    const render = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.025)
      lastTime = now
      const transition = clamp((now - paletteChangedAt) / 1200, 0, 1)
      const ease = transition * transition * (3 - 2 * transition)
      const palettePulse = 1 + Math.sin(transition * Math.PI) * 0.014
      const ballBackground = mixColor(
        PALETTES[previousPalette].background, PALETTES[palette].background, ease,
      )
      const foreground = mixColor(
        PALETTES[previousPalette].foreground, PALETTES[palette].foreground, ease,
      )

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      context.fillStyle = PALETTES[palette].background
      context.fillRect(0, 0, width, height)

      const steps = 3
      const step = delta / steps
      const ambientTime = now / 1000
      const contactsThisFrame = new Set<string>()
      for (let simulationStep = 0; simulationStep < steps; simulationStep += 1) {
        balls.forEach((ball, ballIndex) => {
          const deformation = deformations.get(ball)
          if (deformation) {
            deformation.amount *= Math.pow(0.78, step * 60)
            if (deformation.amount < 0.002) deformation.amount = 0
          }
          if (isSocialGlobe(ball.kind)) ball.rotationY += step * 0.18
          if (ball === draggedBall) {
            const targetX = clamp(
              pointer.x - pointerOffset.x,
              ball.radius,
              width - ball.radius,
            )
            const targetY = clamp(
              pointer.y - pointerOffset.y,
              ball.radius,
              height - ball.radius,
            )
            const moveX = (targetX - ball.x) * 0.58
            const moveY = (targetY - ball.y) * 0.58
            ball.x += moveX
            ball.y += moveY
            if (ball.kind === 'story' || isSocialGlobe(ball.kind)) {
              ball.rotationY += moveX / Math.max(ball.radius, 1)
              ball.rotationX -= moveY / Math.max(ball.radius, 1)
            }
            ball.vx = 0
            ball.vy = 0
            return
          }
          const speed = Math.hypot(ball.vx, ball.vy)
          const ambientInfluence = clamp(1 - speed / 140, 0, 1)
          const driftAcceleration = Math.sin(
            ambientTime * 0.55 + ballIndex * 1.7,
          ) * 22
          ball.vx += driftAcceleration * ambientInfluence * step
          ball.vy += 620 * step
          const moveX = ball.vx * step
          const moveY = ball.vy * step
          ball.x += moveX
          ball.y += moveY
          if (ball.kind === 'story' || isSocialGlobe(ball.kind)) {
            ball.rotationY += moveX / Math.max(ball.radius, 1)
            ball.rotationX -= moveY / Math.max(ball.radius, 1)
          }
          ball.vx *= Math.pow(0.994, step * 60)
          ball.vy *= Math.pow(0.996, step * 60)

          let wallImpact = 0
          if (ball.x < ball.radius) {
            wallImpact = Math.abs(ball.vx)
            ball.x = ball.radius
            ball.vx = Math.abs(ball.vx) * 0.78
            const deformation = deformations.get(ball)
            if (deformation) {
              deformation.amount = Math.max(deformation.amount, clamp(0.035 + wallImpact / 5200, 0.035, 0.16))
              deformation.angle = 0
            }
          } else if (ball.x > width - ball.radius) {
            wallImpact = Math.abs(ball.vx)
            ball.x = width - ball.radius
            ball.vx = -Math.abs(ball.vx) * 0.78
            const deformation = deformations.get(ball)
            if (deformation) {
              deformation.amount = Math.max(deformation.amount, clamp(0.035 + wallImpact / 5200, 0.035, 0.16))
              deformation.angle = 0
            }
          }
          if (ball.y < ball.radius) {
            wallImpact = Math.max(wallImpact, Math.abs(ball.vy))
            ball.y = ball.radius
            ball.vy = Math.abs(ball.vy) * 0.76
            const deformation = deformations.get(ball)
            if (deformation) {
              deformation.amount = Math.max(deformation.amount, clamp(0.035 + wallImpact / 5200, 0.035, 0.16))
              deformation.angle = Math.PI / 2
            }
          } else if (ball.y > height - ball.radius) {
            wallImpact = Math.max(wallImpact, Math.abs(ball.vy))
            ball.y = height - ball.radius
            ball.vy = -Math.abs(ball.vy) * 0.64
            ball.vx *= 0.982
            if (Math.abs(ball.vy) < 18) ball.vy = 0
            const deformation = deformations.get(ball)
            if (deformation) {
              deformation.amount = Math.max(deformation.amount, clamp(0.028 + wallImpact / 5200, 0.028, 0.16))
              deformation.angle = Math.PI / 2
            }
          }
          if (wallImpact > 145) registerImpact(wallImpact, true)
        })

        for (let i = 0; i < balls.length; i += 1) {
          for (let j = i + 1; j < balls.length; j += 1) {
            const a = balls[i]
            const b = balls[j]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const distance = Math.hypot(dx, dy) || 0.001
            const minimum = a.radius + b.radius
            if (distance >= minimum) continue
            const contactKey = `${i}:${j}`
            const isNewContact = !activeBallContacts.has(contactKey) &&
              !contactsThisFrame.has(contactKey)
            contactsThisFrame.add(contactKey)
            const nx = dx / distance
            const ny = dy / distance
            const overlap = minimum - distance
            const relativeVelocityX = b.vx - a.vx
            const relativeVelocityY = b.vy - a.vy
            const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny
            const impactSpeed = Math.max(0, -velocityAlongNormal)
            const collisionBend = clamp(
              overlap / Math.min(a.radius, b.radius) * 0.12 + impactSpeed / 2600,
              0,
              0.15,
            )
            const collisionAngle = Math.atan2(ny, nx)
            const deformationA = deformations.get(a)
            const deformationB = deformations.get(b)
            if (deformationA && collisionBend > 0.008 && collisionBend > deformationA.amount) {
              deformationA.amount = collisionBend
              deformationA.angle = collisionAngle
            }
            if (deformationB && collisionBend > 0.008 && collisionBend > deformationB.amount) {
              deformationB.amount = collisionBend
              deformationB.angle = collisionAngle
            }
            const aMovable = a !== draggedBall
            const bMovable = b !== draggedBall
            const share = aMovable && bMovable ? 0.5 : 1
            if (aMovable) {
              a.x -= nx * overlap * share
              a.y -= ny * overlap * share
            }
            if (bMovable) {
              b.x += nx * overlap * share
              b.y += ny * overlap * share
            }

            if (velocityAlongNormal > 0) continue
            const restitution = impactSpeed < 110 ? 0.08 : 0.86
            const inverseMassA = a === draggedBall ? 0 : 1 / a.mass
            const inverseMassB = b === draggedBall ? 0 : 1 / b.mass
            const impulse =
              (-(1 + restitution) * velocityAlongNormal) /
              Math.max(inverseMassA + inverseMassB, 0.000001)
            const impulseX = impulse * nx
            const impulseY = impulse * ny
            if (aMovable) {
              a.vx -= impulseX * inverseMassA
              a.vy -= impulseY * inverseMassA
            }
            if (bMovable) {
              b.vx += impulseX * inverseMassB
              b.vy += impulseY * inverseMassB
            }
            const lastPairImpact = lastBallImpactAt.get(contactKey) ?? -Infinity
            if (isNewContact && impactSpeed >= 80 && now - lastPairImpact > 900) {
              lastBallImpactAt.set(contactKey, now)
              registerImpact(impactSpeed, true)
            }
          }
        }
      }
      activeBallContacts = contactsThisFrame

      const hoveredLinkBall = pointerIsInside && !draggedBall
        ? [...balls].reverse().find(
          (ball) => (BALL_LINKS[ball.kind] || ball.kind === 'things') &&
            Math.hypot(pointer.x - ball.x, pointer.y - ball.y) <= ball.radius,
        ) ?? null
        : null
      canvas.classList.toggle('is-link', Boolean(hoveredLinkBall))

      if (hoveredLinkBall) {
        if (tooltipBall !== hoveredLinkBall) {
          tooltipBall = hoveredLinkBall
          tooltipOpacity = 0
        }
        tooltipOpacity = Math.min(1, tooltipOpacity + delta * 10)
      } else {
        tooltipOpacity = Math.max(0, tooltipOpacity - delta * 12)
        if (tooltipOpacity === 0) tooltipBall = null
      }

      balls.forEach((ball) => drawSphere(ball, foreground, ballBackground, palettePulse, now))
      if (tooltipBall && tooltipOpacity > 0) {
        const label = BALL_LABELS[tooltipBall.kind]
        if (label) drawTooltip(tooltipBall, label, foreground, ballBackground, tooltipOpacity)
      }
      frame = requestAnimationFrame(render)
    }

    const getPointer = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY })

    const constrainBallToViewport = (ball: Ball) => {
      ball.x = clamp(ball.x, ball.radius, width - ball.radius)
      ball.y = clamp(ball.y, ball.radius, height - ball.radius)
    }

    const activateBall = (ball: Ball) => {
      if (ball.kind === 'things') {
        setThingsOpen(true)
        return
      }
      const href = BALL_LINKS[ball.kind]
      if (!href) return
      const link = document.createElement('a')
      link.href = href
      link.target = href.startsWith('mailto:') ? '_self' : '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
    }

    const onPointerDown = (event: PointerEvent) => {
      void ensureAudio()
      pointerIsInside = true
      pointer = getPointer(event)
      draggedBall = [...balls].reverse().find(
        (ball) => Math.hypot(pointer.x - ball.x, pointer.y - ball.y) <= ball.radius,
      ) ?? null
      if (!draggedBall) return
      pointerDownAt = performance.now()
      pointerDownPoint = { ...pointer }
      pointerOffset = { x: pointer.x - draggedBall.x, y: pointer.y - draggedBall.y }
      pointerHistory = [{ ...pointer, time: pointerDownAt }]
      canvas.setPointerCapture(event.pointerId)
      canvas.classList.add('is-dragging')
    }

    const onPointerMove = (event: PointerEvent) => {
      pointerIsInside = true
      pointer = getPointer(event)
      if (!draggedBall) return
      const now = performance.now()
      pointerHistory.push({ ...pointer, time: now })
      pointerHistory = pointerHistory.filter((sample) => now - sample.time < 120)
    }

    const releasePointer = (event: PointerEvent) => {
      if (!draggedBall) return
      const now = performance.now()
      const releasedBall = draggedBall
      pointer = getPointer(event)
      constrainBallToViewport(releasedBall)
      const pointerTravel = Math.hypot(
        pointer.x - pointerDownPoint.x,
        pointer.y - pointerDownPoint.y,
      )
      const isClick = event.type === 'pointerup' && pointerTravel < 8 && now - pointerDownAt < 420
      if (isClick) {
        clickBounces.set(releasedBall, now)
        releasedBall.vx *= 0.35
        releasedBall.vy = Math.min(releasedBall.vy, 0) - Math.min(145, releasedBall.radius * 1.05)
        void ensureAudio().then((ready) => {
          if (ready) playImpact(140)
        })
        activateBall(releasedBall)
      } else {
        const velocitySamples = [
          ...pointerHistory.filter((sample) => now - sample.time <= 110),
          { ...pointer, time: now },
        ]
        const firstSample = velocitySamples[0]
        const lastSample = velocitySamples[velocitySamples.length - 1]
        const sampleDuration = Math.max((lastSample.time - firstSample.time) / 1000, 0.016)
        const rawVelocityX = (lastSample.x - firstSample.x) / sampleDuration
        const rawVelocityY = (lastSample.y - firstSample.y) / sampleDuration
        const rawSpeed = Math.hypot(rawVelocityX, rawVelocityY)
        const maximumThrowSpeed = 1700
        const velocityScale = rawSpeed > maximumThrowSpeed ? maximumThrowSpeed / rawSpeed : 1
        releasedBall.vx = rawSpeed < 24 ? 0 : rawVelocityX * velocityScale * 0.94
        releasedBall.vy = rawSpeed < 24 ? 0 : rawVelocityY * velocityScale * 0.94
      }
      draggedBall = null
      pointerHistory = []
      canvas.classList.remove('is-dragging')
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }

    const cancelDrag = () => {
      if (!draggedBall) return
      constrainBallToViewport(draggedBall)
      draggedBall.vx = 0
      draggedBall.vy = 0
      draggedBall = null
      pointerHistory = []
      canvas.classList.remove('is-dragging')
    }

    const onVisibilityChange = () => {
      if (document.hidden) cancelDrag()
    }

    resize()
    window.addEventListener('resize', resize)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', releasePointer)
    canvas.addEventListener('pointercancel', releasePointer)
    canvas.addEventListener('lostpointercapture', cancelDrag)
    window.addEventListener('pointerup', releasePointer)
    window.addEventListener('pointercancel', releasePointer)
    window.addEventListener('blur', cancelDrag)
    document.addEventListener('visibilitychange', onVisibilityChange)
    const onPointerEnter = (event: PointerEvent) => {
      pointerIsInside = true
      pointer = getPointer(event)
    }
    const onPointerLeave = () => {
      pointerIsInside = false
      canvas.classList.remove('is-link')
    }
    canvas.addEventListener('pointerenter', onPointerEnter)
    canvas.addEventListener('pointerleave', onPointerLeave)
    const onAudioGesture = () => { void ensureAudio() }
    canvas.addEventListener('click', onAudioGesture)
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', releasePointer)
      canvas.removeEventListener('pointercancel', releasePointer)
      canvas.removeEventListener('lostpointercapture', cancelDrag)
      window.removeEventListener('pointerup', releasePointer)
      window.removeEventListener('pointercancel', releasePointer)
      window.removeEventListener('blur', cancelDrag)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      canvas.removeEventListener('pointerenter', onPointerEnter)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('click', onAudioGesture)
      audioControlsRef.current = null
      if (mediaUnlock) mediaUnlock.pause()
      if (mediaUnlockUrl) URL.revokeObjectURL(mediaUnlockUrl)
      if (audioContext) void audioContext.close()
    }
  }, [])

  return (
    <main className="portfolio-shell">
      <canvas
        ref={canvasRef}
        className="physics-stage"
        aria-label="Interactive portfolio playground with Notes and Things balls. Tap Things to view the collection, tap the GitHub, X, or email balls to open their links, or drag and throw any ball."
      />
      {thingsOpen && (
        <section
          className="things-view"
          role="dialog"
          aria-modal="true"
          aria-labelledby="things-title"
        >
          <button
            type="button"
            className="things-close"
            onClick={() => setThingsOpen(false)}
            autoFocus
          >
            close
          </button>
          <div className="things-heading">
            <span>things / 01</span>
            <h1 id="things-title">Vintage Casio</h1>
          </div>
          <figure className="watch-figure">
            <VintageCasioWatch />
            <figcaption>Vintage Casio digital watch</figcaption>
          </figure>
        </section>
      )}
      <header className="site-header">
        <div className="wordmark" aria-hidden="true">
          DESIGNER / DEVELOPER / DESIGN ENGINEER
        </div>
        <button
          type="button"
          className="sound-toggle"
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Turn sound off' : 'Turn sound on'}
          aria-pressed={soundEnabled}
          title={soundEnabled ? 'Turn sound off' : 'Turn sound on'}
        >
          {soundEnabled ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4V5Z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4V5Z" />
              <path d="m22 9-6 6" />
              <path d="m16 9 6 6" />
            </svg>
          )}
        </button>
      </header>
      <div className="palette-status" aria-live="polite">
        <span>{String(paletteIndex + 1).padStart(2, '0')}</span>
        <span className="palette-line" />
        <span>{PALETTES[paletteIndex].name}</span>
      </div>
      <footer className="site-footer">
        <span className="text-link">information</span>
        <span>Toronto · Canada</span>
      </footer>
    </main>
  )
}

export default App
