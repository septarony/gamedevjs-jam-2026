import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import SteamGauge from './components/SteamGauge'

const MAX_PRESSURE = 100
const MAX_HEAT = 100
const MAX_STABILITY = 100
const LOOP_MS = 1000
const FACT_STEP_KG = 50
const DIFFICULTY_STEP_KG = 50
const MAX_DIFFICULTY_LEVEL = 6
const REFILL_COOLDOWN_SEC = 3

const INITIAL_GAME_STATE = {
  steamPressure: 28,
  machineHeat: 24,
  stability: 62,
  processedTeaKg: 0,
  survivalTimeSec: 0,
  factIndex: -1,
  pressureRateMultiplier: 1,
  activeEvent: null,
  eventHistory: [],
  actionStats: {
    releaseSteam: 0,
    lubricateGears: 0,
    refillBoiler: 0,
  },
  refillCooldownSec: 0,
  boilerShockAlertSec: 0,
  boilerShockMessage: '',
  operatorProfile: 'Balanced Crew',
  isGameOver: false,
}

const heritageEventTemplates = [
  {
    year: 1894,
    title: 'Mountain Estate Expansion',
    telegram:
      'New tea blocks open in the Lembang highlands. Boilers must run longer shifts to meet output.',
    baseEffectLabel: 'Steam rise rate +10%',
    pressureRateBonus: 0.1,
    instantHeatDelta: 0,
    instantStabilityDelta: 0,
  },
  {
    year: 1903,
    title: 'Rail Delivery Contract Signed',
    telegram:
      'Priangan rail wagons now demand tighter delivery windows. The pressure of the machine must be raised by 20%.',
    baseEffectLabel: 'Steam rise rate +20%, stability -4',
    pressureRateBonus: 0.2,
    instantHeatDelta: 0,
    instantStabilityDelta: -4,
  },
  {
    year: 1911,
    title: 'Steam Dryer Retrofit',
    telegram:
      'Factory rolling and drying drums are upgraded to a larger steam chamber. Keep the engine hotter and faster.',
    baseEffectLabel: 'Steam rise rate +15%, heat +6',
    pressureRateBonus: 0.15,
    instantHeatDelta: 6,
    instantStabilityDelta: 0,
  },
  {
    year: 1920,
    title: 'Dutch Tea Demand Surges',
    telegram:
      'Demand for tea from the Netherlands increases. The pressure of the machine must be increased by 20%.',
    baseEffectLabel: 'Steam rise rate +20%, stability -5',
    pressureRateBonus: 0.2,
    instantHeatDelta: 0,
    instantStabilityDelta: -5,
  },
  {
    year: 1928,
    title: 'Peak Export Season',
    telegram:
      'Peak export season in North Bandung reaches the estate. Boiler crews push output to the limit.',
    baseEffectLabel: 'Steam rise rate +12%, heat +4',
    pressureRateBonus: 0.12,
    instantHeatDelta: 4,
    instantStabilityDelta: 0,
  },
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const getDifficultyLevel = (processedTeaKg) =>
  Math.min(MAX_DIFFICULTY_LEVEL, Math.floor(processedTeaKg / DIFFICULTY_STEP_KG))

const getDifficultyModifiers = (difficultyLevel) => {
  return {
    pressureRampMultiplier: 1 + difficultyLevel * 0.08,
    passiveHeatPenalty: Math.floor(difficultyLevel / 2),
    stabilityDrainPenalty: Math.floor((difficultyLevel + 1) / 2),
    coolingEfficiency: clamp(1 - difficultyLevel * 0.09, 0.48, 1),
  }
}

const getDifficultyLabel = (difficultyLevel) => {
  if (difficultyLevel <= 1) {
    return 'Calm'
  }
  if (difficultyLevel <= 3) {
    return 'Restless'
  }
  if (difficultyLevel <= 5) {
    return 'Aggressive'
  }
  return 'Overclocked'
}

const getOperatorProfile = (actionStats) => {
  const releaseCount = actionStats.releaseSteam
  const lubeCount = actionStats.lubricateGears
  const refillCount = actionStats.refillBoiler

  const maxCount = Math.max(releaseCount, lubeCount, refillCount)
  if (maxCount === 0) {
    return 'Balanced Crew'
  }

  const minCount = Math.min(releaseCount, lubeCount, refillCount)
  const leadDiff =
    maxCount === releaseCount
      ? Math.max(releaseCount - lubeCount, releaseCount - refillCount)
      : maxCount === lubeCount
        ? Math.max(lubeCount - releaseCount, lubeCount - refillCount)
        : Math.max(refillCount - releaseCount, refillCount - lubeCount)

  if (maxCount - minCount < 3 || leadDiff < 3) {
    return 'Balanced Crew'
  }

  if (maxCount === releaseCount) {
    return 'Pressure Rider'
  }
  if (maxCount === lubeCount) {
    return 'Engine Mechanic'
  }

  return 'Boiler Keeper'
}

const createBranchingEvent = (template, eventIndex, actionStats) => {
  const profile = getOperatorProfile(actionStats)

  if (profile === 'Pressure Rider') {
    return {
      id: `${template.year}-${eventIndex}-pressure`,
      year: template.year,
      title: template.title,
      profile,
      telegram: `${template.year}: ${template.telegram} Chief operator report: your aggressive vent timing helps output, but boiler stress increases.`,
      effectLabel: `${template.baseEffectLabel}, heat +3`,
      pressureRateBonus: template.pressureRateBonus,
      instantHeatDelta: template.instantHeatDelta + 3,
      instantStabilityDelta: template.instantStabilityDelta,
      tone: 'warning',
    }
  }

  if (profile === 'Engine Mechanic') {
    return {
      id: `${template.year}-${eventIndex}-mechanic`,
      year: template.year,
      title: template.title,
      profile,
      telegram: `${template.year}: ${template.telegram} Your precise lubrication routine keeps belts and pistons calm.`,
      effectLabel: `${template.baseEffectLabel}, stability +6`,
      pressureRateBonus: template.pressureRateBonus,
      instantHeatDelta: template.instantHeatDelta,
      instantStabilityDelta: template.instantStabilityDelta + 6,
      tone: 'boost',
    }
  }

  if (profile === 'Boiler Keeper') {
    return {
      id: `${template.year}-${eventIndex}-boiler`,
      year: template.year,
      title: template.title,
      profile,
      telegram: `${template.year}: ${template.telegram} Water regulation is excellent, giving the crew a safer steam reserve.`,
      effectLabel: `${template.baseEffectLabel}, heat -5`,
      pressureRateBonus: template.pressureRateBonus,
      instantHeatDelta: template.instantHeatDelta - 5,
      instantStabilityDelta: template.instantStabilityDelta,
      tone: 'boost',
    }
  }

  return {
    id: `${template.year}-${eventIndex}-balanced`,
    year: template.year,
    title: template.title,
    profile,
    telegram: `${template.year}: ${template.telegram} The crew works in disciplined rhythm, but the schedule leaves little margin for mistakes.`,
    effectLabel: `${template.baseEffectLabel}, stability -2`,
    pressureRateBonus: template.pressureRateBonus,
    instantHeatDelta: template.instantHeatDelta,
    instantStabilityDelta: template.instantStabilityDelta - 2,
    tone: 'warning',
  }
}

const playDispatchTone = (audioContextRef) => {
  if (typeof window === 'undefined') {
    return
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) {
    return
  }

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioCtx()
  }

  const context = audioContextRef.current
  if (context.state === 'suspended') {
    context.resume().catch(() => {})
  }

  const tones = [740, 920, 740]
  const now = context.currentTime

  tones.forEach((freq, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startAt = now + index * 0.12
    const endAt = startAt + 0.08

    oscillator.type = 'square'
    oscillator.frequency.setValueAtTime(freq, startAt)

    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(0.07, startAt + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt)

    oscillator.connect(gain)
    gain.connect(context.destination)

    oscillator.start(startAt)
    oscillator.stop(endAt)
  })
}

