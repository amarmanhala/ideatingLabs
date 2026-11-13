import { useEffect, useRef, useState } from 'react'
import './App.css'

type Point = { x: number; y: number }
type BallKind = 'instagram' | 'story' | 'projects' | 'x' | 'email'

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

const PALETTES: Palette[] = [
  { background: '#00452f', foreground: '#ffe85a', name: 'forest + sun' },
  { background: '#f3f3f2', foreground: '#df4500', name: 'paper + ember' },
  { background: '#a9bff3', foreground: '#111515', name: 'sky + ink' },
  { background: '#111515', foreground: '#ffe85a', name: 'night + sun' },
  { background: '#df4500', foreground: '#f6f5f3', name: 'ember + paper' },
  { background: '#ffe85a', foreground: '#00452f', name: 'sun + forest' },
]

const STORY_LINES = Array.from({ length: 11 }, () => 'Amarpreet Singh')
const STORY_BAND_OFFSETS = STORY_LINES.map(() => Math.random() * Math.PI * 2)

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

const roundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
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

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [soundReady, setSoundReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    let frame = 0
    let width = window.innerWidth
    let height = window.innerHeight
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let lastTime = performance.now()
    let palette = 0
    let previousPalette = 0
    let paletteChangedAt = -1000
    let audioContext: AudioContext | null = null
    let audioStateListener: (() => void) | null = null
    let mediaUnlock: HTMLAudioElement | null = null
    let mediaUnlockUrl: string | null = null
    let balls: Ball[] = []
    let draggedBall: Ball | null = null
    let pointer: Point = { x: 0, y: 0 }
    let pointerOffset: Point = { x: 0, y: 0 }
    let pointerDownAt = 0
    let pointerDownPoint: Point = { x: 0, y: 0 }
    let pointerHistory: Array<Point & { time: number }> = []
    let lastImpactAt = 0
    let lastSoundAt = 0
    let initialized = false
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
      const projects = width < 720 ? width * 0.76 : width * 0.555
      const rightA = width < 720 ? width * 0.72 : width * 0.74
      const rightB = width < 720 ? width * 0.84 : width * 0.91

      balls = [
        {
          kind: 'instagram', x: left, y: floor - small, vx: 0, vy: 0,
          radius: small, mass: small * small, rotationX: 0, rotationY: 0,
        },
        {
          kind: 'story', x: center, y: floor - large, vx: 0, vy: 0,
          radius: large, mass: large * large * 1.18, rotationX: -0.12, rotationY: 0.2,
        },
        {
          kind: 'projects', x: projects, y: floor - medium, vx: 0, vy: 0,
          radius: medium, mass: medium * medium, rotationX: 0, rotationY: 0,
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
        balls[3].x = width * 0.73
        balls[3].y = floor - small * 1.92
        balls[4].x = width * 0.83
        balls[4].y = floor - small * 0.82
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

    const syncSoundState = () => {
      setSoundReady(audioContext?.state === 'running')
    }

    const ensureAudio = (): Promise<boolean> => {
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
        audioStateListener = syncSoundState
        audioContext.addEventListener('statechange', audioStateListener)
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
        syncSoundState()
        return mediaReady.then(() => true)
      }

      const contextToResume = audioContext
      const contextReady = contextToResume.resume()
        .then(() => true)
        .catch(() => false)

      return Promise.all([mediaReady, contextReady])
        .then(([, resumed]) => {
          if (audioContext === contextToResume) syncSoundState()
          return resumed && contextToResume.state === 'running'
        })
    }

    const playImpact = (strength: number) => {
      if (!audioContext || audioContext.state !== 'running') return
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
      palette = (palette + 1) % PALETTES.length
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

      const baseColor = ball.kind === 'story' ? background : foreground
      if (ball.kind === 'story') {
        const body = context.createRadialGradient(
          -radius * 0.38,
          -radius * 0.46,
          radius * 0.035,
          radius * 0.08,
          radius * 0.08,
          radius * 1.08,
        )
        body.addColorStop(0, mixColor(baseColor, '#ffffff', 0.018))
        body.addColorStop(0.42, baseColor)
        body.addColorStop(0.78, mixColor(baseColor, '#000000', 0.011))
        body.addColorStop(1, mixColor(baseColor, '#000000', 0.028))
        context.fillStyle = body
      } else {
        context.fillStyle = foreground
      }
      context.fillRect(-radius, -radius, radius * 2, radius * 2)
      context.fillStyle = ball.kind === 'story' ? foreground : background
      context.textAlign = 'center'
      context.textBaseline = 'middle'

      if (ball.kind === 'instagram') {
        const iconSize = radius * 0.78
        context.save()
        context.scale(0.92, 1)
        context.lineWidth = radius * 0.1
        context.strokeStyle = background
        roundedRect(context, -iconSize / 2, -iconSize / 2, iconSize, iconSize, iconSize * 0.27)
        context.stroke()
        context.beginPath()
        context.arc(0, 0, iconSize * 0.22, 0, Math.PI * 2)
        context.stroke()
        context.beginPath()
        context.arc(iconSize * 0.27, -iconSize * 0.27, iconSize * 0.07, 0, Math.PI * 2)
        context.fillStyle = background
        context.fill()
        context.restore()
      } else if (ball.kind === 'x') {
        context.save()
        context.scale(0.9, 1)
        context.font = `300 ${radius * 1.16}px Arial, sans-serif`
        context.fillText('𝕏', 0, radius * 0.02)
        context.restore()
      } else if (ball.kind === 'email' || ball.kind === 'projects') {
        const label = ball.kind === 'projects' ? 'projects' : 'email'
        const fontScale = ball.kind === 'projects' ? 0.34 : 0.43
        context.font = `400 ${radius * fontScale}px Arial, sans-serif`
        const characters = [...label]
        const widths = characters.map((character) => context.measureText(character).width)
        const totalWidth = widths.reduce((sum, characterWidth) => sum + characterWidth, 0)
        const angularSpan = totalWidth / Math.max(radius * 0.94, 1)
        let cursor = 0
        characters.forEach((character, characterIndex) => {
          const characterWidth = widths[characterIndex]
          const progress = (cursor + characterWidth * 0.5) / Math.max(totalWidth, 1)
          const theta = (progress - 0.5) * angularSpan
          const surfaceDepth = Math.max(0.2, Math.cos(theta))
          context.save()
          context.translate(Math.sin(theta) * radius * 0.94, 0)
          context.scale(surfaceDepth, 1)
          context.globalAlpha = surfaceDepth ** 0.45
          context.fillText(character, 0, 0)
          context.restore()
          cursor += characterWidth
        })
        context.globalAlpha = 1
      } else {
        context.fillStyle = foreground
        STORY_LINES.forEach((line, index) => {
          const latitudeStep = Math.PI / (STORY_LINES.length + 2)
          const latitude = (index - (STORY_LINES.length - 1) / 2) * latitudeStep
          const latitudeCurve = Math.cos(latitude)
          const ringRadius = latitudeCurve * radius
          const fontSize = radius * (0.11 + latitudeCurve * 0.12)
          context.font = `500 ${fontSize}px Arial, sans-serif`
          const separator = '     '
          const source = `${line}${separator}`
          const sourceWidth = context.measureText(source).width
          const circumference = Math.PI * 2 * Math.max(ringRadius, 1)
          const repeatCount = Math.max(2, Math.ceil(circumference / Math.max(sourceWidth, 1)) + 1)
          const characters = [...source.repeat(repeatCount)]
          const widths = characters.map((character) => context.measureText(character).width)
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

      if (ball.kind === 'story') {
        const edgeFalloff = context.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius)
        edgeFalloff.addColorStop(0, 'rgba(0,0,0,0)')
        edgeFalloff.addColorStop(0.76, 'rgba(0,0,0,0.015)')
        edgeFalloff.addColorStop(1, 'rgba(0,0,0,0.025)')
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
        specular.addColorStop(0, 'rgba(255,255,255,0.025)')
        specular.addColorStop(1, 'rgba(255,255,255,0)')
        context.fillStyle = specular
        context.fillRect(-radius, -radius, radius * 2, radius * 2)
      }
      context.restore()
    }

    const render = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.025)
      lastTime = now
      const transition = clamp((now - paletteChangedAt) / 1200, 0, 1)
      const ease = transition * transition * (3 - 2 * transition)
      const palettePulse = 1 + Math.sin(transition * Math.PI) * 0.014
      const background = mixColor(
        PALETTES[previousPalette].background, PALETTES[palette].background, ease,
      )
      const foreground = mixColor(
        PALETTES[previousPalette].foreground, PALETTES[palette].foreground, ease,
      )

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      context.fillStyle = background
      context.fillRect(0, 0, width, height)

      const steps = 3
      const step = delta / steps
      const contactsThisFrame = new Set<string>()
      for (let simulationStep = 0; simulationStep < steps; simulationStep += 1) {
        balls.forEach((ball) => {
          const deformation = deformations.get(ball)
          if (deformation) {
            deformation.amount *= Math.pow(0.78, step * 60)
            if (deformation.amount < 0.002) deformation.amount = 0
          }
          if (ball === draggedBall) {
            const moveX = (pointer.x - pointerOffset.x - ball.x) * 0.58
            const moveY = (pointer.y - pointerOffset.y - ball.y) * 0.58
            ball.x += moveX
            ball.y += moveY
            if (ball.kind === 'story') {
              ball.rotationY += moveX / Math.max(ball.radius, 1)
              ball.rotationX -= moveY / Math.max(ball.radius, 1)
            }
            ball.vx = 0
            ball.vy = 0
            return
          }
          ball.vy += 620 * step
          const moveX = ball.vx * step
          const moveY = ball.vy * step
          ball.x += moveX
          ball.y += moveY
          if (ball.kind === 'story') {
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

      balls.forEach((ball) => drawSphere(ball, foreground, background, palettePulse, now))
      frame = requestAnimationFrame(render)
    }

    const getPointer = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY })

    const onPointerDown = (event: PointerEvent) => {
      void ensureAudio()
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
      if (!draggedBall) return
      pointer = getPointer(event)
      const now = performance.now()
      pointerHistory.push({ ...pointer, time: now })
      pointerHistory = pointerHistory.filter((sample) => now - sample.time < 120)
    }

    const releasePointer = (event: PointerEvent) => {
      if (!draggedBall) return
      const now = performance.now()
      const releasedBall = draggedBall
      pointer = getPointer(event)
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

    resize()
    window.addEventListener('resize', resize)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', releasePointer)
    canvas.addEventListener('pointercancel', releasePointer)
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
      canvas.removeEventListener('click', onAudioGesture)
      if (mediaUnlock) mediaUnlock.pause()
      if (mediaUnlockUrl) URL.revokeObjectURL(mediaUnlockUrl)
      if (audioContext) {
        if (audioStateListener) {
          audioContext.removeEventListener('statechange', audioStateListener)
        }
        void audioContext.close()
      }
    }
  }, [])

  return (
    <main className="portfolio-shell">
      <canvas
        ref={canvasRef}
        className="physics-stage"
        aria-label="Interactive portfolio playground. Drag and throw the five balls to make them collide."
      />
      <header className="site-header" aria-hidden="true">
        <div className="wordmark">DESIGNER / DEVELOPER / DESIGN ENGINEER</div>
        <div className="interaction-note">
          <span>{soundReady ? 'sound on' : 'drag to begin'}</span>
          <span>click · drag · collide</span>
        </div>
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
