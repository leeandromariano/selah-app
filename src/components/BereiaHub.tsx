import { BibleReference } from './BibleReference'
import { Heading } from './UI'

const games = [
  { href: '#bereia/quiz', title: 'Quiz bíblico', description: 'Perguntas de múltipla escolha em quatro níveis, do Iniciante ao Bigode grosso.' },
  { href: '#bereia/mito', title: 'Tá na Bíblia ou Tá Amarrado?', description: 'Cinco cartas: arraste para dizer se a frase está mesmo na Bíblia.' },
  { href: '#bereia/quem-disse', title: 'Quem disse isso?', description: 'Uma frase da Bíblia e quatro personagens: quem a pronunciou? Modo Base e Modo Profundo.' },
]

export function BereiaHub() {
  return <>
    <Heading eyebrow="EXAMINE AS ESCRITURAS" title="Bereia" description="Os cristãos de Bereia examinavam as Escrituras todos os dias para conferir se tudo era verdade. Aqui você faz o mesmo, jogando." />
    <p className="muted">Inspirado em <BibleReference reference="Atos 17:11" />.</p>
    <div className="quiz-modes" role="group" aria-label="Jogos">{games.map(game => <a key={game.href} className="quiz-mode" href={game.href}><span className="quiz-mode-text"><strong>{game.title}</strong><span>{game.description}</span></span><span className="quiz-mode-go" aria-hidden="true">→</span></a>)}</div>
  </>
}