const ensureAudioContext = (audioContextRef) => {
  if (typeof window === 'undefined') {
    return null
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) {
    return null
  }

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioCtx()
  }

  const context = audioContextRef.current
  if (context.state === 'suspended') {
    context.resume().catch(() => {})
  }

  return context
}

const getSteamHissBuffer = (context, steamHissBufferRef) => {
  const cached = steamHissBufferRef.current
  if (cached && cached.sampleRate === context.sampleRate) {
    return cached.buffer
  }

  const durationSec = 0.26
  const sampleCount = Math.floor(context.sampleRate * durationSec)
  const noiseBuffer = context.createBuffer(1, sampleCount, context.sampleRate)
  const data = noiseBuffer.getChannelData(0)

  for (let i = 0; i < sampleCount; i += 1) {
    const progress = i / sampleCount
    const envelope = 1 - progress
    data[i] = (Math.random() * 2 - 1) * envelope * envelope
  }

  steamHissBufferRef.current = {
    sampleRate: context.sampleRate,
    buffer: noiseBuffer,
  }

  return noiseBuffer
}

const startGearAmbience = (audioContextRef, gearAudioRef) => {
  if (gearAudioRef.current.isStarted) {
    return
  }

  const context = ensureAudioContext(audioContextRef)
  if (!context) {
    return
  }

  const masterGain = context.createGain()
  const lowpass = context.createBiquadFilter()
  const rotorA = context.createOscillator()
  const rotorB = context.createOscillator()
  const wobble = context.createOscillator()
  const wobbleGain = context.createGain()

  lowpass.type = 'lowpass'
  lowpass.frequency.value = 420

  masterGain.gain.value = 0.03

  rotorA.type = 'sawtooth'
  rotorA.frequency.value = 44

  rotorB.type = 'square'
  rotorB.frequency.value = 66

  wobble.type = 'sine'
  wobble.frequency.value = 2.1
  wobbleGain.gain.value = 7

  wobble.connect(wobbleGain)
  wobbleGain.connect(lowpass.frequency)

  rotorA.connect(lowpass)
  rotorB.connect(lowpass)
  lowpass.connect(masterGain)
  masterGain.connect(context.destination)

  rotorA.start()
  rotorB.start()
  wobble.start()

  gearAudioRef.current = {
    isStarted: true,
    nodes: [rotorA, rotorB, wobble, wobbleGain, lowpass, masterGain],
  }
}

