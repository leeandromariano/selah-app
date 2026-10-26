import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { devotionals } from '../data/devotionals'
import { DevotionalCard } from './UI'

it('aciona a abertura do devocional associado ao card pelo teclado', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  const item = devotionals[1]
  render(<DevotionalCard item={item} onOpen={onOpen} />)
  expect(onOpen).not.toHaveBeenCalled()
  await user.tab()
  expect(screen.getByRole('button', { name: new RegExp(item.title) })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(onOpen).toHaveBeenCalledExactlyOnceWith(item.id)
})
