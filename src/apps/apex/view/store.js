const authHeaders = () => {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' })
  const token = window.localStorage.getItem('flypc-auth-token')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return headers
}

const apiFetch = async (url, init = {}) => {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: authHeaders(),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.detail ?? payload.error ?? `Request failed (${response.status})`)
  }
  return payload
}

class Apex {
  async listApps() {
    const payload = await apiFetch('/apps/apex/catalog')
    return payload.apps
  }

  async getApp(appKey) {
    const payload = await apiFetch(`/apps/apex/catalog/${encodeURIComponent(appKey)}`)
    return payload.app
  }

  async install(appKey) {
    const payload = await apiFetch(`/apps/apex/catalog/${encodeURIComponent(appKey)}/install`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    return payload.app
  }

  async uninstall(appKey) {
    const payload = await apiFetch(`/apps/apex/catalog/${encodeURIComponent(appKey)}/install`, {
      method: 'DELETE',
    })
    return payload.app
  }

  async uninstallForAll(appKey) {
    return apiFetch(`/apps/apex/catalog/${encodeURIComponent(appKey)}/install/all`, {
      method: 'DELETE',
    })
  }
}

const apex = new Apex()
const listEl = document.getElementById('catalog-list')
const detailEl = document.getElementById('catalog-detail')
let apps = []
let selectedKey = null
let isAdmin = false

const setDetailMessage = (message, isError = false) => {
  detailEl.className = `apex-card ${isError ? 'apex-error' : 'apex-empty'}`
  detailEl.textContent = message
}

const renderList = () => {
  listEl.innerHTML = apps
    .map(
      (app) => `
        <button type="button" data-key="${app.key}" class="${app.key === selectedKey ? 'active' : ''}">
          <span class="name">${app.name}</span>
          <span class="status">${app.installed ? 'Installed' : 'Available'}${app.system ? ' • System' : ''}</span>
        </button>
      `,
    )
    .join('')

  listEl.querySelectorAll('button[data-key]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedKey = button.getAttribute('data-key')
      renderList()
      void renderDetail(selectedKey)
    })
  })
}

const renderDetail = async (appKey) => {
  setDetailMessage('Loading app details…')
  try {
    const app = await apex.getApp(appKey)
    detailEl.className = 'apex-card'
    detailEl.innerHTML = `
      <h2>${app.name}</h2>
      <div class="apex-meta">
        ${app.key}
        ${app.installed ? '<span class="badge">Installed</span>' : '<span class="badge pending">Not installed</span>'}
        ${app.hasContainerImage ? '<span class="badge">Docker image</span>' : ''}
      </div>
      <div class="apex-description">${app.description}</div>
      ${
        app.dependencies?.length
          ? `<div class="apex-deps"><h3>Dependencies</h3><ul>${app.dependencies
              .map(
                (dependency) =>
                  `<li><strong>${dependency.key}</strong>: ${dependency.image}${
                    Object.keys(dependency.ports ?? {}).length
                      ? ` (${Object.entries(dependency.ports)
                          .map(([name, port]) => `${name}:${port}`)
                          .join(', ')})`
                      : ''
                  }</li>`,
              )
              .join('')}</ul></div>`
          : ''
      }
      <div class="apex-about">${app.about ?? ''}</div>
      <div class="apex-actions">
        ${
          app.installed
            ? `<button type="button" class="btn-danger" data-action="uninstall">Uninstall for me</button>`
            : `<button type="button" class="btn-primary" data-action="install">Install</button>`
        }
        ${
          isAdmin && app.installedUsers?.length
            ? `<button type="button" class="btn-muted" data-action="uninstall-all">Remove for all users</button>`
            : ''
        }
      </div>
    `

    detailEl.querySelector('[data-action="install"]')?.addEventListener('click', async () => {
      setDetailMessage('Installing application…')
      await apex.install(appKey)
      await refresh()
      await renderDetail(appKey)
    })

    detailEl.querySelector('[data-action="uninstall"]')?.addEventListener('click', async () => {
      setDetailMessage('Uninstalling application…')
      await apex.uninstall(appKey)
      await refresh()
      await renderDetail(appKey)
    })

    detailEl.querySelector('[data-action="uninstall-all"]')?.addEventListener('click', async () => {
      if (!window.confirm(`Remove ${app.name} for all users?`)) {
        return
      }
      setDetailMessage('Removing application for all users…')
      await apex.uninstallForAll(appKey)
      await refresh()
      await renderDetail(appKey)
    })
  } catch (error) {
    setDetailMessage(error.message, true)
  }
}

const loadProfile = async () => {
  try {
    const payload = await apiFetch('/user/me')
    isAdmin = payload.user?.role === 'Admin'
  } catch {
    isAdmin = false
  }
}

const refresh = async () => {
  apps = await apex.listApps()
  renderList()
}

const boot = async () => {
  setDetailMessage('Loading Apex catalog…')
  try {
    await loadProfile()
    await refresh()
    if (apps.length > 0) {
      selectedKey = apps[0].key
      renderList()
      await renderDetail(selectedKey)
    } else {
      setDetailMessage('No apps are available in the Apex catalog yet.')
    }
  } catch (error) {
    setDetailMessage(error.message, true)
  }
}

void boot()

export { Apex, apex }
