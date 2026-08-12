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
  if (response.status === 202) {
    return { ...payload, pending: true }
  }
  if (!response.ok) {
    throw new Error(payload.detail ?? payload.error ?? `Request failed (${response.status})`)
  }
  return payload
}

const notifyParentNotificationsChanged = () => {
  window.parent?.postMessage({ type: 'flypc:notifications-changed' }, '*')
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

  async install(appKey, options = {}) {
    const payload = await apiFetch(`/apps/apex/catalog/${encodeURIComponent(appKey)}/install`, {
      method: 'POST',
      body: JSON.stringify(options),
    })
    if (payload.pending) {
      return payload
    }
    return payload.app
  }

  async getInstallContext() {
    const payload = await apiFetch('/apps/apex/install-context')
    return payload
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
let installContext = { nodes: [] }

const openInstallWizard = async (app) => {
  if (!app.installDefaults || app.appType !== 'daemon') {
    setDetailMessage('Starting installation…')
    const result = await apex.install(app.key)
    if (result?.pending) {
      notifyParentNotificationsChanged()
      setDetailMessage('Installation started in the background. Check notifications when it completes.')
      await refresh()
      await renderDetail(app.key)
      return
    }
    await refresh()
    await renderDetail(app.key)
    return
  }

  try {
    installContext = await apex.getInstallContext()
  } catch {
    installContext = { nodes: [] }
  }

  const defaults = app.installDefaults
  const state = {
    step: 1,
    runtime: defaults.runtime ?? 'docker',
    placementTier: defaults.kube?.placement?.tier ?? 'any',
    selectedNodes: defaults.kube?.placement?.subdomains ?? [],
    volumes: structuredClone(defaults.volumes ?? []),
  }

  const overlay = document.createElement('div')
  overlay.className = 'apex-wizard-overlay'
  overlay.innerHTML = `
    <div class="apex-wizard" role="dialog" aria-modal="true">
      <div class="apex-wizard__header">
        <h3>Install ${app.name}</h3>
        <p>Step <span data-step-label>1</span> of 3</p>
      </div>
      <div class="apex-wizard__body" data-wizard-body></div>
      <div class="apex-wizard__actions">
        <button type="button" class="btn-muted" data-action="cancel">Cancel</button>
        <button type="button" class="btn-muted" data-action="back" hidden>Back</button>
        <button type="button" class="btn-primary" data-action="next">Next</button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)

  const bodyEl = overlay.querySelector('[data-wizard-body]')
  const stepLabel = overlay.querySelector('[data-step-label]')
  const backBtn = overlay.querySelector('[data-action="back"]')
  const nextBtn = overlay.querySelector('[data-action="next"]')

  const closeWizard = () => overlay.remove()

  const renderStep = () => {
    stepLabel.textContent = String(state.step)
    backBtn.hidden = state.step === 1
    nextBtn.textContent = state.step === 3 ? 'Install' : 'Next'

    if (state.step === 1) {
      bodyEl.innerHTML = `
        <h4>Runtime</h4>
        <p class="apex-wizard__hint">Choose how this app should run on your cluster.</p>
        <label class="apex-wizard__option">
          <input type="radio" name="runtime" value="kubernetes" ${state.runtime === 'kubernetes' ? 'checked' : ''}>
          <span><strong>Kubernetes</strong><small>Managed by rhost-kube with rollout and placement</small></span>
        </label>
        <label class="apex-wizard__option">
          <input type="radio" name="runtime" value="docker" ${state.runtime === 'docker' ? 'checked' : ''}>
          <span><strong>Docker</strong><small>Legacy single-container runtime on this host</small></span>
        </label>
      `
      bodyEl.querySelectorAll('input[name="runtime"]').forEach((input) => {
        input.addEventListener('change', () => {
          state.runtime = input.value
        })
      })
      return
    }

    if (state.step === 2) {
      const nodeOptions = installContext.nodes.length
        ? installContext.nodes.map((node) => `
            <label class="apex-wizard__option">
              <input type="checkbox" value="${node.nodeId}" ${state.selectedNodes.includes(node.nodeId) ? 'checked' : ''}>
              <span><strong>${node.publicHost || node.nodeId}</strong><small>${node.tier} · ${node.meshIp}${node.ready ? '' : ' · pending'}</small></span>
            </label>
          `).join('')
        : '<p class="apex-wizard__hint">No cluster nodes reported yet. Placement will default to any available node.</p>'

      bodyEl.innerHTML = `
        <h4>Placement</h4>
        <p class="apex-wizard__hint">Pick where pods should be scheduled.</p>
        <label class="apex-wizard__option">
          <input type="radio" name="placement" value="any" ${state.placementTier === 'any' ? 'checked' : ''}>
          <span><strong>Any node</strong><small>Let the scheduler choose</small></span>
        </label>
        <label class="apex-wizard__option">
          <input type="radio" name="placement" value="entry" ${state.placementTier === 'entry' ? 'checked' : ''}>
          <span><strong>Entry tier</strong><small>Front-door nodes only</small></span>
        </label>
        <div class="apex-wizard__nodes">${nodeOptions}</div>
      `

      bodyEl.querySelectorAll('input[name="placement"]').forEach((input) => {
        input.addEventListener('change', () => {
          state.placementTier = input.value
        })
      })
      bodyEl.querySelectorAll('.apex-wizard__nodes input[type="checkbox"]').forEach((input) => {
        input.addEventListener('change', () => {
          if (input.checked) {
            state.selectedNodes = [...new Set([...state.selectedNodes, input.value])]
          } else {
            state.selectedNodes = state.selectedNodes.filter((nodeId) => nodeId !== input.value)
          }
        })
      })
      return
    }

    bodyEl.innerHTML = `
      <h4>Volumes</h4>
      <p class="apex-wizard__hint">Review persistent storage that will be created at install time.</p>
      ${
        state.volumes.length
          ? `<ul class="apex-wizard__volumes">${state.volumes.map((volume) => `
              <li><strong>${volume.name}</strong> · ${volume.type}${volume.size ? ` · ${volume.size}` : ''} → ${volume.mountPath}</li>
            `).join('')}</ul>`
          : '<p class="apex-wizard__hint">No extra volumes configured for this app.</p>'
      }
      <div class="apex-wizard__summary">
        <div><span>Runtime</span><strong>${state.runtime}</strong></div>
        <div><span>Placement</span><strong>${state.selectedNodes.length ? state.selectedNodes.join(', ') : state.placementTier}</strong></div>
      </div>
    `
  }

  overlay.querySelector('[data-action="cancel"]').addEventListener('click', closeWizard)
  backBtn.addEventListener('click', () => {
    state.step = Math.max(1, state.step - 1)
    renderStep()
  })
  nextBtn.addEventListener('click', async () => {
    if (state.step < 3) {
      state.step += 1
      renderStep()
      return
    }

    nextBtn.disabled = true
    nextBtn.textContent = 'Starting…'
    try {
      const result = await apex.install(app.key, {
        runtime: state.runtime,
        kube: {
          placement: {
            tier: state.placementTier,
            subdomains: state.selectedNodes,
          },
        },
        volumes: state.volumes,
      })
      closeWizard()
      if (result?.pending) {
        notifyParentNotificationsChanged()
        setDetailMessage('Installation started in the background. Check notifications when it completes.')
      }
      await refresh()
      await renderDetail(app.key)
    } catch (error) {
      nextBtn.disabled = false
      nextBtn.textContent = 'Install'
      bodyEl.insertAdjacentHTML('beforeend', `<p class="apex-error">${error.message}</p>`)
    }
  })

  renderStep()
}

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
      await openInstallWizard(app)
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
