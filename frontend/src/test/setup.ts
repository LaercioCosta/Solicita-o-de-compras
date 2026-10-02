import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { reiniciarFixtures } from './handlers'
import { server } from './server'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  reiniciarFixtures()
  localStorage.clear()
})

afterAll(() => {
  server.close()
})
