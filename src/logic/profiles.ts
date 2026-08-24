/**
 * Child profiles: letting siblings share one device without mixing progress.
 *
 * This sits above storage.ts / sessionStorage.ts rather than inside them —
 * it decides *which* profile's key to read or write, not what the data under
 * that key looks like. Everything here is still just localStorage; there is
 * no account and nothing leaves the device, exactly as before.
 */
import { LEGACY_PROGRESS_KEY, progressKey } from './storage'
import { sessionKey } from './sessionStorage'

export interface ChildProfile {
  id: string
  name: string
  createdAt: number
}

const PROFILES_KEY = 'elevenplus:v1:profiles'
const ACTIVE_PROFILE_KEY = 'elevenplus:v1:activeProfile'

function readProfiles(): ChildProfile[] {
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? (parsed as ChildProfile[]) : []
  } catch {
    return []
  }
}

function writeProfiles(profiles: ChildProfile[]): void {
  try {
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
  } catch {
    // Storage full or blocked — the list just won't survive a reload.
  }
}

export function loadProfiles(): ChildProfile[] {
  return readProfiles()
}

function generateId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function readActiveProfileId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY)
  } catch {
    return null
  }
}

export function setActiveProfileId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_PROFILE_KEY, id)
  } catch {
    // Nothing more to do; the picker just won't remember across a reload.
  }
}

/**
 * Ensure at least one profile exists, and return the one that should be
 * active. Runs once at startup.
 *
 * A device with no profiles yet either predates this feature (there may be
 * progress sitting under the old single fixed key) or is brand new. Either
 * way it gets exactly one profile, named generically since nobody has been
 * asked their name — a parent can rename it later. Pre-existing progress is
 * moved across rather than orphaned, so nobody's history is lost the moment
 * this feature reaches their device.
 */
export function ensureProfile(): ChildProfile {
  let profiles = readProfiles()
  if (profiles.length === 0) {
    const first: ChildProfile = { id: generateId(), name: 'Player 1', createdAt: Date.now() }
    try {
      const legacy = window.localStorage.getItem(LEGACY_PROGRESS_KEY)
      if (legacy !== null) {
        window.localStorage.setItem(progressKey(first.id), legacy)
        window.localStorage.removeItem(LEGACY_PROGRESS_KEY)
      }
    } catch {
      // No pre-existing progress to carry over, or storage is unavailable —
      // either way the new profile just starts empty.
    }
    profiles = [first]
    writeProfiles(profiles)
    setActiveProfileId(first.id)
    return first
  }

  const activeId = readActiveProfileId()
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0]
  if (active.id !== activeId) setActiveProfileId(active.id)
  return active
}

export function createProfile(name: string): ChildProfile {
  const profile: ChildProfile = {
    id: generateId(),
    name: name.trim() || 'New profile',
    createdAt: Date.now(),
  }
  writeProfiles([...readProfiles(), profile])
  return profile
}

export function renameProfile(id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  writeProfiles(readProfiles().map((p) => (p.id === id ? { ...p, name: trimmed } : p)))
}

/**
 * Delete a profile and everything stored under it — progress and any
 * in-progress session. The caller is responsible for never deleting the
 * active profile (switch first) or the last remaining one.
 */
export function deleteProfile(id: string): void {
  writeProfiles(readProfiles().filter((p) => p.id !== id))
  try {
    window.localStorage.removeItem(progressKey(id))
    window.localStorage.removeItem(sessionKey(id))
  } catch {
    // Best effort; an orphaned key does no harm beyond a little storage.
  }
}
