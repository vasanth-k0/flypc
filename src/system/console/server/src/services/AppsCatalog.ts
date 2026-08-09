import fs from 'node:fs'
import path from 'node:path'
import { getAppsIndexPath } from '../lib/PathResolver.js'

export type AppCatalogDefinition = {
  name: string
  icon: string
  published: boolean
  users: string[]
  system?: boolean
}

export type AppCatalogIndex = Record<string, AppCatalogDefinition>

export const loadAppsCatalog = (): AppCatalogIndex => {
  const appsFile = getAppsIndexPath()
  if (!fs.existsSync(appsFile)) {
    return {}
  }

  return JSON.parse(fs.readFileSync(appsFile, 'utf8')) as AppCatalogIndex
}

export const saveAppsCatalog = (catalog: AppCatalogIndex): void => {
  const appsFile = getAppsIndexPath()
  fs.mkdirSync(path.dirname(appsFile), { recursive: true })
  fs.writeFileSync(appsFile, `${JSON.stringify(catalog, null, 4)}\n`, 'utf8')
}

export const isUserInstalled = (app: AppCatalogDefinition | undefined, username: string): boolean =>
  Boolean(app?.published && Array.isArray(app.users) && app.users.includes(username))

export const addUserToApp = (
  catalog: AppCatalogIndex,
  appKey: string,
  username: string,
  definition: AppCatalogDefinition,
): AppCatalogIndex => {
  const existing = catalog[appKey]
  const users = new Set(existing?.users ?? [])
  users.add(username)

  return {
    ...catalog,
    [appKey]: {
      ...definition,
      ...existing,
      name: definition.name,
      icon: definition.icon,
      published: true,
      users: [...users],
    },
  }
}

export const removeUserFromApp = (
  catalog: AppCatalogIndex,
  appKey: string,
  username: string,
): AppCatalogIndex => {
  const existing = catalog[appKey]
  if (!existing) {
    return catalog
  }

  const users = existing.users.filter((entry) => entry !== username)
  if (users.length === 0) {
    const next = { ...catalog }
    delete next[appKey]
    return next
  }

  return {
    ...catalog,
    [appKey]: {
      ...existing,
      users,
    },
  }
}

export const removeAppFromCatalog = (catalog: AppCatalogIndex, appKey: string): AppCatalogIndex => {
  const next = { ...catalog }
  delete next[appKey]
  return next
}

export const getAppUsers = (catalog: AppCatalogIndex, appKey: string): string[] =>
  catalog[appKey]?.users ?? []
