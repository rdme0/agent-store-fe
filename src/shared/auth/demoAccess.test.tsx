import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DisplayModeProvider, useDisplayMode } from '../../app/DisplayModeContext'
import { clearDemoAccess, currentDemoAccess, storeDemoAccess } from './demoAccess'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('demo access lifecycle', () => {
  it('persists and reads a not-yet-expired access record', () => {
    const access = {
      accessToken: 'fixture-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }

    storeDemoAccess(access)

    expect(currentDemoAccess()).toEqual(access)
  })

  it('removes an expired record before it can be used', () => {
    storeDemoAccess({
      accessToken: 'expired-token',
      expiresAt: new Date(Date.now() - 1).toISOString(),
    })

    expect(currentDemoAccess()).toBeUndefined()
    expect(window.localStorage.getItem('agentstore.demo-access')).toBeNull()
  })

  it('clears access and display mode while notifying the active shell', () => {
    window.localStorage.setItem('agentstore.demo-access', JSON.stringify({ accessToken: 'token', expiresAt: new Date(Date.now() + 60_000).toISOString() }))
    window.localStorage.setItem('agentstore.display-mode', 'developer')
    let notified = false
    window.addEventListener('agentstore-demo-access-ended', () => { notified = true }, { once: true })

    clearDemoAccess()

    expect(window.localStorage.getItem('agentstore.demo-access')).toBeNull()
    expect(window.localStorage.getItem('agentstore.display-mode')).toBeNull()
    expect(notified).toBe(true)
  })

  it('automatically leaves developer mode when the access expiry is reached', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-09-05T00:00:00.000Z')
    vi.setSystemTime(now)
    window.localStorage.setItem('agentstore.demo-access', JSON.stringify({ accessToken: 'short-lived', expiresAt: new Date(now.getTime() + 25).toISOString() }))
    window.localStorage.setItem('agentstore.display-mode', 'developer')

    function Probe() {
      return <span>{useDisplayMode().displayMode}</span>
    }
    render(<DisplayModeProvider><Probe /></DisplayModeProvider>)

    expect(screen.getByText('developer')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(25) })
    expect(screen.getByText('easy')).toBeInTheDocument()
    expect(window.localStorage.getItem('agentstore.demo-access')).toBeNull()
  })

  it('clears expired access while easy mode is selected', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-09-05T00:00:00.000Z')
    vi.setSystemTime(now)
    window.localStorage.setItem('agentstore.demo-access', JSON.stringify({ accessToken: 'short-lived-easy', expiresAt: new Date(now.getTime() + 25).toISOString() }))
    window.localStorage.setItem('agentstore.display-mode', 'easy')

    function Probe() {
      return <span>{useDisplayMode().displayMode}</span>
    }
    render(<DisplayModeProvider><Probe /></DisplayModeProvider>)

    expect(screen.getByText('easy')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(25) })
    expect(window.localStorage.getItem('agentstore.demo-access')).toBeNull()
  })
})
