import { ArrowRight, BookOpen, Brain, CalendarCheck, CheckCircle2, Code2, Flame, Plus, Route, ShieldAlert, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import NebulaParticles from '../components/NebulaParticles.jsx'

export default function Home() {
  const { user } = useAuth()
  const [db, setDb] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { dashboardApi.get().then(setDb).catch(e => setError(e.message)) }, [])

  const s = db?.stats || {}
  const due = db?.today?.due_cards || 0
  const streak = db?.streak?.current || 0
  const cards = db?.today?.cards || []
  const notes = db?.recent_notes || []
  const mistakes = db?.recent_mistakes || []

  return (
    <div className="cmd">
      <NebulaParticles starCount={130} nebulaCount={5} />
      <div className="cmd-scan" aria-hidden="true" />

      <header className="cmd-hdr">
        <div>
          <span className="cmd-tag">&gt; system.online</span>
          <h1 className="cmd-h1">Welcome, <em>{user?.name || 'Explorer'}</em></h1>
        </div>
        <nav className="cmd-pills">
          <Pill icon={CalendarCheck} v={due} l="DUE" c="var(--primary)" />
          <Pill icon={Flame} v={streak} l="STREAK" c="var(--orange)" />
          <Pill icon={BookOpen} v={s.notes||0} l="NOTES" c="var(--green)" />
          <Pill icon={Route} v={s.problems||0} l="PROBLEMS" c="var(--blue)" />
        </nav>
      </header>

      {error && <p className="form-error" style={{gridColumn:'1/-1'}}>{error}</p>}

      <aside className="cmd-l">
        <h4 className="cmd-lbl">&gt; revision_queue <span className="cmd-cnt">[{cards.length}]</span></h4>
        <div className="cmd-tl">
          {cards.slice(0,6).map(c=>(
            <div className="cmd-tl-row" key={c.id}>
              <div className="cmd-tl-pip" />
              <div><span>{c.question}</span><small>{c.topic} • {c.difficulty}</small></div>
            </div>
          ))}
          {!cards.length && <div className="cmd-nil"><Brain size={16}/><span>queue empty — add notes</span></div>}
        </div>
        <Link to="/revision/today" className="cmd-go clickable">&gt; open_queue <ArrowRight size={12}/></Link>
      </aside>

      <main className="cmd-c">
        <div className="cmd-brain" aria-hidden="true">
          <div className="cmd-br-glow"/>
          <div className="cmd-br-core"><Brain size={40}/></div>
          <div className="cmd-br-orbit o1"><span/><span/></div>
          <div className="cmd-br-orbit o2"><span/><span/></div>
          <div className="cmd-br-orbit o3"><span/><span/><span/></div>
          <div className="cmd-br-float f1"><Code2 size={12}/></div>
          <div className="cmd-br-float f2"><Sparkles size={12}/></div>
          <div className="cmd-br-float f3"><CheckCircle2 size={12}/></div>
          <div className="cmd-br-float f4"><Flame size={10}/></div>
        </div>
        <span className="cmd-tag">// memory_engine</span>
        <p className="cmd-sub">Your coding knowledge neural network</p>
        <div className="streak-beacon">
          <Flame size={18} />
          <strong>{streak} day streak</strong>
          <span>Longest: {db?.streak?.longest || 0}</span>
        </div>
        <div className="cmd-cta">
          <Link className="btn btn-primary cmd-glow clickable" to="/revision/today"><Brain size={15}/> Start Revision</Link>
          <Link className="btn btn-secondary clickable" to="/add-note"><Plus size={15}/> Add Learning</Link>
        </div>
      </main>

      <aside className="cmd-r">
        <h4 className="cmd-lbl">&gt; weak_topics</h4>
        <div className="cmd-rings">
          {groupTopics(mistakes).slice(0,4).map(([t,,p])=>(
            <div className="cmd-rng" key={t}>
              <Ring pct={p} color="var(--red)"/>
              <div><span>{t}</span><small>{p}%</small></div>
            </div>
          ))}
          {!mistakes.length && <div className="cmd-nil"><ShieldAlert size={16}/><span>no weak topics</span></div>}
        </div>
        <h4 className="cmd-lbl">&gt; recent_log</h4>
        <div className="cmd-log">
          {notes.slice(0,4).map(n=>(
            <Link className="cmd-log-row clickable" to={`/note/${n.id}`} key={n.id}>
              <CheckCircle2 size={11}/><span>{n.title}</span>
            </Link>
          ))}
          {!notes.length && <div className="cmd-nil"><BookOpen size={16}/><span>no activity</span></div>}
        </div>
      </aside>

      <footer className="cmd-f">
        <SubjectLine notes={notes}/>
      </footer>
    </div>
  )
}

function Pill({icon:I,v,l,c}){
  return <div className="cmd-pill" style={{'--c':c}}><I size={14}/><strong>{v}</strong><span>{l}</span></div>
}

function Ring({pct,color}){
  const r=16,circ=2*Math.PI*r
  return(
    <svg className="cmd-ring-svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="2.5"/>
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
        strokeLinecap="round" transform="rotate(-90 20 20)" style={{transition:'stroke-dashoffset .8s ease'}}/>
    </svg>
  )
}

function SubjectLine({notes}){
  const m={}
  ;(notes||[]).forEach(n=>{m[n.topic]=(m[n.topic]||0)+1})
  const e=Object.entries(m), t=e.reduce((s,[,c])=>s+c,0)||1
  const cols=['var(--primary)','var(--accent)','var(--blue)','var(--orange)','var(--green)']
  if(!e.length) return <div className="cmd-nil" style={{justifyContent:'center'}}><Plus size={14}/><span>add notes to see progress</span></div>
  return(
    <div className="cmd-sbar">
      <span className="cmd-tag">&gt; subject_progress</span>
      <div className="cmd-sbar-track">
        {e.slice(0,5).map(([topic,count],i)=>(
          <div key={topic} className="cmd-sbar-seg" style={{flex:count,background:cols[i%5]}} title={`${topic}: ${Math.round(count/t*100)}%`}/>
        ))}
      </div>
      <div className="cmd-sbar-labels">
        {e.slice(0,5).map(([topic],i)=>(
          <small key={topic} style={{color:cols[i%5]}}>{topic}</small>
        ))}
      </div>
    </div>
  )
}

function groupTopics(arr){
  const m={}
  arr.forEach(x=>{m[x.topic]=(m[x.topic]||0)+1})
  const t=arr.length||1
  return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,v,Math.round(v/t*100)])
}