const playSteamHiss = (audioContextRef, steamHissBufferRef) => {
  const context = ensureAudioContext(audioContextRef)
  if (!context) {
    return
  }

  const source = context.createBufferSource()
  const highpass = context.createBiquadFilter()
  const gain = context.createGain()
  const now = context.currentTime
  const durationSec = 0.26

  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(1600, now)

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.11, now + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec)

  source.buffer = getSteamHissBuffer(context, steamHissBufferRef)
  source.connect(highpass)
  highpass.connect(gain)
  gain.connect(context.destination)

  source.start(now)
  source.stop(now + durationSec)
}

function App() {
  const [gameState, setGameState] = useState(() => ({ ...INITIAL_GAME_STATE }))
  const audioContextRef = useRef(null)
  const gearAudioRef = useRef({ isStarted: false, nodes: [] })
  const steamHissBufferRef = useRef(null)
  const lastActiveEventIdRef = useRef('')
  const fullscreenTargetRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (gameState.isGameOver) {
      return undefined
    }

    const intervalId = setInterval(() => {
      setGameState((prev) => {
        if (prev.isGameOver) {
          return prev
        }

        const difficultyLevel = getDifficultyLevel(prev.processedTeaKg)
        const difficultyMods = getDifficultyModifiers(difficultyLevel)

        const nextPressure = clamp(
          prev.steamPressure +
            Math.round(
              (8 - Math.floor(prev.stability / 45)) *
                prev.pressureRateMultiplier *
                difficultyMods.pressureRampMultiplier
            ),
          0,
          MAX_PRESSURE
        )
        const nextHeat = clamp(
          prev.machineHeat +
            5 +
            Math.floor(prev.steamPressure / 55) +
            difficultyMods.passiveHeatPenalty,
          0,
          MAX_HEAT
        )
        const nextStability = clamp(
          prev.stability -
            (nextPressure > 70 ? 4 : 2) -
            (nextHeat > 70 ? 3 : 0) -
            difficultyMods.stabilityDrainPenalty,
          0,
          MAX_STABILITY
        )

        const productionRate = Math.max(0, Math.floor(nextStability / 22))
        const nextProcessedTea = prev.processedTeaKg + productionRate
        const unlockedFact = Math.min(
          heritageEventTemplates.length - 1,
          Math.floor(nextProcessedTea / FACT_STEP_KG) - 1
        )
        const didUnlockNewEvent = unlockedFact > prev.factIndex
        const generatedEvent = didUnlockNewEvent
          ? createBranchingEvent(heritageEventTemplates[unlockedFact], unlockedFact, prev.actionStats)
          : null
        const nextPressureRateMultiplier = generatedEvent
          ? clamp(prev.pressureRateMultiplier + generatedEvent.pressureRateBonus, 0.6, 2.2)
          : prev.pressureRateMultiplier
        const adjustedHeat = clamp(
          nextHeat + (generatedEvent ? generatedEvent.instantHeatDelta : 0),
          0,
          MAX_HEAT
        )
        const adjustedStability = clamp(
          nextStability + (generatedEvent ? generatedEvent.instantStabilityDelta : 0),
          0,
          MAX_STABILITY
        )
        const nextEventHistory = generatedEvent ? [...prev.eventHistory, generatedEvent] : prev.eventHistory
        const nextProfile = getOperatorProfile(prev.actionStats)
        const nextRefillCooldownSec = Math.max(0, prev.refillCooldownSec - 1)
        const nextBoilerShockAlertSec = Math.max(0, prev.boilerShockAlertSec - 1)
        const nextBoilerShockMessage = nextBoilerShockAlertSec > 0 ? prev.boilerShockMessage : ''

        if (nextPressure >= MAX_PRESSURE) {
          return {
            ...prev,
            steamPressure: nextPressure,
            machineHeat: adjustedHeat,
            stability: adjustedStability,
            processedTeaKg: nextProcessedTea,
            survivalTimeSec: prev.survivalTimeSec + 1,
            factIndex: Math.max(prev.factIndex, unlockedFact),
            pressureRateMultiplier: nextPressureRateMultiplier,
            activeEvent: generatedEvent || prev.activeEvent,
            eventHistory: nextEventHistory,
            refillCooldownSec: nextRefillCooldownSec,
            boilerShockAlertSec: nextBoilerShockAlertSec,
            boilerShockMessage: nextBoilerShockMessage,
            operatorProfile: nextProfile,
            isGameOver: true,
          }
        }

        return {
          ...prev,
          steamPressure: nextPressure,
          machineHeat: adjustedHeat,
          stability: adjustedStability,
          processedTeaKg: nextProcessedTea,
          survivalTimeSec: prev.survivalTimeSec + 1,
          factIndex: Math.max(prev.factIndex, unlockedFact),
          pressureRateMultiplier: nextPressureRateMultiplier,
          activeEvent: generatedEvent || prev.activeEvent,
          eventHistory: nextEventHistory,
          refillCooldownSec: nextRefillCooldownSec,
          boilerShockAlertSec: nextBoilerShockAlertSec,
          boilerShockMessage: nextBoilerShockMessage,
          operatorProfile: nextProfile,
        }
      })
    }, LOOP_MS)

    return () => clearInterval(intervalId)
  }, [gameState.isGameOver])

  const updateGameStateIfRunning = (updater) => {
    setGameState((prev) => {
      if (prev.isGameOver) {
        return prev
      }

      return updater(prev)
    })
  }

  const releaseSteam = () => {
    startGearAmbience(audioContextRef, gearAudioRef)
    playSteamHiss(audioContextRef, steamHissBufferRef)

    updateGameStateIfRunning((prev) => {
      const nextState = {
        ...prev,
        steamPressure: clamp(prev.steamPressure - 22, 0, MAX_PRESSURE),
        stability: clamp(prev.stability - 2, 0, MAX_STABILITY),
        actionStats: {
          ...prev.actionStats,
          releaseSteam: prev.actionStats.releaseSteam + 1,
        },
      }

      return {
        ...nextState,
        operatorProfile: getOperatorProfile(nextState.actionStats),
      }
    })
  }

  const lubricateGears = () => {
    startGearAmbience(audioContextRef, gearAudioRef)

    updateGameStateIfRunning((prev) => {
      const difficultyMods = getDifficultyModifiers(getDifficultyLevel(prev.processedTeaKg))
      const effectiveCooling = Math.max(8, Math.round(20 * difficultyMods.coolingEfficiency))
      const nextState = {
        ...prev,
        machineHeat: clamp(prev.machineHeat - effectiveCooling, 0, MAX_HEAT),
        stability: clamp(prev.stability + 4, 0, MAX_STABILITY),
        actionStats: {
          ...prev.actionStats,
          lubricateGears: prev.actionStats.lubricateGears + 1,
        },
      }

      return {
        ...nextState,
        operatorProfile: getOperatorProfile(nextState.actionStats),
      }
    })
  }

  const refillBoiler = () => {
    startGearAmbience(audioContextRef, gearAudioRef)

    updateGameStateIfRunning((prev) => {
      if (prev.refillCooldownSec > 0) {
        return prev
      }

      const difficultyLevel = getDifficultyLevel(prev.processedTeaKg)
      const difficultyMods = getDifficultyModifiers(difficultyLevel)
      const effectiveCooling = Math.max(1, Math.round(4 * difficultyMods.coolingEfficiency))
      const effectivePressureRelief = Math.max(1, 6 - difficultyLevel)
      const effectiveStabilityGain = Math.max(1, 5 - difficultyLevel)
      const refillHeatSpike = 1 + Math.floor(difficultyLevel / 2)

      // Refill spam creates wet-steam turbulence and makes the machine harder to stabilize.
      const refillOveruse =
        prev.actionStats.refillBoiler -
        Math.max(prev.actionStats.releaseSteam, prev.actionStats.lubricateGears)
      const overusePenalty = refillOveruse >= 2 ? 2 + Math.floor(refillOveruse / 2) : 0
      const difficultyPressurePenalty = difficultyLevel >= 2 ? 1 + Math.floor(difficultyLevel / 2) : 0

      const boilerShockChance = clamp(
        0.1 + difficultyLevel * 0.03 + Math.max(0, refillOveruse) * 0.06,
        0,
        0.65
      )
      const isBoilerShock = Math.random() < boilerShockChance
      const shockHeat = isBoilerShock ? 5 + difficultyLevel : 0
      const shockPressure = isBoilerShock ? 3 + Math.floor(difficultyLevel / 2) : 0
      const shockStabilityLoss = isBoilerShock ? 5 + Math.floor(difficultyLevel / 2) : 0
      const shockMessage = isBoilerShock
        ? `BOILER SHOCK! +${shockPressure}% pressure, +${shockHeat}% heat, -${shockStabilityLoss}% stability.`
        : ''

      const nextState = {
        ...prev,
        steamPressure: clamp(
          prev.steamPressure - effectivePressureRelief + difficultyPressurePenalty + shockPressure,
          0,
          MAX_PRESSURE
        ),
        machineHeat: clamp(
          prev.machineHeat - effectiveCooling + refillHeatSpike + shockHeat,
          0,
          MAX_HEAT
        ),
        stability: clamp(
          prev.stability + effectiveStabilityGain - overusePenalty - shockStabilityLoss,
          0,
          MAX_STABILITY
        ),
        refillCooldownSec: REFILL_COOLDOWN_SEC,
        boilerShockAlertSec: isBoilerShock ? 2 : prev.boilerShockAlertSec,
        boilerShockMessage: isBoilerShock ? shockMessage : prev.boilerShockMessage,
        actionStats: {
          ...prev.actionStats,
          refillBoiler: prev.actionStats.refillBoiler + 1,
        },
      }

      return {
        ...nextState,
        operatorProfile: getOperatorProfile(nextState.actionStats),
      }
    })
  }

  const restartGame = () => {
    setGameState({ ...INITIAL_GAME_STATE })
  }

  const acknowledgeEvent = () => {
    updateGameStateIfRunning((prev) => ({
      ...prev,
      activeEvent: null,
    }))
  }

  useEffect(() => {
    if (!gameState.activeEvent) {
      return
    }

    if (lastActiveEventIdRef.current === gameState.activeEvent.id) {
      return
    }

    lastActiveEventIdRef.current = gameState.activeEvent.id
    playDispatchTone(audioContextRef)
  }, [gameState.activeEvent])

  useEffect(() => {
    return () => {
      if (gearAudioRef.current.isStarted) {
        gearAudioRef.current.nodes.forEach((node) => {
          if (typeof node.stop === 'function') {
            node.stop()
          }
          if (typeof node.disconnect === 'function') {
            node.disconnect()
          }
        })
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const target = fullscreenTargetRef.current || document.documentElement
        if (target.requestFullscreen) {
          await target.requestFullscreen()
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen()
      }
    } catch {
      // Ignore fullscreen API errors and keep the game playable.
    }
  }

  const nextFactTarget = useMemo(
    () => (Math.floor(gameState.processedTeaKg / FACT_STEP_KG) + 1) * FACT_STEP_KG,
    [gameState.processedTeaKg]
  )
  const latestEvent = useMemo(
    () => (gameState.eventHistory.length ? gameState.eventHistory[gameState.eventHistory.length - 1] : null),
    [gameState.eventHistory]
  )
  const activeEvent = gameState.activeEvent
  const difficultyLevel = useMemo(
    () => getDifficultyLevel(gameState.processedTeaKg),
    [gameState.processedTeaKg]
  )
  const difficultyLabel = useMemo(
    () => getDifficultyLabel(difficultyLevel),
    [difficultyLevel]
  )

  return (
    <main ref={fullscreenTargetRef} className={`factory-scene ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h1>Lembang Heritage: The Steam Machine</h1>
            <p className="subtitle">
              Keep the tea factory steam machine stable and process as many tea leaves as possible.
            </p>
          </div>
          <button type="button" className="fullscreen-btn" onClick={toggleFullscreen}>
            {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          </button>
        </div>

        <div className="gauge-row">
          <SteamGauge value={gameState.steamPressure} label="Steam Pressure" />
          <SteamGauge value={gameState.machineHeat} label="Machine Heat" />
          <SteamGauge value={gameState.stability} label="Stability" invert />
        </div>

        <div className="status-grid">
          <article className="status-card">
            <h2>Tea Processed</h2>
            <p className="value">{gameState.processedTeaKg} kg</p>
          </article>
          <article className="status-card">
            <h2>Survival Time</h2>
            <p className="value">{gameState.survivalTimeSec} seconds</p>
          </article>
          <article className="status-card">
            <h2>Next Fact Target</h2>
            <p className="value">{nextFactTarget} kg</p>
          </article>
          <article className="status-card">
            <h2>Steam Rise Rate</h2>
            <p className="value">x{gameState.pressureRateMultiplier.toFixed(2)}</p>
          </article>
          <article className="status-card">
            <h2>Operator Style</h2>
            <p className="value">{gameState.operatorProfile}</p>
            <p className="status-subvalue">
              Difficulty: {difficultyLabel} (Lv {difficultyLevel})
            </p>
          </article>
        </div>

        <div className="control-row">
          <button type="button" onClick={releaseSteam} disabled={gameState.isGameOver}>
            Release Steam
          </button>
          <button type="button" onClick={lubricateGears} disabled={gameState.isGameOver}>
            Lubricate Gears
          </button>
          <button
            type="button"
            onClick={refillBoiler}
            disabled={gameState.isGameOver || gameState.refillCooldownSec > 0}
          >
            {gameState.refillCooldownSec > 0
              ? `Refill Boiler (${gameState.refillCooldownSec}s)`
              : 'Refill Boiler'}
          </button>
        </div>

        {gameState.boilerShockAlertSec > 0 && (
          <section className="boiler-shock-alert" role="alert" aria-live="assertive">
            <p>{gameState.boilerShockMessage}</p>
          </section>
        )}

        <section className={`heritage-dispatch ${activeEvent ? 'is-visible' : ''}`} aria-live="polite">
          <p className="dispatch-kicker">Factory Telegram Bureau</p>
          {activeEvent ? (
            <>
              <h2>
                {activeEvent.year}: {activeEvent.title}
              </h2>
              <p className="dispatch-body">{activeEvent.telegram}</p>
              <p className="dispatch-profile">Crew Profile: {activeEvent.profile}</p>
              <p className={`dispatch-effect dispatch-effect-${activeEvent.tone}`}>
                Operational Order: {activeEvent.effectLabel}
              </p>
              <button type="button" onClick={acknowledgeEvent}>
                Acknowledge Dispatch
              </button>
            </>
          ) : (
            <>
              <h2>Colonial Chronicle Archive</h2>
              <p className="dispatch-body">
                {latestEvent
                  ? `${latestEvent.year}: ${latestEvent.telegram}`
                  : 'Produce 50 kg of tea to receive your first historical telegram from the estate office.'}
              </p>
              {latestEvent ? (
                <p className={`dispatch-effect dispatch-effect-${latestEvent.tone}`}>
                  Last Order: {latestEvent.effectLabel}
                </p>
              ) : null}
            </>
          )}
        </section>

        {gameState.isGameOver && (
          <section className="game-over" role="alert">
            <h2>Game Over: The Machine Exploded</h2>
            <p>
              Steam pressure reached {MAX_PRESSURE}%. You managed to process {gameState.processedTeaKg} kg of tea.
            </p>
            <button type="button" onClick={restartGame}>
              Restart Machine
            </button>
          </section>
        )}
      </section>
    </main>
  )
}

export default App