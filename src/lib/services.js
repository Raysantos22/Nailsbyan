// Helpers for the service menu (shared by the Services page and booking flow).

export function groupByCategory(services) {
  const groups = new Map()
  for (const s of services) {
    if (!groups.has(s.category)) groups.set(s.category, [])
    groups.get(s.category).push(s)
  }
  return [...groups.entries()]
}

// An add-on can be chosen once a main service is selected; if it is tied to
// a specific parent service, only when that parent is selected.
export function isAddonAvailable(addon, selectedIds) {
  if (!addon.is_addon) return true
  if (addon.parent_service_id) return selectedIds.includes(addon.parent_service_id)
  return selectedIds.length > 0
}

// Toggle a service in the selection, keeping main services before add-ons
// and dropping add-ons that are no longer valid.
export function toggleService(selectedIds, service, allServices) {
  const byId = Object.fromEntries(allServices.map((s) => [s.id, s]))
  let next = selectedIds.includes(service.id)
    ? selectedIds.filter((id) => id !== service.id)
    : [...selectedIds, service.id]
  const mains = next.filter((id) => byId[id] && !byId[id].is_addon)
  const addons = next.filter((id) => byId[id]?.is_addon && isAddonAvailable(byId[id], mains))
  next = [...mains, ...addons]
  return next
}

export function summarize(selectedIds, allServices) {
  const byId = Object.fromEntries(allServices.map((s) => [s.id, s]))
  const items = selectedIds.map((id) => byId[id]).filter(Boolean)
  return {
    items,
    total: items.reduce((sum, s) => sum + Number(s.price), 0),
    duration: items.reduce((sum, s) => sum + Number(s.duration_minutes), 0),
  }
}
