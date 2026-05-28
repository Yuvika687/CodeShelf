import { ChevronDown, Eye, Headphones, Mic, Pause, Play, Repeat2, Settings2, SkipForward, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { revisionApi } from '../api/client.js'
import NebulaParticles from '../components/NebulaParticles.jsx'

const VOICE_PROFILES = [
  { id: 'natural', label: 'Natural', rate: 0.92, pitch: 1.0, desc: 'Clear & balanced' },
  { id: 'calm', label: 'Professor', rate: 0.82, pitch: 0.9, desc: 'Slow & authoritative' },
  { id: 'energetic', label: 'Coach', rate: 1.05, pitch: 1.1, desc: 'Upbeat & motivating' },
  { id: 'deep', label: 'Deep Focus', rate: 0.75, pitch: 0.7, desc: 'Slow deep thinker' },
  { id: 'whisper', label: 'Whisper', rate: 0.85, pitch: 1.15, desc: 'Soft & quiet study' },
  { id: 'fast', label: 'Speed Run', rate: 1.3, pitch: 1.0, desc: 'Rapid fire review' },
]

export default function WalkMode() {
  const [cards, setCards] = useState([])
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceProfile, setVoiceProfile] = useState(VOICE_PROFILES[0])
  const [systemVoice, setSystemVoice] = useState(null)
  const [availableVoices, setAvailableVoices] = useState([])
  const [showVoicePanel, setShowVoicePanel] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const card = cards[index]
  const utterRef = useRef(null)

  useEffect(() => {
    revisionApi.walkMode().then((data) => setCards(data.cards || []))
  }, [])

  // Load system voices
  useEffect(() => {
    function loadVoices() {
      const voices = window.speechSynthesis?.getVoices() || []
      if (voices.length) {
        setAvailableVoices(voices)
        // Try to pick good default voices
        const preferred = voices.find(v =>
          /samantha|zira|david|google us|google uk|karen|moira|daniel|fiona|tessa/i.test(v.name)
        )
        if (preferred) setSystemVoice(preferred)
      }
    }
    loadVoices()
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices)
  }, [])

  function speak(text, onEnd) {
    window.speechSynthesis?.cancel()
    if (!text) return
    const u = new SpeechSynthesisUtterance(text)
    u.rate = voiceProfile.rate
    u.pitch = voiceProfile.pitch
    u.volume = voiceProfile.id === 'whisper' ? 0.5 : 0.9
    if (systemVoice) u.voice = systemVoice
    u.onstart = () => setSpeaking(true)
    u.onend = () => { setSpeaking(false); onEnd?.() }
    u.onerror = () => setSpeaking(false)
    utterRef.current = u
    window.speechSynthesis?.speak(u)
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  function speakQuestion() {
    if (!card) return
    const intro = voiceProfile.id === 'calm'
      ? `Question number ${index + 1}. ${card.question}`
      : voiceProfile.id === 'coach'
        ? `Alright! Question ${index + 1}! ${card.question}`
        : `Question ${index + 1}. ${card.question}`
    speak(intro)
  }

  function speakAnswer() {
    if (!card) return
    const intro = voiceProfile.id === 'calm'
      ? `The answer is: ${card.answer}`
      : voiceProfile.id === 'coach'
        ? `Here's the answer! ${card.answer}`
        : card.answer
    speak(intro)
  }

  function speakFull() {
    if (!card) return
    speak(`Question ${index + 1}. ${card.question}`, () => {
      setTimeout(() => {
        speak(`Answer: ${card.answer}`)
      }, 600)
    })
  }

  async function rate(rating) {
    if (card) await revisionApi.review(card.id, rating)
    setShowAnswer(false)
    stopSpeaking()
    const nextIdx = Math.min(index + 1, cards.length - 1)
    setIndex(nextIdx)
    if (autoPlay && cards[nextIdx]) {
      setTimeout(() => {
        speak(`Question ${nextIdx + 1}. ${cards[nextIdx].question}`)
      }, 500)
    }
  }

  function nextCard() {
    setShowAnswer(false)
    stopSpeaking()
    setIndex((c) => Math.min(c + 1, cards.length - 1))
  }

  const bars = Array.from({ length: 48 }, (_, i) => {
    const d = Math.abs(i - 24) / 24
    return { h: Math.max(0.12, 1 - d * d), delay: i * 0.032 }
  })

  // Group English-like voices
  const groupedVoices = availableVoices.reduce((acc, v) => {
    const lang = v.lang?.split('-')[0] || 'other'
    if (!acc[lang]) acc[lang] = []
    acc[lang].push(v)
    return acc
  }, {})

  return (
    <div className="wk">
      <NebulaParticles starCount={120} nebulaCount={4} />

      <div className="wk-top">
        <span className="wk-pill">🎧 Walk Mode • Question {Math.min(index + 1, cards.length)}/{cards.length || 0}</span>
        <h1 className="wk-h1">Learn by listening.<br /><em>Anytime, anywhere.</em></h1>
        <p className="wk-sub">Audio-first revision for learning on the go.</p>
      </div>

      <div className="wk-mid">
        <div className="wk-visualizer">
          {/* Left wave bars */}
          <div className="wk-wave-half wk-wave-left">
            {bars.slice(0, 24).map((b, i) => <span key={i} className={`wk-bar ${speaking ? 'active' : ''}`} style={{ '--h': b.h, '--d': `${b.delay}s` }} />)}
          </div>
          {/* Center orb */}
          <div className={`wk-orb ${speaking ? 'is-speaking' : ''}`}>
            <Headphones size={36} />
            <i className="wk-ring r1" />
            <i className="wk-ring r2" />
            <i className="wk-ring r3" />
          </div>
          {/* Right wave bars */}
          <div className="wk-wave-half wk-wave-right">
            {bars.slice(24).map((b, i) => <span key={i} className={`wk-bar ${speaking ? 'active' : ''}`} style={{ '--h': b.h, '--d': `${b.delay}s` }} />)}
          </div>
        </div>
      </div>

      {/* Voice Control Strip */}
      <div className="wk-voice-strip">
        <button className="wk-voice-toggle" onClick={() => setShowVoicePanel(!showVoicePanel)}>
          <Settings2 size={14} />
          <span>{voiceProfile.label}</span>
          <ChevronDown size={12} style={{ transform: showVoicePanel ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>
        <button className={`wk-auto-btn ${autoPlay ? 'active' : ''}`} onClick={() => setAutoPlay(!autoPlay)}>
          {autoPlay ? <Pause size={12} /> : <Play size={12} />}
          <span>Auto</span>
        </button>
        {systemVoice && (
          <span className="wk-voice-name">
            🗣️ {systemVoice.name.split(' ').slice(0, 2).join(' ')}
          </span>
        )}
      </div>

      {/* Voice Panel */}
      {showVoicePanel && (
        <div className="wk-voice-panel">
          <div className="wk-voice-section">
            <small>Voice Style</small>
            <div className="wk-voice-grid">
              {VOICE_PROFILES.map(vp => (
                <button
                  key={vp.id}
                  className={`wk-voice-card ${voiceProfile.id === vp.id ? 'active' : ''}`}
                  onClick={() => { setVoiceProfile(vp); speak('Testing ' + vp.label + ' voice') }}
                >
                  <strong>{vp.label}</strong>
                  <span>{vp.desc}</span>
                </button>
              ))}
            </div>
          </div>
          {availableVoices.length > 0 && (
            <div className="wk-voice-section">
              <small>System Voice</small>
              <select
                className="input wk-voice-select"
                value={systemVoice?.name || ''}
                onChange={e => {
                  const v = availableVoices.find(av => av.name === e.target.value)
                  if (v) { setSystemVoice(v); speak('Hello, I am ' + v.name.split(' ').slice(0, 2).join(' ')) }
                }}
              >
                {(groupedVoices['en'] || availableVoices).map(v => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="wk-bottom">
        {card ? (
          <div className="wk-q">
            <small>Your question</small>
            <h2>{card.question}</h2>
            <p>{card.difficulty} • {card.topic}</p>
          </div>
        ) : (
          <div className="wk-q">
            <h2>No walk cards due.</h2>
            <p>Add notes and generate cards to use Walk Mode</p>
          </div>
        )}

        {showAnswer && card ? <div className="wk-ans"><p>{card.answer}</p></div> : null}

        <div className="wk-btns">
          <button className="btn btn-secondary" onClick={speaking ? stopSpeaking : speakQuestion}>
            {speaking ? <Pause size={16} /> : <Volume2 size={16} />}
            {speaking ? 'Stop' : 'Speak'}
          </button>
          <button className="btn btn-secondary" onClick={speakAnswer}><Repeat2 size={16} /> Repeat Answer</button>
          <button className="btn btn-secondary" onClick={speakFull}><Mic size={16} /> Full Read</button>
          <button className="btn btn-secondary" onClick={nextCard}><SkipForward size={16} /> Skip</button>
          <button className="btn btn-primary wk-show" onClick={() => setShowAnswer(true)}><Eye size={16} /> Show Answer</button>
        </div>

        {showAnswer && card ? (
          <div className="wk-rate">
            <button className="btn wk-forgot" onClick={() => rate('forgot')}>I forgot</button>
            <button className="btn wk-knew" onClick={() => rate('good')}>I knew it</button>
          </div>
        ) : null}

        <small className="wk-hint">🎧 Use headphones for the best experience</small>
      </div>
    </div>
  )
}
