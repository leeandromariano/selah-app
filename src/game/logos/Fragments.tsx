import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { BibleReference } from '../../components/BibleReference'
import { acts, phases } from './campaign'
import { createLogosRepository, type Fragment } from './repository'

const romans = ['I', 'II', 'III', 'IV']

// Os 16 Fragmentos Bíblicos da campanha: os coletados mostram a referência (com link para a Bíblia) e o tema; os outros ficam trancados.
export function FragmentsGrid({ fragments }: { fragments: Fragment[] }) {
  const got = new Map(fragments.map(f => [f.phase, f]))
  return <div className="lg-fragments">
    {acts.map(a => <section key={a.id} aria-label={`Ato ${romans[a.id - 1]}: ${a.name}`}>
      <h3>ATO {romans[a.id - 1]} · {a.name}</h3>
      <ul>{phases.filter(p => p.act === a.id).map(p => { const f = got.get(p.id); return <li key={p.id} data-got={!!f}>
        {f ? <><small>FASE {p.index} · {p.name}</small><strong><BibleReference reference={f.reference} /></strong><span>{p.theme}</span></>
          : <><small>FASE {p.index}</small><strong aria-label="Fragmento ainda não coletado">• • •</strong><span>Ainda não coletado</span></>}
      </li> })}</ul>
    </section>)}
  </div>
}

const defaultRepository = createLogosRepository(supabase)

// Seção da Minha Jornada: progresso e fragmentos do LOGOS. Se não der para carregar, some sem atrapalhar o resto da página.
export function JourneyLogos({ repo = defaultRepository }: { repo?: Pick<typeof defaultRepository, 'campaign'> }) {
  const [fragments, setFragments] = useState<Fragment[] | null>(null)
  useEffect(() => {
    let active = true
    Promise.resolve().then(() => repo.campaign()).then(list => { if (active) setFragments(list) }).catch(() => { if (active) setFragments(null) })
    return () => { active = false }
  }, [repo])
  if (!fragments) return null
  return <section className="journey-logos" aria-labelledby="journey-logos-title">
    <div className="journey-logos-head"><h2 id="journey-logos-title">Fragmentos Bíblicos</h2><span>{fragments.length} de {phases.length} · CORAM // LOGOS</span></div>
    {fragments.length === 0 && <p className="muted">Vença as fases do Modo História do CORAM // LOGOS para colecionar um fragmento por fase. <a className="text-link" href="#bereia/logos">Jogar agora →</a></p>}
    <FragmentsGrid fragments={fragments} />
  </section>
}
