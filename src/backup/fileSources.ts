import type { LocalFileEntry } from '../types'

interface FileSystemFileHandleLike {
  kind: 'file'
  name: string
  getFile(): Promise<File>
}

interface FileSystemDirectoryHandleLike {
  kind: 'directory'
  name: string
  values(): AsyncIterable<FileSystemHandleLike>
}

type FileSystemHandleLike = FileSystemFileHandleLike | FileSystemDirectoryHandleLike

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>
  }

export function canUseDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

async function collectDirectoryEntries(
  directoryHandle: FileSystemDirectoryHandleLike,
  parentPath = '',
): Promise<LocalFileEntry[]> {
  const collected: LocalFileEntry[] = []

  for await (const handle of directoryHandle.values()) {
    const currentPath = parentPath ? `${parentPath}/${handle.name}` : handle.name

    if (handle.kind === 'directory') {
      collected.push(...(await collectDirectoryEntries(handle, currentPath)))
      continue
    }

    collected.push({
      relativePath: currentPath,
      name: handle.name,
      getFile: () => handle.getFile(),
    })
  }

  return collected
}

export async function pickDirectoryWithNativePicker(): Promise<{
  rootName: string
  entries: LocalFileEntry[]
}> {
  const pickerWindow = window as DirectoryPickerWindow

  if (!pickerWindow.showDirectoryPicker) {
    throw new Error('目前瀏覽器不支援原生資料夾選取，請改用回退模式。')
  }

  const directoryHandle = await pickerWindow.showDirectoryPicker()
  const entries = await collectDirectoryEntries(directoryHandle)

  return {
    rootName: directoryHandle.name,
    entries,
  }
}

export function parseDirectoryInput(fileList: FileList): {
  rootName: string
  entries: LocalFileEntry[]
} {
  const files = Array.from(fileList)

  if (!files.length) {
    throw new Error('請先選取 FF14 設定資料夾。')
  }

  const firstRelativePath = files[0].webkitRelativePath || files[0].name
  const rootName = firstRelativePath.split('/')[0] || 'FF14 Settings'

  const entries = files.map((file) => {
    const rawRelativePath = file.webkitRelativePath || file.name
    const segments = rawRelativePath.split('/')
    const relativePath = segments.length > 1 ? segments.slice(1).join('/') : rawRelativePath

    return {
      relativePath,
      name: file.name,
      getFile: async () => file,
    }
  })

  return {
    rootName,
    entries,
  }
}
