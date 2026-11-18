import { BibleReference } from './BibleReference'
import { bereiaGames as games } from '../bereia/games'
import '../bereia-v2.css'

export function BereiaHub() {
  return <div className="bereia-v2">
    <div className="page-heading bereia-heading"><div className="eyebrow">EXAMINE AS ESCRITURAS</div><h1><em>Bereia Games</em></h1><p>Os cristãos de Bereia examinavam as Escrituras todos os dias para conferir se tudo era verdade. Aqui você faz o mesmo, jogando.</p></div>
    <p className="muted">Inspirado em <BibleReference reference="Atos 17:11" />.</p>
    <a className="logos-hero" href="#bereia/logos"><span className="logos-hero-text"><small>NOVO · AÇÃO TÁTICA</small><strong>CORAM // LOGOS</strong><span>Vista a armadura de Efésios 6 e enfrente as trevas numa arena: ondas, Farol de Luz e quatro habilidades.</span></span><span className="logos-hero-go" aria-hidden="true">Jogar →</span></a>
    <div className="bereia-grid" role="group" aria-label="Jogos">{games.map(game => <a key={game.href} className="bereia-card" href={game.href}>
      <span className="bereia-card-text"><strong>{game.title}</strong><span>{game.description}</span></span>
      <span className="bereia-card-art" aria-hidden="true"><img src={`/home/${game.art}.webp`} alt="" width="120" height="120" loading="lazy" /></span>
      <span className="bereia-card-go" aria-hidden="true">→</span>
    </a>)}</div>
  </div>
}
