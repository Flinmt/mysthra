export function enqueueWorkspaceToast(currentToasts, toast, limit = 4) {
  return [...currentToasts, toast].slice(-limit)
}
