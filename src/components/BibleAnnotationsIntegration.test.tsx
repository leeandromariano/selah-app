import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BibleReader } from './BibleReader'
import { demoProvider } from '../bible/provider'
import type { AnnotationStore, BibleAnnotation } from '../bible/annotations'

vi.mock('../bible/annotationsFeature', () => ({ bibleAnnotationsEnabled: true }))
vi.mock('../bible/fums', () => ({ reportBibleView: vi.fn().mockResolvedValue(undefined) }))

describe('isolamento das anotações na leitura', () => {
  it('não mostra a resposta atrasada da conta anterior depois de trocar de conta', async () => {
    let finish!: (value: BibleAnnotation[]) => void
    const previous = new Promise<BibleAnnotation[]>(resolve => { finish = resolve })
    const store = { list: vi.fn((userId: string) => userId === 'user-a' ? previous : Promise.resolve([])), save: vi.fn(), remove: vi.fn(), listFavorites: vi.fn().mockResolvedValue([]), listAllFavorites: vi.fn().mockResolvedValue([]), addFavorite: vi.fn(), removeFavorite: vi.fn() }
    const source = { ...demoProvider, translations: [{ ...demoProvider.translations[0], id: 'nvt', name: 'NVT' }], chapterDetails: vi.fn().mockResolvedValue({ verses: [{ number: 1, text: 'Texto fictício' }], copyright: 'Atribuição fictícia', fumsToken: 'ficticio' }) }
    const view = render(<BibleReader page="biblia/nvt/genesis/1" source={source} userId="user-a" annotationStore={store as AnnotationStore} />)
    await waitFor(() => expect(store.list).toHaveBeenCalledWith('user-a', expect.objectContaining({ book: 'genesis' })))
    view.rerender(<BibleReader page="biblia/nvt/genesis/1" source={source} userId="user-b" annotationStore={store as AnnotationStore} />)
    await waitFor(() => expect(store.list).toHaveBeenCalledWith('user-b', expect.objectContaining({ book: 'genesis' })))
    await act(async () => finish([{ user_id: 'user-a', translation: 'nvt', book: 'genesis', chapter: 1, verse_start: 1, verse_end: 1, color: 'pink', note: 'Nota privada fictícia' }]))
    expect(screen.queryByText('Nota privada fictícia')).not.toBeInTheDocument()
    expect(document.getElementById('bible-verse-1')).not.toHaveClass('bible-mark-pink')
  })
})
