import { describe, expect, it } from '@jest/globals'
import {
  addUserToApp,
  isUserInstalled,
  removeAppFromCatalog,
  removeUserFromApp,
} from '../../services/AppsCatalog.js'

describe('AppsCatalog', () => {
  it('tracks installed users', () => {
    const app = {
      name: 'Jellyfin',
      icon: 'PlayCircleFilled',
      published: true,
      users: ['admin'],
    }

    expect(isUserInstalled(app, 'admin')).toBe(true)
    expect(isUserInstalled(app, 'guest')).toBe(false)
  })

  it('adds users without duplicates', () => {
    const next = addUserToApp({}, 'jellyfin', 'admin', {
      name: 'Jellyfin',
      icon: 'PlayCircleFilled',
      published: true,
      users: [],
    })

    const withGuest = addUserToApp(next, 'jellyfin', 'guest', {
      name: 'Jellyfin',
      icon: 'PlayCircleFilled',
      published: true,
      users: [],
    })
    const deduped = addUserToApp(withGuest, 'jellyfin', 'admin', {
      name: 'Jellyfin',
      icon: 'PlayCircleFilled',
      published: true,
      users: [],
    })

    expect(deduped.jellyfin?.users).toEqual(['admin', 'guest'])
  })

  it('removes app entry when last user is removed', () => {
    const catalog = addUserToApp({}, 'plex', 'admin', {
      name: 'Plex',
      icon: 'PlaySquareFilled',
      published: true,
      users: [],
    })

    const next = removeUserFromApp(catalog, 'plex', 'admin')
    expect(next.plex).toBeUndefined()
  })

  it('removes app entry explicitly for all users', () => {
    const catalog = addUserToApp({}, 'plex', 'admin', {
      name: 'Plex',
      icon: 'PlaySquareFilled',
      published: true,
      users: [],
    })

    const next = removeAppFromCatalog(catalog, 'plex')
    expect(next.plex).toBeUndefined()
  })
})
