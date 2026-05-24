import { Download, UploadCloud } from 'lucide-react'
import { useEffect, useState } from 'react'
import { revisionApi } from '../api/client.js'
import { PageTitle } from './Upload.jsx'

const PACK_KEY = 'codeshelf_travel_pack'
const PROGRESS_KEY = 'codeshelf_offline_reviews'

export default function TravelMode() {
  const [pack, setPack] = useState(null)
  const [message, setMessage] = useState('')

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
      <PageTitle title="Travel Mode" subtitle="Download today's revision pack and review without internet." />
      <div className="form-actions">
        <button className="btn btn-primary" onClick={downloadPack}><Download size={16} /> Download Today's Pack</button>
        <button className="btn btn-secondary" onClick={sync}><UploadCloud size={16} /> Sync Offline Progress</button>
      </div>
      {message ? <p className="recall-answer">{message}</p> : null}
      <div className="list-stack">
        {(pack?.cards || []).map((card) => (
          <article className="card revision-row" key={card.id}>
            <span>{card.question}</span>
            <small>{card.answer}</small>
            <div className="row-actions"><button className="btn btn-secondary" onClick={() => markOffline(card, 'forgot')}>Forgot</button><button className="btn btn-primary" onClick={() => markOffline(card, 'good')}>Knew it</button></div>
          </article>
        ))}
        {!pack?.cards?.length ? <p className="muted empty-state">No offline pack downloaded yet.</p> : null}
      </div>
    </div>
  )
}
