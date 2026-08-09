import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Breadcrumb,
  Button,
  Dropdown,
  Empty,
  Input,
  Layout,
  Modal,
  Select,
  Space,
  Table,
  Tree,
  Typography,
  message,
  notification,
} from 'antd'
import type { EventDataNode } from 'antd/es/tree'
import type { MenuProps, TableColumnsType, TreeDataNode, TreeProps } from 'antd'
import {
  CloudOutlined,
  CopyOutlined,
  DeleteOutlined,
  DesktopOutlined,
  DownOutlined,
  EditOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  HomeOutlined,
  LockOutlined,
  ReloadOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  FileManager,
  type ExplorerClipboard,
  type FileEntry,
  type FileRoot,
  type FileTreeNode,
} from '../apps/FileManager'
import { LocalFileManager } from '../apps/LocalFileManager'
import { runWithProgress } from './fileProgress'

const { Sider, Content } = Layout
const { Search } = Input
const { Text } = Typography

const explorerSurface = {
  background: '#ffffff',
  color: '#1f1f1f',
  border: '1px solid #e5e5e5',
} as const

const LOCAL_ROOT_ID = 'local'
const fileManager = new FileManager()
const localFileManager = new LocalFileManager()

const formatBytes = (bytes: number, type: FileEntry['type']): string => {
  if (type === 'directory') {
    return ''
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const formatModified = (iso: string): string => new Date(iso).toLocaleString()

const splitPath = (relativePath: string): string[] => relativePath.split('/').filter(Boolean)

const toTreeData = (nodes: FileTreeNode[]): TreeDataNode[] =>
  nodes.map((node) => ({
    title: node.title,
    key: node.key,
    isLeaf: node.isLeaf,
    icon: <FolderOutlined style={{ color: '#0078d4' }} />,
    children: node.children ? toTreeData(node.children) : undefined,
  }))

const updateTreeNodeChildren = (
  nodes: TreeDataNode[],
  key: React.Key,
  children: TreeDataNode[],
): TreeDataNode[] =>
  nodes.map((node) => {
    if (node.key === key) {
      return { ...node, children }
    }
    if (node.children) {
      return { ...node, children: updateTreeNodeChildren(node.children, key, children) }
    }
    return node
  })

const buildExpandedKeys = (relativePath: string): string[] => {
  const expanded = ['']
  let accumulated = ''
  for (const segment of splitPath(relativePath)) {
    accumulated = accumulated ? `${accumulated}/${segment}` : segment
    expanded.push(accumulated)
  }
  return expanded
}

type FileExplorerProps = {
  isLoggedIn: boolean
  onLoginRequired?: () => void
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ isLoggedIn, onLoginRequired }) => {
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [roots, setRoots] = useState<FileRoot[]>([])
  const [rootId, setRootId] = useState(LOCAL_ROOT_ID)
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [treeData, setTreeData] = useState<TreeDataNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<string[]>([''])
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [localConnected, setLocalConnected] = useState(false)
  const [localRootLabel, setLocalRootLabel] = useState('This PC')
  const [clipboard, setClipboard] = useState<ExplorerClipboard | null>(null)
  const [contextEntry, setContextEntry] = useState<FileEntry | null>(null)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [moveTarget, setMoveTarget] = useState('')
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('New folder')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameTargetPath, setRenameTargetPath] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const isLocalRoot = rootId === LOCAL_ROOT_ID
  const visibleEntries = searchResults ?? entries
  const selectedCount = selectedPaths.length
  const activeRoot = roots.find((root) => root.id === rootId)
  const canMutateRemote = isLoggedIn && !activeRoot?.locked

  const breadcrumbItems = useMemo(() => {
    const rootLabel = isLocalRoot ? localRootLabel : activeRoot?.label ?? 'FlyDrive'
    const segments = splitPath(currentPath)

    return [
      {
        title: (
          <Button type="link" size="small" icon={<HomeOutlined />} onClick={() => setCurrentPath('')} style={{ paddingInline: 4 }}>
            {rootLabel}
          </Button>
        ),
      },
      ...segments.map((segment, index) => {
        const targetPath = segments.slice(0, index + 1).join('/')
        return {
          title: (
            <Button type="link" size="small" onClick={() => setCurrentPath(targetPath)} style={{ paddingInline: 4 }}>
              {segment}
            </Button>
          ),
        }
      }),
    ]
  }, [activeRoot?.label, currentPath, isLocalRoot, localRootLabel])

  const loadTreeChildren = useCallback(
    async (relativePath: string): Promise<TreeDataNode[]> => {
      const nodes = isLocalRoot
        ? await localFileManager.listTreeChildren(relativePath)
        : await fileManager.listTreeChildren(rootId, relativePath)
      return toTreeData(nodes)
    },
    [isLocalRoot, rootId],
  )

  const folderTreeData = useMemo<TreeDataNode[]>(
    () => [
      {
        title: isLocalRoot ? localRootLabel : activeRoot?.label ?? 'FlyDrive',
        key: '',
        icon: isLocalRoot ? <DesktopOutlined style={{ color: '#0078d4' }} /> : <CloudOutlined style={{ color: '#0078d4' }} />,
        children: treeData,
      },
    ],
    [activeRoot?.label, isLocalRoot, localRootLabel, treeData],
  )

  const onTreeSelect: TreeProps['onSelect'] = (selectedKeys) => {
    setCurrentPath(String(selectedKeys[0] ?? ''))
  }

  const onTreeExpand: TreeProps['onExpand'] = (keys) => {
    setExpandedKeys(keys.map(String))
  }

  const refreshListing = useCallback(async () => {
    if (isLocalRoot && !localConnected) {
      setEntries([])
      setTreeData([])
      return
    }

    setLoading(true)
    try {
      if (isLocalRoot) {
        const nextEntries = await localFileManager.list(currentPath)
        setEntries(nextEntries)
        setTreeData(await loadTreeChildren(''))
      } else {
        const payload = await fileManager.list(rootId, currentPath)
        setEntries(payload.entries)
        setTreeData(await loadTreeChildren(''))
      }
      setSearchResults(null)
      setSearchQuery('')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Unable to load files')
    } finally {
      setLoading(false)
    }
  }, [currentPath, isLocalRoot, loadTreeChildren, localConnected, rootId])

  useEffect(() => {
    void (async () => {
      try {
        const nextRoots = await fileManager.listRoots()
        setRoots(nextRoots)
        if (!nextRoots.some((root) => root.id === rootId)) {
          setRootId(LOCAL_ROOT_ID)
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Unable to load storage roots')
      }
    })()
  }, [isLoggedIn, rootId])

  useEffect(() => {
    void refreshListing()
  }, [refreshListing])

  useEffect(() => {
    setSelectedPaths([])
  }, [currentPath, rootId])

  useEffect(() => {
    setExpandedKeys(buildExpandedKeys(currentPath))
  }, [currentPath, rootId])

  const connectLocalFolder = async (): Promise<void> => {
    try {
      await localFileManager.connect()
      setLocalConnected(true)
      setLocalRootLabel(localFileManager.getRootLabel())
      setRootId(LOCAL_ROOT_ID)
      setCurrentPath('')
      message.success('Local folder connected')
      await refreshListing()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Unable to open local folder')
    }
  }

  const handleRootChange = (value: string): void => {
    const nextRoot = roots.find((root) => root.id === value)
    if (nextRoot?.locked) {
      notification.warning({
        message: 'Sign in to use FlyDrive',
        description: 'FlyDrive is your personal cloud storage on FlyPC. Log in to upload, move, and manage files.',
        btn: onLoginRequired ? (
          <Button type="primary" size="small" onClick={onLoginRequired}>
            Sign in
          </Button>
        ) : undefined,
        placement: 'topRight',
      })
      return
    }

    setRootId(value)
    setCurrentPath('')
  }

  const openEntry = (entry: FileEntry): void => {
    if (entry.type === 'directory') {
      setCurrentPath(entry.path)
      return
    }
    message.info(`Selected file: ${entry.name}`)
  }

  const handleSearch = async (value: string): Promise<void> => {
    const query = value.trim()
    setSearchQuery(query)
    if (!query) {
      setSearchResults(null)
      return
    }

    if (isLocalRoot && !localConnected) {
      return
    }

    setLoading(true)
    try {
      const results = isLocalRoot
        ? await localFileManager.search(currentPath, query)
        : await fileManager.search(rootId, currentPath, query)
      setSearchResults(results)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (paths: string[]): Promise<void> => {
    if (paths.length === 0) {
      return
    }

    Modal.confirm({
      title: paths.length === 1 ? 'Delete item?' : `Delete ${paths.length} items?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await runWithProgress('Deleting items', paths.length, async (_report, step) => {
            if (isLocalRoot) {
              await localFileManager.deletePaths(paths)
            } else {
              await fileManager.deletePaths(rootId, paths)
            }
            step('Deleted selected items')
          })
          setSelectedPaths((current) => current.filter((path) => !paths.includes(path)))
          await refreshListing()
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Delete failed')
        }
      },
    })
  }

  const handleCut = (paths: string[]): void => {
    if (paths.length === 0) {
      return
    }
    setClipboard({ mode: 'cut', rootId, paths })
    message.success(paths.length === 1 ? 'Item ready to move' : `${paths.length} items ready to move`)
  }

  const handleCopy = (paths: string[]): void => {
    if (paths.length === 0) {
      return
    }
    setClipboard({ mode: 'copy', rootId, paths })
    message.success(paths.length === 1 ? 'Item copied to clipboard' : `${paths.length} items copied`)
  }

  const handleDuplicate = async (paths: string[]): Promise<void> => {
    if (paths.length === 0) {
      return
    }

    try {
      await runWithProgress('Duplicating items', paths.length, async (_report, step) => {
        if (isLocalRoot) {
          await localFileManager.copyPaths(paths, currentPath)
        } else {
          await fileManager.copyPaths(rootId, paths, currentPath)
        }
        step('Created duplicates')
      })
      await refreshListing()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Duplicate failed')
    }
  }

  const handlePaste = async (): Promise<void> => {
    if (!clipboard || clipboard.paths.length === 0) {
      return
    }

    const { mode, rootId: sourceRootId, paths } = clipboard

    if (sourceRootId === LOCAL_ROOT_ID && rootId !== LOCAL_ROOT_ID) {
      if (!canMutateRemote) {
        notification.warning({
          message: 'Sign in to use FlyDrive',
          description: 'Log in to upload files from this device to FlyDrive.',
          btn: onLoginRequired ? (
            <Button type="primary" size="small" onClick={onLoginRequired}>
              Sign in
            </Button>
          ) : undefined,
        })
        return
      }

      try {
        const collected = await localFileManager.collectFilesFromPaths(paths)
        await runWithProgress('Uploading to FlyDrive', collected.length, async (report, step) => {
          await fileManager.uploadFilesWithProgress(rootId, currentPath, collected.map((item) => item.file), (_index, file) => {
            step(`Uploading ${file.name}`)
          })
          report(100)
        })
        if (mode === 'cut') {
          await localFileManager.deletePaths(paths)
        }
        setClipboard(null)
        await refreshListing()
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Upload failed')
      }
      return
    }

    if (sourceRootId !== rootId) {
      message.warning('Paste is only supported within the same location or from This PC to FlyDrive')
      return
    }

    try {
      await runWithProgress(mode === 'cut' ? 'Moving items' : 'Copying items', paths.length, async (_report, step) => {
        if (isLocalRoot) {
          if (mode === 'cut') {
            await localFileManager.movePaths(paths, currentPath)
          } else {
            await localFileManager.copyPaths(paths, currentPath)
          }
        } else if (mode === 'cut') {
          await fileManager.movePaths(rootId, paths, currentPath)
        } else {
          await fileManager.copyPaths(rootId, paths, currentPath)
        }
        step(mode === 'cut' ? 'Moved items' : 'Copied items')
      })
      if (mode === 'cut') {
        setClipboard(null)
      }
      setSelectedPaths([])
      await refreshListing()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Paste failed')
    }
  }

  const handleMoveTo = async (): Promise<void> => {
    if (selectedPaths.length === 0) {
      return
    }

    try {
      await runWithProgress('Moving items', selectedPaths.length, async (_report, step) => {
        if (isLocalRoot) {
          await localFileManager.movePaths(selectedPaths, moveTarget)
        } else {
          await fileManager.movePaths(rootId, selectedPaths, moveTarget)
        }
        step('Moved items')
      })
      setMoveModalOpen(false)
      setMoveTarget('')
      setSelectedPaths([])
      await refreshListing()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Move failed')
    }
  }

  const handleCreateFolder = async (): Promise<void> => {
    const name = newFolderName.trim()
    if (!name) {
      message.warning('Enter a folder name')
      return
    }

    try {
      if (isLocalRoot) {
        await localFileManager.createFolder(currentPath, name)
      } else {
        await fileManager.createFolder(rootId, currentPath, name)
      }
      message.success('Folder created')
      setNewFolderOpen(false)
      setNewFolderName('New folder')
      await refreshListing()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Unable to create folder')
    }
  }

  const handleRename = async (): Promise<void> => {
    const nextName = renameValue.trim()
    if (!nextName || !renameTargetPath) {
      return
    }

    try {
      if (isLocalRoot) {
        await localFileManager.renamePath(renameTargetPath, nextName)
      } else {
        await fileManager.renamePath(rootId, renameTargetPath, nextName)
      }
      message.success('Item renamed')
      setRenameOpen(false)
      setRenameValue('')
      setRenameTargetPath('')
      await refreshListing()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Rename failed')
    }
  }

  const handleUpload = async (fileList: File[] | FileList | null): Promise<void> => {
    if (!fileList || fileList.length === 0) {
      return
    }

    const files = Array.from(fileList)

    try {
      await runWithProgress('Uploading files', files.length, async (_report, step) => {
        if (isLocalRoot) {
          await localFileManager.writeFiles(currentPath, files)
          files.forEach((file) => step(`Uploaded ${file.name}`))
        } else {
          await fileManager.uploadFilesWithProgress(rootId, currentPath, files, (_index, file) => {
            step(`Uploading ${file.name}`)
          })
        }
      })
      await refreshListing()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      if (uploadInputRef.current) {
        uploadInputRef.current.value = ''
      }
    }
  }

  const copyPathsToClipboard = async (paths: string[]): Promise<void> => {
    try {
      await navigator.clipboard.writeText(paths.join('\n'))
      message.success('Path copied')
    } catch {
      message.error('Unable to copy path')
    }
  }

  const openRenameDialog = (entry: FileEntry): void => {
    setRenameTargetPath(entry.path)
    setRenameValue(entry.name)
    setRenameOpen(true)
  }

  const onTreeLoadData = async (node: EventDataNode<TreeDataNode>): Promise<void> => {
    if (node.children && node.children.length > 0) {
      return
    }

    const children = await loadTreeChildren(String(node.key))
    setTreeData((current) => updateTreeNodeChildren(current, node.key, children))
  }

  const buildContextMenu = (entry: FileEntry | null, batchPaths: string[]): MenuProps => {
    const targetPaths = batchPaths.length > 0 ? batchPaths : entry ? [entry.path] : []
    const primary = entry ?? entries.find((item) => item.path === targetPaths[0]) ?? null
    const canWrite = isLocalRoot ? localConnected : canMutateRemote

    return {
      items: [
        {
          key: 'open',
          label: 'Open',
          disabled: !primary,
          onClick: () => primary && openEntry(primary),
        },
        { type: 'divider' },
        {
          key: 'cut',
          label: 'Cut',
          icon: <ScissorOutlined />,
          disabled: !canWrite || targetPaths.length === 0,
          onClick: () => handleCut(targetPaths),
        },
        {
          key: 'copy',
          label: 'Copy',
          icon: <CopyOutlined />,
          disabled: targetPaths.length === 0,
          onClick: () => handleCopy(targetPaths),
        },
        {
          key: 'duplicate',
          label: 'Duplicate',
          disabled: !canWrite || targetPaths.length === 0,
          onClick: () => void handleDuplicate(targetPaths),
        },
        {
          key: 'rename',
          label: 'Rename',
          icon: <EditOutlined />,
          disabled: !canWrite || targetPaths.length !== 1 || !primary,
          onClick: () => primary && openRenameDialog(primary),
        },
        {
          key: 'copy-path',
          label: 'Copy path',
          disabled: targetPaths.length === 0,
          onClick: () => void copyPathsToClipboard(targetPaths),
        },
        {
          key: 'paste',
          label: 'Paste',
          icon: <SnippetsOutlined />,
          disabled: !clipboard || (!isLocalRoot && !canMutateRemote),
          onClick: () => void handlePaste(),
        },
        { type: 'divider' },
        {
          key: 'delete',
          label: 'Delete',
          icon: <DeleteOutlined />,
          danger: true,
          disabled: !canWrite || targetPaths.length === 0,
          onClick: () => void handleDelete(targetPaths),
        },
        {
          key: 'move',
          label: 'Move to folder…',
          disabled: !canWrite || targetPaths.length === 0,
          onClick: () => {
            setSelectedPaths(targetPaths)
            setMoveModalOpen(true)
          },
        },
        { type: 'divider' },
        {
          key: 'newfolder',
          label: 'New folder',
          icon: <FolderAddOutlined />,
          disabled: !canWrite,
          onClick: () => setNewFolderOpen(true),
        },
        {
          key: 'upload',
          label: 'Upload files',
          icon: <UploadOutlined />,
          disabled: !canWrite,
          onClick: () => uploadInputRef.current?.click(),
        },
        {
          key: 'refresh',
          label: 'Refresh',
          icon: <ReloadOutlined />,
          onClick: () => void refreshListing(),
        },
      ],
    }
  }

  const columns: TableColumnsType<FileEntry> = [
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (left, right) => left.name.localeCompare(right.name),
      render: (name: string, record) => (
        <Space size={8}>
          {record.type === 'directory' ? (
            <FolderOutlined style={{ color: '#0078d4' }} />
          ) : (
            <FileOutlined style={{ color: '#605e5c' }} />
          )}
          <Text style={{ color: '#1f1f1f' }}>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Modified',
      dataIndex: 'modifiedAt',
      width: 190,
      sorter: (left, right) => left.modifiedAt.localeCompare(right.modifiedAt),
      render: (value: string) => <Text style={{ color: '#605e5c' }}>{formatModified(value)}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 120,
      render: (value: FileEntry['type']) => (
        <Text style={{ color: '#605e5c' }}>{value === 'directory' ? 'Folder' : 'File'}</Text>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      width: 110,
      align: 'right',
      sorter: (left, right) => left.size - right.size,
      render: (value: number, record) => (
        <Text style={{ color: '#605e5c' }}>{formatBytes(value, record.type)}</Text>
      ),
    },
  ]

  const rootOptions = roots.map((root) => ({
    value: root.id,
    label: (
      <Space size={6}>
        {root.kind === 'local' ? <DesktopOutlined /> : root.kind === 'home' ? <CloudOutlined /> : <FolderOutlined />}
        <span>{root.label}</span>
        {root.locked ? <LockOutlined style={{ color: '#999' }} /> : null}
      </Space>
    ),
    disabled: Boolean(root.locked),
  }))

  const canWrite = isLocalRoot ? localConnected : canMutateRemote

  return (
    <Dropdown menu={buildContextMenu(contextEntry, selectedPaths)} trigger={['contextMenu']}>
      <div
        style={{
          ...explorerSurface,
          height: '100%',
          minHeight: '520px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onContextMenu={() => setContextEntry(null)}
      >
        {!isLoggedIn ? (
          <Alert
            type="info"
            showIcon
            banner
            message="FlyDrive requires sign-in"
            description="You can browse folders on this device. Sign in to access FlyDrive and sync files to your FlyPC storage."
            action={
              onLoginRequired ? (
                <Button size="small" type="primary" onClick={onLoginRequired}>
                  Sign in
                </Button>
              ) : undefined
            }
            style={{ borderRadius: 0 }}
          />
        ) : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 0.85rem',
            borderBottom: explorerSurface.border,
            background: '#fafafa',
          }}
        >
          <Space wrap>
            {isLocalRoot && !localConnected ? (
              <Button type="primary" icon={<FolderOpenOutlined />} onClick={() => void connectLocalFolder()}>
                Open local folder
              </Button>
            ) : null}
            <Button icon={<FolderAddOutlined />} disabled={!canWrite} onClick={() => setNewFolderOpen(true)}>
              New folder
            </Button>
            <Button icon={<UploadOutlined />} disabled={!canWrite} onClick={() => uploadInputRef.current?.click()}>
              Upload
            </Button>
            <Button icon={<ScissorOutlined />} disabled={!canWrite || selectedCount === 0} onClick={() => handleCut(selectedPaths)}>
              Cut
            </Button>
            <Button icon={<CopyOutlined />} disabled={selectedCount === 0} onClick={() => handleCopy(selectedPaths)}>
              Copy
            </Button>
            <Button icon={<SnippetsOutlined />} disabled={!clipboard} onClick={() => void handlePaste()}>
              Paste
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={!canWrite || selectedCount === 0}
              onClick={() => void handleDelete(selectedPaths)}
            >
              Delete{selectedCount > 0 ? ` (${selectedCount})` : ''}
            </Button>
            <Button disabled={!canWrite || selectedCount === 0} onClick={() => setMoveModalOpen(true)}>
              Move to…
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshListing()}>
              Refresh
            </Button>
          </Space>

          <div style={{ marginLeft: 'auto', minWidth: '240px', maxWidth: '320px', width: '100%' }}>
            <Search
              allowClear
              placeholder="Search in current folder"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onSearch={(value) => void handleSearch(value)}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.55rem 0.85rem',
            borderBottom: explorerSurface.border,
            background: '#ffffff',
          }}
        >
          <Select
            value={rootId}
            style={{ minWidth: 220 }}
            options={rootOptions}
            onChange={handleRootChange}
          />
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <Layout style={{ flex: 1, background: '#ffffff' }}>
          <Sider
            width={248}
            theme="light"
            style={{
              background: '#ffffff',
              borderRight: explorerSurface.border,
              padding: '0.75rem',
              overflow: 'auto',
            }}
          >
            <Text strong style={{ display: 'block', marginBottom: '0.5rem', color: '#1f1f1f' }}>
              Folders
            </Text>
            {isLocalRoot && !localConnected ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Connect a local folder" />
            ) : (
              <Tree
                showLine
                showIcon
                blockNode
                loadData={onTreeLoadData}
                selectedKeys={[currentPath]}
                expandedKeys={expandedKeys}
                onExpand={onTreeExpand}
                switcherIcon={({ expanded }) => (
                  <DownOutlined
                    style={{
                      transform: `rotate(${expanded ? 0 : -90}deg)`,
                      transition: 'transform 0.3s',
                      fontSize: '0.65rem',
                      color: '#605e5c',
                    }}
                  />
                )}
                treeData={folderTreeData}
                onSelect={onTreeSelect}
                style={{ background: '#ffffff', color: '#1f1f1f' }}
              />
            )}
          </Sider>

          <Content
            style={{
              background: dragActive ? '#f0f7ff' : '#ffffff',
              overflow: 'hidden',
              border: dragActive ? '2px dashed #0078d4' : '2px solid transparent',
              boxSizing: 'border-box',
            }}
            onDragEnter={(event) => {
              event.preventDefault()
              if (canWrite) {
                setDragActive(true)
              }
            }}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(event) => {
              event.preventDefault()
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              if (!canWrite) {
                return
              }
              void handleUpload(event.dataTransfer.files)
            }}
          >
            {isLocalRoot && !localConnected ? (
              <div style={{ padding: '3rem 1rem' }}>
                <Empty description="Choose a folder on this device to browse local files">
                  <Button type="primary" icon={<FolderOpenOutlined />} onClick={() => void connectLocalFolder()}>
                    Open local folder
                  </Button>
                </Empty>
              </div>
            ) : (
              <Table<FileEntry>
                size="middle"
                rowKey="path"
                loading={loading}
                columns={columns}
                dataSource={visibleEntries}
                pagination={false}
                scroll={{ y: 'calc(100vh - 360px)' }}
                rowSelection={{
                  selectedRowKeys: selectedPaths,
                  onChange: (keys) => setSelectedPaths(keys.map(String)),
                }}
                onRow={(record) => ({
                  onDoubleClick: () => openEntry(record),
                  onContextMenu: (event) => {
                    event.preventDefault()
                    setContextEntry(record)
                    if (!selectedPaths.includes(record.path)) {
                      setSelectedPaths([record.path])
                    }
                  },
                })}
                locale={{
                  emptyText: searchResults ? 'No matching files' : 'This folder is empty',
                }}
                style={{ background: '#ffffff' }}
              />
            )}
          </Content>
        </Layout>

        <input
          ref={uploadInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => void handleUpload(event.target.files)}
        />

        <Modal
          title="New folder"
          open={newFolderOpen}
          okText="Create"
          onOk={() => void handleCreateFolder()}
          onCancel={() => setNewFolderOpen(false)}
        >
          <Input
            autoFocus
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onPressEnter={() => void handleCreateFolder()}
          />
        </Modal>

        <Modal
          title="Rename"
          open={renameOpen}
          okText="Rename"
          onOk={() => void handleRename()}
          onCancel={() => setRenameOpen(false)}
        >
          <Input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onPressEnter={() => void handleRename()}
          />
        </Modal>

        <Modal
          title="Move to folder"
          open={moveModalOpen}
          okText="Move"
          onOk={() => void handleMoveTo()}
          onCancel={() => {
            setMoveModalOpen(false)
            setMoveTarget('')
          }}
        >
          <Input
            placeholder="Destination folder path (relative)"
            value={moveTarget}
            onChange={(event) => setMoveTarget(event.target.value)}
            onPressEnter={() => void handleMoveTo()}
          />
        </Modal>
      </div>
    </Dropdown>
  )
}
