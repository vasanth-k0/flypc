# App Management Restructure

> Warm-start, lifecycle split: **k3s (rhost-kube)** for daemon/autorun vs **docker/podman on-demand** for other workloads.  
> Status: **implementation in progress** (2026-08-13)

---

## Architecture decision

Apps are routed by `service.json` into two management paths:

| Path | When | Engine | Boot behaviour | User opens app | User closes window |
|------|------|--------|----------------|----------------|-------------------|
| **Kubernetes** | `type: daemon` + (`autorun: true` **or** `runtime: kubernetes`) | rhost-kube / k3s | Reconcile on server boot (round-robin) | Reconcile / ensure running | No stop — workload stays in cluster |
| **Session container** | `type: daemon` + image, not k8s-managed | `containerProgram` or system default | Nothing on boot | Start / **unpause** container | **Pause** container (not stop) |
| **Static view** | `type: run-once` | None (embedded view) | Nothing | Serve view URL | Nothing |
| **TTY daemon** | `image: false` + `ports.tty` | ttyd session | Nothing | Start tty session | Stop session |
| **Stack** | konnect, rhost-kube | Compose | Compose-managed | Proxy URL | N/A |

### service.json fields

```jsonc
{
  "type": "daemon",           // or "run-once"
  "autorun": true,            // → k3s via rhost-kube
  "runtime": "kubernetes",    // explicit k3s (also triggers k3s path)
  "containerProgram": "docker", // per-app override for on-demand: "docker" | "podman"
  "image": "nextcloud:latest",
  "kube": { /* placement, replicas, ingress, … */ }
}
```

**Classification** (`AppLifecyclePolicy.ts`):

- `isKubernetesManaged` → `daemon` + image + (`autorun === true` OR `runtime === 'kubernetes'`)
- `isSessionContainer` → `daemon` + image + NOT k8s-managed (OnlyOffice, etc.)
- `run-once` → static app (CodeRun Lite, Notepad), no container lifecycle

---

## Boot flow (rhost-console)

```
bootstrap()
  ├─ initializeDatabase()
  ├─ startNotificationCleanup()
  └─ app.listen() → HTTP up
       └─ async AppWarmStartService.runKubernetesWarmStartOnBoot()
            └─ round-robin: for each appKey, for each user
                 └─ POST rhost-kube reconcile (k3s manifests)
```

On-demand docker apps are **not** started on boot — only when the user opens the app.

Progress: `GET /apps/warm-start/status`

---

## User session flow

### Kubernetes / autorun daemon

```
User opens app
  → POST /apps/:key/start
  → reconcileKubernetesWorkload → rhost-kube
  → return ingress URL or host port URL

User closes window
  → (no pause/stop — cluster keeps running)
```

### Session container (OnlyOffice, etc.)

```
User opens app
  → POST /apps/:key/start
  → if paused → docker unpause
  → if stopped → docker start (preserve container)
  → if missing → docker run -d

User closes window (X button)
  → POST /apps/:key/pause (explicit + unmount hook)
  → docker pause (container preserved, memory frozen)

User switches to another app (without closing)
  → container keeps running (background tab behaviour)
```

### Static view (CodeRun Lite, Notepad)

```
User opens app → view URL only, no container
User closes window → nothing
```

---

## Implementation map

