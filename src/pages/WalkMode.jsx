import { ChevronDown, Eye, Headphones, Mic, Pause, Play, Repeat2, Settings2, SkipForward, Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { revisionApi } from '../api/client.js'
import NebulaParticles from '../components/NebulaParticles.jsx'

export default function WalkMode() {
  const [cards, setCards] = useState([])
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState(null)
  const [voices, setVoices] = useState([])
  const [showVoicePanel, setShowVoicePanel] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const card = cards[index]
  const utterRef = useRef(null)

  useEffect(() => {
    revisionApi.walkMode().then((data) => setCards(data.cards || []))
  }, [])

  // Load ALL browser voices
  useEffect(() => {
    function loadVoices() {
      const all = window.speechSynthesis?.getVoices() || []
      if (!all.length) return
      setVoices(all)
      const preferred = all.find(v =>
        /google us english|google uk english|samantha|daniel|karen|microsoft david|microsoft zira|microsoft mark|moira|fiona|tessa|alex/i.test(v.name)
      ) || all.find(v => v.lang?.startsWith('en'))
      if (preferred && !selectedVoice) setSelectedVoice(preferred)
    }
    loadVoices()
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices)
  }, [])

  function speak(text, onEnd) {
    window.speechSynthesis?.cancel()
    if (!text) return
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.92
    u.pitch = 1.0
    if (selectedVoice) u.voice = selectedVoice
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
    speak(`Question ${index + 1}. ${card.question}`)
  }

  function speakAnswer() {
    if (!card) return
    speak(card.answer)
  }

  function speakFull() {
    if (!card) return
    speak(`Question ${index + 1}. ${card.question}`, () => {
      setTimeout(() => speak(`Answer: ${card.answer}`), 600)
    })
  }

  function previewVoice(voice) {
    setSelectedVoice(voice)
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(`Hi, I am ${voice.name.split(' ').slice(0, 3).join(' ')}`)
    u.voice = voice
    u.rate = 0.92
    u.onstart = () => setSpeaking(true)
    u.onend = () => setSpeaking(false)
    window.speechSynthesis?.speak(u)
  }

  async function rate(rating) {
    if (card) await revisionApi.review(card.id, rating)
    setShowAnswer(false)
    stopSpeaking()
    const nextIdx = Math.min(index + 1, cards.length - 1)
    setIndex(nextIdx)
    if (autoPlay && cards[nextIdx]) {
      setTimeout(() => speak(`Question ${nextIdx + 1}. ${cards[nextIdx].question}`), 500)
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

  // Group voices by language — English first
  const grouped = {}
  voices.forEach(v => {
    const lang = v.lang || 'unknown'
    const key = lang.startsWith('en') ? 'English' : lang.split('-')[0].toUpperCase()
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(v)
  })
  const langOrder = ['English', ...Object.keys(grouped).filter(k => k !== 'English').sort()]

  function shortName(voice) {
    return voice.name
      .replace(/Microsoft /gi, '')
      .replace(/Google /gi, '')
      .replace(/Apple /gi, '')
      .replace(/ \(Natural\)/gi, '')
      .replace(/ Online$/gi, '')
      .trim()
  }

  function voiceEmoji(voice) {
    const n = voice.name.toLowerCase()
    if (/female|zira|samantha|karen|fiona|moira|tessa|hazel|susan|jenny|aria|sara/i.test(n)) return '👩'
    if (/male|david|daniel|mark|james|alex|guy|ryan|christopher|roger/i.test(n)) return '👨'
    if (/google/i.test(n)) return '🤖'
    return '🗣️'
  }

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
          <div className="wk-wave-half wk-wave-left">
            {bars.slice(0, 24).map((b, i) => <span key={i} className={`wk-bar ${speaking ? 'active' : ''}`} style={{ '--h': b.h, '--d': `${b.delay}s` }} />)}
          </div>
          <div className={`wk-orb ${speaking ? 'is-speaking' : ''}`}>
            <Headphones size={36} />
            <i className="wk-ring r1" />
            <i className="wk-ring r2" />
            <i className="wk-ring r3" />
          </div>
          <div className="wk-wave-half wk-wave-right">
            {bars.slice(24).map((b, i) => <span key={i} className={`wk-bar ${speaking ? 'active' : ''}`} style={{ '--h': b.h, '--d': `${b.delay}s` }} />)}
          </div>
        </div>
      </div>

      {/* Voice Control Strip */}
      <div className="wk-voice-strip">
        <button className="wk-voice-toggle" onClick={() => setShowVoicePanel(!showVoicePanel)}>
          <Settings2 size={14} />
          <span>{selectedVoice ? `${voiceEmoji(selectedVoice)} ${shortName(selectedVoice)}` : 'Pick Voice'}</span>
          <ChevronDown size={12} style={{ transform: showVoicePanel ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>
        <button className={`wk-auto-btn ${autoPlay ? 'active' : ''}`} onClick={() => setAutoPlay(!autoPlay)}>
          {autoPlay ? <Pause size={12} /> : <Play size={12} />}
          <span>Auto</span>
        </button>
        {selectedVoice && (
          <span className="wk-voice-name">{selectedVoice.lang}</span>
        )}
      </div>

      {/* FLOATING Voice Picker — positioned absolute so overflow:hidden doesn't clip */}
      {showVoicePanel && (
        <div className="wk-voice-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowVoicePanel(false) }}>
          <div className="wk-voice-panel">
            <div className="wk-voice-panel-head">
              <strong>Choose a Voice</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>{voices.length} voices</span>
                <button className="wk-voice-close" onClick={() => setShowVoicePanel(false)}><X size={16} /></button>
              </div>
            </div>
            <div className="wk-voice-scroll">
              {langOrder.map(lang => {
                const langVoices = grouped[lang]
                if (!langVoices?.length) return null
                return (
                  <div key={lang} className="wk-voice-lang-group">
                    <small className="wk-voice-lang-label">{lang} ({langVoices.length})</small>
                    <div className="wk-voice-grid">
                      {langVoices.map(v => (
                        <button
                          key={v.name}
                          className={`wk-voice-card ${selectedVoice?.name === v.name ? 'active' : ''}`}
                          onClick={() => previewVoice(v)}
                        >
                          <span className="wk-vc-emoji">{voiceEmoji(v)}</span>
                          <div className="wk-vc-info">
                            <strong>{shortName(v)}</strong>
                            <span>{v.lang}{v.localService ? '' : ' • Online'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              {!voices.length && (
                <p className="wk-no-voices">Loading voices... Your browser is preparing text-to-speech engines.</p>
              )}
            </div>
          </div>
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
