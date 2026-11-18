import { useState, type ReactNode } from 'react'

// Render 3D do LOGOS em public/assets/3d/logos/<nome>.webp. Se o arquivo ainda não existir, mostra o desenho de reserva (SVG ou glifo).
export function Art3D({ name, fallback, alt = '', className = '' }: { name: string; fallback: ReactNode; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <>{fallback}</>
  return <img className={`lg-art ${className}`.trim()} src={`/assets/3d/logos/${name}.webp`} alt={alt} draggable={false} decoding="async" onError={() => setFailed(true)} />
}
