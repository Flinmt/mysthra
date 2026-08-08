import { describe, expect, it, vi } from 'vitest'
import { createCollaborationSessionCache } from './collaborationSessionCache'

class FakeAwareness {
  constructor() {
    this.clientID = 1
    this.localState = {}
  }

  getStates() {
    return new Map()
  }

  setLocalStateField(key, value) {
    this.localState = { ...(this.localState || {}), [key]: value }
  }

  setLocalState(value) {
    this.localState = value
  }
}

class FakeProvider {
  constructor(options) {
    this.options = options
    this.awareness = new FakeAwareness()
    this.listeners = new Map()
    this.destroy = vi.fn()
    this.connect = vi.fn()
    this.disconnect = vi.fn()
  }

  on(event, listener) {
    const listeners = this.listeners.get(event) || new Set()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }

  emit(event, payload = {}) {
    this.listeners.get(event)?.forEach(listener => listener(payload))
  }
}

function createCache(limit = 8) {
  const providers = []
  const cache = createCollaborationSessionCache({
    url: 'ws://example.test/collaboration',
    limit,
    providerFactory: options => {
      const provider = new FakeProvider(options)
      providers.push(provider)
      return provider
    }
  })
  return { cache, providers }
}

describe('collaboration session cache', () => {
  it('reuses the hydrated Y.Doc and removes inactive awareness', () => {
    const { cache, providers } = createCache()
    const first = cache.acquire('room:one', { id: 'user-1' })
    providers[0].emit('synced')
    cache.release('room:one')

    expect(providers[0].awareness.localState).toBeNull()
    expect(providers[0].disconnect).toHaveBeenCalledOnce()
    expect(cache.hasHydrated('room:one')).toBe(true)

    const second = cache.acquire('room:one', { id: 'user-1' })
    expect(second.doc).toBe(first.doc)
    expect(providers).toHaveLength(1)
    expect(providers[0].connect).toHaveBeenCalledOnce()
    cache.destroy()
  })

  it('evicts the least recently used clean inactive entry', () => {
    const { cache, providers } = createCache(2)
    const first = cache.acquire('room:one', { id: 'user-1' })
    providers[0].emit('synced')
    cache.release('room:one')
    cache.acquire('room:two', { id: 'user-1' })
    providers[1].emit('synced')
    cache.release('room:two')
    cache.acquire('room:three', { id: 'user-1' })

    expect(providers[0].destroy).toHaveBeenCalledOnce()
    expect(first.provider).toBe(providers[0])
    cache.destroy()
  })

  it('keeps dirty entries beyond the limit until they become safe to evict', () => {
    const { cache, providers } = createCache(1)
    const dirty = cache.acquire('room:dirty', { id: 'user-1' })
    cache.release('room:dirty')
    cache.acquire('room:active', { id: 'user-1' })

    expect(providers[0].destroy).not.toHaveBeenCalled()
    providers[0].emit('synced')
    expect(providers[0].destroy).toHaveBeenCalledOnce()
    expect(dirty.provider).toBe(providers[0])
    cache.destroy()
  })
})
