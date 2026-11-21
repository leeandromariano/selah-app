import type { StudyPanorama } from '../study/repository'
import '../study.css'

// Ficha técnica de um livro, estilo pôster: autor, para quem foi escrito, contexto em uma frase e tema central.
// Recolhida por padrão: só o título aparece até a pessoa abrir. Só é mostrada no modo Estudo, antes do capítulo 1.
export function BookPanorama({ bookName, panorama }: { bookName: string; panorama: StudyPanorama }) {
  const items = [
    ['Autor', panorama.author],
    ['Para quem foi escrito', panorama.audience],
    ['Contexto', panorama.context],
    ['Tema central', panorama.theme],
  ] as const
  return <details className="study-panorama">
    <summary><span className="eyebrow">PANORAMA DO LIVRO</span><strong>{bookName}</strong><span className="study-panorama-hint" aria-hidden="true">Ficha técnica</span></summary>
    <dl>{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </details>
}
