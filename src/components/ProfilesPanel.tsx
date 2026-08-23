import { useState } from 'react'
import type { ChildProfile } from '../logic/profiles'

interface Props {
  profiles: ChildProfile[]
  activeProfileId: string
  onSwitch: (profile: ChildProfile) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

/**
 * Add, rename, switch between and delete the children sharing this device.
 *
 * Lives in Settings because it is a parent-administered, device-wide
 * decision — not something a child navigates to mid-session. Switching
 * changes what every other screen shows; adding or renaming is otherwise
 * harmless; deleting is permanent, so it is the one action gated behind an
 * explicit confirmation.
 */
export function ProfilesPanel({
  profiles,
  activeProfileId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  function startRename(profile: ChildProfile) {
    setRenamingId(profile.id)
    setRenameValue(profile.name)
  }

  function submitRename() {
    if (renamingId && renameValue.trim()) onRename(renamingId, renameValue)
    setRenamingId(null)
  }

  function submitCreate() {
    if (newName.trim()) onCreate(newName)
    setNewName('')
    setAdding(false)
  }

  return (
    <div className="card">
      <h2 className="section-title">Who's practising?</h2>
      <p className="muted small">
        Everything here stays in this browser, same as the rest of the app — there is
        still no account. Each profile keeps its own progress, so siblings sharing a
        device never see each other's questions or mastery.
      </p>

      <ul className="list-plain">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfileId
          const isRenaming = renamingId === profile.id
          const isConfirmingDelete = confirmingDeleteId === profile.id

          return (
            <li key={profile.id} style={{ marginBottom: 12 }}>
              {isRenaming ? (
                <div className="actions">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    aria-label={`Rename ${profile.name}`}
                    autoFocus
                  />
                  <button type="button" className="btn btn-primary" onClick={submitRename}>
                    Save
                  </button>
                  <button type="button" className="btn" onClick={() => setRenamingId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <strong>{profile.name}</strong>
                  {isActive && <span className="badge" style={{ marginLeft: 8 }}>Active</span>}
                  <div className="actions" style={{ marginTop: 6 }}>
                    {!isActive && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => onSwitch(profile)}
                      >
                        Switch to {profile.name}
                      </button>
                    )}
                    <button type="button" className="btn" onClick={() => startRename(profile)}>
                      Rename
                    </button>
                    {!isActive && profiles.length > 1 && (
                      <>
                        {isConfirmingDelete ? (
                          <>
                            <span className="small">
                              Delete {profile.name} and all their progress?
                            </span>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => {
                                onDelete(profile.id)
                                setConfirmingDeleteId(null)
                              }}
                            >
                              Yes, delete
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setConfirmingDeleteId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setConfirmingDeleteId(profile.id)}
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {adding ? (
        <div className="actions">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Child's name"
            aria-label="New profile name"
            autoFocus
          />
          <button type="button" className="btn btn-primary" onClick={submitCreate}>
            Add
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setAdding(false)
              setNewName('')
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          Add a child
        </button>
      )}
    </div>
  )
}