| File | Status | Role |
|------|--------|------|
| `services/AppLifecyclePolicy.ts` | ✅ | Route apps to k3s vs on-demand vs run-once |
| `services/AppWarmStartService.ts` | ✅ | K3s boot reconcile, round-robin |
| `services/Container.ts` | ✅ | pause, unpause, paused status, preserveStopped start |
| `services/AppService.ts` | ✅ | Lifecycle routing; pauseApp; k8s start path |
| `services/AppControlsService.ts` | ✅ | buildKubernetesAppUrl, reconcile helpers |
| `types/ServiceDefinition.ts` | ✅ | `containerProgram`, `paused` status |
| `server/src/index.ts` | ✅ | Boot hook after listen |
| `routers/AppsRouter.ts` | ✅ | `POST /pause`, `GET /warm-start/status` |
| `controllers/AppController.ts` | ✅ | pauseAppHandler |
| `client/.../App.ts` | ✅ | pause() client |
| `client/.../AppWindow.tsx` | ✅ | pause on unmount (not stop) |
| `services/AppBootService.ts` | ✅ | Sequential boot checklist for port-serving apps |
| `services/AppRouteService.ts` | ✅ | Caddy gateway proxy routes (`/apps/:key/proxy/`) |
| `controllers/AppControlsController.ts` | ✅ | service-config, boot-status, proxy handlers |
| `client/.../AppControlPane.tsx` | ✅ | Overview + k8s tabs (runtime/volumes/placement) |
| `client/.../AppBootChecklist.tsx` | ✅ | Boot step UI during app start |
| `client/.../useAppBoot.ts` | ✅ | Poll boot-status; skip checklist for static apps |

---

## Control pane + boot UX

| Feature | Behaviour |
|---------|-----------|
| **Service config** | Read-only for all users; admins can edit `env` overrides |
| **App URL** | Port apps load via same-origin proxy `/apps/{key}/proxy/` |
| **Boot checklist** | Sequential steps (image → container → port → HTTP) for port-serving apps |
| **Poll intervals** | run-once/static: skip; daemons 2s/180s; on-demand 3s/300s |
| **Static apps** | Notepad, CodeRun skip checklist — load `/apps/{key}/view/` directly |
| **Control pane tabs** | k8s apps: Overview + Runtime/Volumes/Placement; docker: Overview only |

---

## API surface

| Route | Purpose |
|--------|---------|
| `POST /apps/:key/start` | Unpause/start container OR reconcile k8s workload |
| `POST /apps/:key/pause` | Pause on-demand container; no-op for k8s/run-once |
| `POST /apps/:key/stop` | Admin/uninstall/TTL — stops container; k8s stays running |
| `DELETE /apps/:key/container` | Remove docker container |
| `GET /apps/warm-start/status` | Boot reconcile progress |

---

## Round-robin order

```ts
for (const appKey of sortedAppKeys) {
  if (!isKubernetesManaged(service)) continue
  for (const username of catalog[appKey].users) {
    await provisionKubernetesWorkload(appKey, username, service)
  }
}
```

Example: user1/app1 → user2/app1 → user1/app2 → user2/app2

---

## Remaining work

- [ ] Apex install: set `runtime: kubernetes` when `autorun: true` in catalog templates
- [ ] K8s scale-to-zero on window close (optional future — not in v1)
- [ ] Admin UI for warm-start progress
- [ ] Per-app `autorunDelayMs` before pause (on-demand warm-start if needed later)
- [ ] E2E tests for pause/unpause and k8s reconcile paths
- [ ] Document `containerProgram` in STANDARDS.md / Apex catalog README

---

## Risks

1. **Memory:** Paused on-demand containers still consume memory.
2. **Boot time:** Sequential k3s reconcile can be slow for many users/apps.
3. **K8s always-on:** Autorun workloads stay running when window closes (by design).
4. **Port binding:** On-demand containers bind ports only while running/unpaused.
5. **rhost-kube dependency:** Boot reconcile fails gracefully if cluster not ready (logged, skipped).

---

## Previous design (superseded)

The original draft proposed **docker run + pause for all apps on boot**. That is replaced by:

- **K3s reconcile on boot** for autorun/daemon/k8s apps
- **Docker/podman on demand only** for other daemon apps
- **Pause on close** (not stop) for on-demand containers

---

## Validation checklist

- [ ] Set `autorun: true` on a daemon app → boot reconcile via rhost-kube
- [ ] Open/close on-demand daemon → container pauses, reopens without cold start
- [ ] Run-once app (notepad) → no container, view works
- [ ] `containerProgram: podman` in service.json → uses podman for that app
- [ ] `GET /apps/warm-start/status` shows progress after boot
