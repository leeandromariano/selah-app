import { useEffect, useState } from 'react'
import './bible.css'

const key = 'selah.reading.fontSize'
const initial = () => {
  try {
    const value = Number(localStorage.getItem(key))
    return value >= 14 && value <= 26 ? value : 18
  } catch { return 18 }
}

export function ReadingFontControl() {
  const [size, setSize] = useState(initial)
  useEffect(() => {
    document.documentElement.style.setProperty('--reading-font-size', `${size}px`)
    try { localStorage.setItem(key, String(size)) } catch { /* optional preference */ }
  }, [size])
  return <div className="reading-font-control"><span aria-hidden="true">A</span><label htmlFor="reading-font-size">Tamanho da fonte</label><input id="reading-font-size" type="range" min="14" max="26" step="1" value={size} onChange={event => setSize(Number(event.target.value))} /><span aria-hidden="true" className="reading-font-large">A</span><span>{size}px</span></div>
}
