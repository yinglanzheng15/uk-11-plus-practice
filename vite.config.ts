import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to https://yinglanzheng15.github.io/uk-11-plus-practice/
// `base` must match the repository name, with a slash at each end. This is the
// ONLY line to change if the repo is renamed. For a user site hosted at
// https://yinglanzheng15.github.io/ set base to '/'.
export default defineConfig({
  base: '/uk-11-plus-practice/',
  plugins: [react()],
})
