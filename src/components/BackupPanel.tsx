import { useRef, useState } from 'react'
import {
  backupFilename,
  describeBackup,
  exportProgress,
  parseBackup,
  type ImportResult,
} from '../logic/backup'
import { downloadText } from '../logic/feedback'
import type { Progress } from '../types'

interface Props {
  progress: Progress
  onRestore: (progress: Progress) => void
}

/**
 * Download a progress file, or restore one.
 *
 * Restoring replaces everything, so the file is parsed and summarised first and
 * the parent confirms against that summary — never against a filename alone.
 */
export function BackupPanel({ progress, onRestore }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Extract<ImportResult, { ok: true }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  function handleDownload() {
    const at = Date.now()
    downloadText(backupFilename(at), exportProgress(progress, at), 'application/json')
    setDone('Progress file downloaded.')
    setError(null)
  }

  async function handleFile(file: File | undefined) {
    setDone(null)
    setPending(null)
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setError('That file could not be opened.')
      return
    }
    const result = parseBackup(text)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setPending(result)
  }

  function handleConfirm() {
    if (!pending) return
    onRestore(pending.progress)
    setPending(null)
    setDone('Progress restored.')
  }

  function reset() {
    setPending(null)
    setError(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="card">
      <h2 className="section-title">Save or move progress</h2>
      <p className="muted small">
        Progress lives only in this browser, so clearing it or switching device would
        otherwise start again from zero. Download a file to keep a copy, or to carry
        progress across to a tablet. The file never leaves this device unless you send
        it somewhere yourself.
      </p>

      <div className="actions">
        <button type="button" className="btn" onClick={handleDownload}>
          Download progress
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            reset()
            fileInput.current?.click()
          }}
        >
          Restore from a file
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {error && (
        <p className="notice" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {done && !pending && !error && (
        <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
          {done}
        </p>
      )}

      {pending && (
        <div style={{ marginTop: 12 }}>
          <p>
            <strong>{describeBackup(pending)}</strong>
          </p>
          <p>
            Restoring replaces all progress currently stored in this browser. It cannot
            be undone — download the current progress first if you want to keep it.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>
              Replace with this file
            </button>
            <button type="button" className="btn" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
