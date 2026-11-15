import { bereiaGames } from '../bereia/games'

// Bloco da Bereia na Home: três jogos com a arte 3D e o caminho para todos.
export function HomeBereia() {
  return <section className="home-bereia" aria-labelledby="home-bereia-title">
    <div className="section-heading"><div><div className="eyebrow">EXAMINE AS ESCRITURAS</div><h2 id="home-bereia-title">Bereia</h2></div><a className="text-link" href="#bereia">Ver todos →</a></div>
    <div className="home-bereia-grid">{bereiaGames.slice(0, 3).map(game => <a key={game.href} className="home-game" href={game.href}>
      <span className="home-game-text"><strong>{game.title}</strong><span>{game.description}</span><span className="home-game-arrow" aria-hidden="true">→</span></span>
      <span className="home-game-art" aria-hidden="true"><img src={`/home/${game.art}.webp`} alt="" width="96" height="96" loading="lazy" decoding="async" /></span>
    </a>)}</div>
  </section>
}
