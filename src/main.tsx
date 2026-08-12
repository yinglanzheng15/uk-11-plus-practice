import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { loadPaidQuestions } from './data'
import './styles/global.css'

// The paid half of the bank is fetched before the first render, so nothing in
// the app has to deal with a half-loaded bank. loadPaidQuestions never throws —
// if it comes back empty the app runs on the free bank alone. `.then` rather
// than top-level await, which needs a newer build target than this project sets.
loadPaidQuestions().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
