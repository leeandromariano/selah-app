import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import type { AppearanceStore } from './store'

const source = readFileSync('public/appearance.js', 'utf8')
function boot({ saved = null, dark = false, denied = false, quota = false, noMedia = false, legacy = false }: { saved?: string | null; dark?: boolean; denied?: boolean; quota?: boolean; noMedia?: boolean; legacy?: boolean } = {}) {
  const values = new Map(saved === null ? [] : [['selah.appearance.v1', saved]])
  const mediaListeners = new Set<() => void>(), events = new Map<string, (event: unknown) => void>()
  const media = {
    matches: dark,
    addEventListener: legacy ? undefined : (_: string, listener: () => void) => { mediaListeners.add(listener) },
    removeEventListener: legacy ? undefined : (_: string, listener: () => void) => { mediaListeners.delete(listener) },
    addListener: (listener: () => void) => { mediaListeners.add(listener) },
    removeListener: (listener: () => void) => { mediaListeners.delete(listener) },
  }
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (quota) throw Error('quota'); values.set(key,value) } }
  const document = { documentElement: { dataset: {} as { theme?: string }, style: {} as { colorScheme?: string } } }
  const window = {
    get localStorage() { if (denied) throw Error('SecurityError'); return storage },
    matchMedia: () => { if (noMedia) throw Error('not supported'); return media },
    addEventListener: (name: string, listener: (event: unknown) => void) => events.set(name,listener),
    removeEventListener: (name: string) => events.delete(name),
    selahAppearance: undefined as AppearanceStore | undefined,
  }
  runInNewContext(source,{ window, document })
  return { store: window.selahAppearance!, values, root: document.documentElement, events, mediaListeners, storage,
    changeSystem(value: boolean) { media.matches=value; mediaListeners.forEach(listener => listener()) },
    storageEvent(key: string | null, newValue: string | null, storageArea: unknown = storage) { events.get('storage')?.({ key,newValue,storageArea }) },
    bootAgain() { runInNewContext(source,{ window,document }) },
  }
}
describe('bootstrap real de aparência, independente de React e autenticação', () => {
  it('sem preferência inicia no escuro antes de qualquer montagem', () => {
    const value=boot({dark:true})
    expect(value.store.getSnapshot()).toMatchObject({preference:'dark',resolved:'dark'})
    expect(value.root.dataset.theme).toBe('dark')
    expect(value.root.style.colorScheme).toBe('dark')
    expect(value.values.size).toBe(0)
  })
  it.each(['light','dark'] as const)('preferência explícita %s vence sistema e suas mudanças', preference => {
    const value=boot({saved:preference,dark:preference==='light'})
    expect(value.root.dataset.theme).toBe(preference)
    value.changeSystem(false);value.changeSystem(true)
    expect(value.root.dataset.theme).toBe(preference)
  })
  it('Sistema acompanha mudanças em tempo real sem persistir a resolução', () => {
    const value=boot({saved:'system'})
    value.changeSystem(true)
    expect(value.store.getSnapshot()).toMatchObject({preference:'system',resolved:'dark'})
    expect(value.values.get('selah.appearance.v1')).toBe('system')
    value.changeSystem(false)
    expect(value.root.dataset.theme).toBe('light')
  })
  it('salva apenas enum e restaura em nova inicialização após refresh', () => {
    const value=boot()
    value.store.setPreference('dark')
    expect([...value.values]).toEqual([['selah.appearance.v1','dark']])
    expect(boot({saved:value.values.get('selah.appearance.v1')}).root.dataset.theme).toBe('dark')
    value.store.setPreference('system');value.changeSystem(true)
    expect(value.values.get('selah.appearance.v1')).toBe('system')
  })
  it.each(['broken','{"theme":"dark"}','<script>bad</script>','', 'DARK'])('storage inválido %j cai em Escuro sem executar conteúdo', saved => {
    expect(boot({saved,dark:true}).root.dataset.theme).toBe('dark')
    expect(boot({saved}).store.getSnapshot().preference).toBe('dark')
  })
  it('storage negado ou cheio não impede seleção na aba', () => {
    for(const options of [{denied:true},{quota:true}]) {
      const value=boot(options)
      value.store.setPreference('dark')
      expect(value.root.dataset.theme).toBe('dark')
      expect(value.store.getSnapshot().persistent).toBe(false)
      expect(value.values.size).toBe(0)
    }
  })
  it('ausência de matchMedia mantém Escuro, mas permite escolha explícita', () => {
    const value=boot({noMedia:true})
    expect(value.root.dataset.theme).toBe('dark')
    value.store.setPreference('dark')
    expect(value.root.dataset.theme).toBe('dark')
  })
  it('sincroniza outra aba, remoção e limpeza; ignora outras chaves/storage', () => {
    const value=boot({saved:'light',dark:true})
    value.storageEvent('another.setting','dark')
    value.storageEvent('selah.appearance.v1','dark',{})
    expect(value.root.dataset.theme).toBe('light')
    value.storageEvent('selah.appearance.v1','dark')
    expect(value.store.getSnapshot().preference).toBe('dark')
    value.storageEvent('selah.appearance.v1',null)
    expect(value.store.getSnapshot().preference).toBe('dark')
    value.store.setPreference('light');value.storageEvent(null,null)
    expect(value.root.dataset.theme).toBe('dark')
  })
  it('assina sem notificações redundantes, ignora valores não permitidos e limpa listeners', () => {
    const value=boot({saved:'system'});let changes=0
    const unsubscribe=value.store.subscribe(()=>changes++)
    value.store.setPreference('system')
    expect(changes).toBe(0)
    value.store.setPreference('dark');expect(changes).toBe(1)
    value.store.setPreference('bad' as never);expect(changes).toBe(1)
    unsubscribe();value.store.setPreference('light');expect(changes).toBe(1)
    value.bootAgain();expect(value.mediaListeners.size).toBe(1)
    value.store.dispose();expect(value.mediaListeners.size).toBe(0);expect(value.events.size).toBe(0)
  })
  it('suporta listener legado de mídia com cleanup', () => {
    const value=boot({legacy:true});value.changeSystem(true)
    expect(value.root.dataset.theme).toBe('dark')
    value.store.dispose();expect(value.mediaListeners.size).toBe(0)
  })
})
