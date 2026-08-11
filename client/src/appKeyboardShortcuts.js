export function preventNativeSelectAll(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'a') return
  event.preventDefault()
}
