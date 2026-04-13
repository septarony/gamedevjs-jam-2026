import { useEffect, useMemo, useState } from 'react'
import './App.css'

const MAX_PRESSURE = 100
const MAX_HEAT = 100
const MAX_STABILITY = 100
const LOOP_MS = 1000
const FACT_STEP_KG = 50

const INITIAL_GAME_STATE = {
  steamPressure: 28,
  machineHeat: 24,
  stability: 62,
  processedTeaKg: 0,
  survivalTimeSec: 0,
  factIndex: -1,
  isGameOver: false,
}

const heritageFacts = [
  'By the late 19th century, Lembang had grown into a cool highland tea plantation region.',
  'Tea transport routes to major cities helped drive colonial infrastructure growth across Priangan.',
  'Colonial-era tea factories used steam power to run rolling and drying machinery.',
  'Historic tea estates operated with strict roles for supervisors, engine crews, and boiler operators.',
  'Industrial tea architecture heritage around North Bandung remains visible in old factories and warehouses.',
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function App() {
  const [gameState, setGameState] = useState(() => ({ ...INITIAL_GAME_STATE }))

  useEffect(() => {
    if (gameState.isGameOver) {
      return undefined
    }

    const intervalId = setInterval(() => {
      setGameState((prev) => {
        if (prev.isGameOver) {
          return prev
        }

        const nextPressure = clamp(
          prev.steamPressure + 8 - Math.floor(prev.stability / 45),
          0,
          MAX_PRESSURE
        )
        const nextHeat = clamp(
          prev.machineHeat + 5 + Math.floor(prev.steamPressure / 55),
          0,
          MAX_HEAT
        )
        const nextStability = clamp(
          prev.stability - (nextPressure > 70 ? 4 : 2) - (nextHeat > 70 ? 3 : 0),
          0,
          MAX_STABILITY
        )

        const productionRate = Math.max(0, Math.floor(nextStability / 22))
        const nextProcessedTea = prev.processedTeaKg + productionRate
        const unlockedFact = Math.min(
          heritageFacts.length - 1,
          Math.floor(nextProcessedTea / FACT_STEP_KG) - 1
        )

        if (nextPressure >= MAX_PRESSURE) {
          return {
            ...prev,
            steamPressure: nextPressure,
            machineHeat: nextHeat,
            stability: nextStability,
            processedTeaKg: nextProcessedTea,
            survivalTimeSec: prev.survivalTimeSec + 1,
            factIndex: Math.max(prev.factIndex, unlockedFact),
            isGameOver: true,
          }
        }

        return {
          ...prev,
          steamPressure: nextPressure,
          machineHeat: nextHeat,
          stability: nextStability,
          processedTeaKg: nextProcessedTea,
          survivalTimeSec: prev.survivalTimeSec + 1,
          factIndex: Math.max(prev.factIndex, unlockedFact),
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
    updateGameStateIfRunning((prev) => {
      return {
        ...prev,
        steamPressure: clamp(prev.steamPressure - 22, 0, MAX_PRESSURE),
        stability: clamp(prev.stability - 2, 0, MAX_STABILITY),
      }
    })
  }

  const lubricateGears = () => {
    updateGameStateIfRunning((prev) => {
      return {
        ...prev,
        machineHeat: clamp(prev.machineHeat - 20, 0, MAX_HEAT),
        stability: clamp(prev.stability + 4, 0, MAX_STABILITY),
      }
    })
  }

  const refillBoiler = () => {
    updateGameStateIfRunning((prev) => {
      return {
        ...prev,
        steamPressure: clamp(prev.steamPressure - 8, 0, MAX_PRESSURE),
        machineHeat: clamp(prev.machineHeat - 6, 0, MAX_HEAT),
        stability: clamp(prev.stability + 12, 0, MAX_STABILITY),
      }
    })
  }

  const restartGame = () => {
    setGameState({ ...INITIAL_GAME_STATE })
  }

  const nextFactTarget = useMemo(
    () => (Math.floor(gameState.processedTeaKg / FACT_STEP_KG) + 1) * FACT_STEP_KG,
    [gameState.processedTeaKg]
  )
  const activeFact = useMemo(
    () => (gameState.factIndex >= 0 ? heritageFacts[gameState.factIndex] : ''),
    [gameState.factIndex]
  )

  return (
    <main className="factory-scene">
      <section className="panel">
        <h1>Lembang Heritage: The Steam Machine</h1>
        <p className="subtitle">
          Keep the tea factory steam machine stable and process as many tea leaves as possible.
        </p>

        <div className="status-grid">
          <article className="status-card">
            <h2>Steam Pressure</h2>
            <p className="value">{gameState.steamPressure}%</p>
          </article>
          <article className="status-card">
            <h2>Machine Heat</h2>
            <p className="value">{gameState.machineHeat}%</p>
          </article>
          <article className="status-card">
            <h2>Stability</h2>
            <p className="value">{gameState.stability}%</p>
          </article>
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
        </div>

        <div className="control-row">
          <button type="button" onClick={releaseSteam} disabled={gameState.isGameOver}>
            Release Steam
          </button>
          <button type="button" onClick={lubricateGears} disabled={gameState.isGameOver}>
            Lubricate Gears
          </button>
          <button type="button" onClick={refillBoiler} disabled={gameState.isGameOver}>
            Refill Boiler
          </button>
        </div>

        <section className="fact-box" aria-live="polite">
          <h2>Lembang Heritage Fact</h2>
          <p>
            {activeFact ||
              'Reach your first 50 kg of processed tea to unlock a historical fact about Lembang\'s colonial tea industry.'}
          </p>
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