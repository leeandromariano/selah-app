import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source=readFileSync('src/appearance/tokens.css','utf8')
function luminance(hex: string) {
  const channels=hex.slice(1).match(/../g)!.map(channel=>parseInt(channel,16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4)
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722
}
describe('contraste da paleta CSS real',()=>{
  for(const [index,theme] of ['light','dark'].entries()) it(`${theme}: textos >=4.5:1 e controles/foco >=3:1`,()=>{
    const block=source.match(/:root(?:\[data-theme="dark"\])?\s*\{([^}]+)\}/g)![index]
    const palette=Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]+);/g)].map(match=>[match[1],match[2]]))
    const contrast=(first:string,second:string)=>{
      const a=luminance(palette[first]),b=luminance(palette[second])
      return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)
    }
    for(const bg of ['page','surface','surface-soft','surface-hover','accent-bg']) {
      for(const fg of ['text','text-muted','accent','error']) expect(contrast(fg,bg),`${theme}: ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast('focus',bg),`${theme}: focus/${bg}`).toBeGreaterThanOrEqual(3)
    }
    for(const bg of ['surface','page']) expect(contrast('control-border',bg)).toBeGreaterThanOrEqual(3)
    for(const bg of ['action-bg','action-hover']) expect(contrast('on-action',bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrast('success','success-bg')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('hero-muted','hero-bg')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('on-hero','hero-bg')).toBeGreaterThanOrEqual(4.5)
  })
})
