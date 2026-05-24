import { CloudDownload, Download, Layers, Plane, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { revisionApi } from '../api/client.js'

const PACK_KEY = 'codeshelf_travel_pack'
const PROGRESS_KEY = 'codeshelf_offline_reviews'

export default function TravelMode() {
  const [pack, setPack] = useState(null)
  const [message, setMessage] = useState('')
  const cards = pack?.cards || []
  const topics = useMemo(() => [...new Set(cards.map((card) => card.topic || 'General'))], [cards])
  const packSize = pack ? `${Math.max(1, Math.round(JSON.stringify(pack).length / 1024))} KB` : '0 KB'

  useEffect(() => {
    const stored = localStorage.getItem(PACK_KEY)
    if (stored) setPack(JSON.parse(stored))
  }, [])

  async function downloadPack() {
    const data = await revisionApi.travelPack()
    localStorage.setItem(PACK_KEY, JSON.stringify(data))
    setPack(data)
    setMessage('Today revision pack saved for offline use.')
  }

  function markOffline(card, rating) {
    const current = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]')
    current.push({ card_id: card.id, rating })
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(current))
    setMessage('Saved offline progress. Sync when internet returns.')
  }

  async function sync() {
    const reviews = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]')
    const data = await revisionApi.syncOffline(reviews)
    localStorage.removeItem(PROGRESS_KEY)
    setMessage(`${data.synced.length} offline reviews synced.`)
  }

  return (
    <div className="page travel-page">
      <section className="travel-hero">
        <div>
          <p className="eyebrow">Offline pack manager</p>
          <h1>Travel Mode</h1>
          <p>Download a focused revision pack and keep reviewing without internet.</p>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={downloadPack}><Download size={16} /> Download Pack</button>
            <button className="btn btn-secondary" onClick={sync}><UploadCloud size={16} /> Sync Progress</button>
          </div>
        </div>
        <div className="travel-plane" aria-hidden="true"><Plane size={54} /></div>
      </section>
      {message ? <p className="recall-answer">{message}</p> : null}
      <div className="travel-stats">
        <PackStat icon={Layers} label="Notes" value={topics.length} />
        <PackStat icon={CloudDownload} label="Flashcards" value={cards.length} />
        <PackStat icon={Download} label="Pack size" value={packSize} />
        <PackStat icon={UploadCloud} label="Last synced" value={cards.length ? 'Ready' : 'Not yet'} />
      </div>
      <div className="dashboard-bento travel-bento">
        <section className="bento-panel pack-panel">
          <div className="section-header"><h2>Pack Contents</h2><span className="topic-chip">{topics.length} topics</span></div>
          <div className="subject-progress">
            {topics.map((topic, index) => <ProgressLine key={topic} label={topic} value={Math.max(12, 72 - index * 9)} />)}
            {!topics.length ? <TravelEmpty onDownload={downloadPack} /> : null}
          </div>
        </section>
        <section className="bento-panel timeline-panel">
          <h2>How Travel Mode Works</h2>
          <div className="timeline-steps">
            <span><Download size={16} /> Download curated due cards</span>
            <span><BookIcon /> Study anywhere</span>
            <span><UploadCloud size={16} /> Sync when online</span>
          </div>
        </section>
      </div>
      <div className="list-stack travel-card-list">
        {cards.map((card) => (
          <article className="revision-row" key={card.id}>
            <span>{card.question}</span>
            <small>{card.answer}</small>
            <div className="row-actions"><button className="btn btn-secondary" onClick={() => markOffline(card, 'forgot')}>Forgot</button><button className="btn btn-primary" onClick={() => markOffline(card, 'good')}>Knew it</button></div>
          </article>
        ))}
      </div>
    </div>
  )
}

function PackStat({ icon: Icon, label, value }) {
  return <div className="pack-stat"><Icon size={18} /><strong>{value}</strong><span>{label}</span></div>
}

function ProgressLine({ label, value }) {
  return (
    <div className="progress-line" style={{ '--line-color': 'var(--accent)', '--line-value': `${value}%` }}>
      <span>{label}</span><div><i /></div><small>{value}%</small>
    </div>
  )
}

function TravelEmpty({ onDownload }) {
  return (
    <div className="visual-empty">
      <div className="empty-illustration"><CloudDownload size={32} /></div>
      <h3>No offline pack yet</h3>
      <p>Download today's pack before travel and CodeShelf will keep your recall queue close.</p>
      <button className="btn btn-primary compact" onClick={onDownload}>Download now</button>
    </div>
  )
}

function BookIcon() {
  return <Layers size={16} />
}
