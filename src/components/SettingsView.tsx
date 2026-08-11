import { useState } from 'react'
import { BackupPanel } from './BackupPanel'
import { PacePanel } from './PacePanel'
import { APP_VERSION, CHANGELOG } from '../data/changelog'
import type { Progress } from '../types'

interface Props {
  progress: Progress
  onReset: () => void
  onRestore: (progress: Progress) => void
  onSetSecondsPerQuestion: (seconds: number) => void
}

type SettingsTab = 'timing' | 'data' | 'version' | 'about'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'timing', label: 'Timing' },
  { id: 'data', label: 'Data' },
  { id: 'version', label: 'Version' },
  { id: 'about', label: 'About' },
]

export function SettingsView({ progress, onReset, onRestore, onSetSecondsPerQuestion }: Props) {
  const [tab, setTab] = useState<SettingsTab>('timing')

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`settings-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="panel-settings"
            className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="panel-settings" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'timing' && (
          <PacePanel
            secondsPerQuestion={progress.preferences.secondsPerQuestion}
            onChange={onSetSecondsPerQuestion}
          />
        )}

        {tab === 'data' && (
          <>
            <BackupPanel progress={progress} onRestore={onRestore} />
            <ResetCard onReset={onReset} />
          </>
        )}

        {tab === 'version' && <VersionCard />}

        {tab === 'about' && <AboutCard />}
      </div>
    </>
  )
}

function ResetCard({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="card">
      <h2 className="section-title">Reset</h2>
      {confirming ? (
        <>
          <p>
            This will permanently delete all progress stored in this browser. It cannot be
            undone.
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onReset()
                setConfirming(false)
              }}
            >
              Yes, delete everything
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn" onClick={() => setConfirming(true)}>
          Reset all progress
        </button>
      )}
    </div>
  )
}

function VersionCard() {
  return (
    <div className="card">
      <h2 className="section-title">Version history</h2>
      <p className="muted small">
        Currently running <strong>v{APP_VERSION}</strong>. Every release and what it added,
        newest first.
      </p>
      {CHANGELOG.map((entry) => (
        <div key={entry.version} style={{ marginBottom: 16 }}>
          <strong>
            v{entry.version} —{' '}
            {new Date(entry.date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </strong>
          <ul className="list-plain">
            {entry.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function AboutCard() {
  return (
    <div className="card">
      <h2 className="section-title">About</h2>
      <p className="muted small">
        11+ Practice v{APP_VERSION} —{' '}
        <a href="https://yinglanzheng15.github.io/uk-11-plus-practice/">live site</a> ·{' '}
        <a href="https://github.com/yinglanzheng15/uk-11-plus-practice">source on GitHub</a>
      </p>
      <p className="muted small">
        Original practice questions written in the style of UK 11+ assessments. Not
        affiliated with, or endorsed by, any school, consortium or examination board.
      </p>
      <p className="muted small" style={{ marginBottom: 0 }}>
        One browser currently means one child's progress. Profiles for siblings sharing a
        device are a planned improvement — see <code>ROADMAP.md</code>.
      </p>
    </div>
  )
}
