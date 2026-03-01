import { useContext } from 'react'
import { SyncContext } from './context'

export function useSync() {
  const value = useContext(SyncContext)

  if (!value) {
    throw new Error('useSync must be used inside SyncProvider.')
  }

  return value
}
