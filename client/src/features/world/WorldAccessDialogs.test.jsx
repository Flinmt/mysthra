import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocumentPermissionsDialog } from './WorldAccessDialogs'

const labels = {
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'dashboard.no_access': 'None',
  'workspace.document_access_admin': 'Admin',
  'workspace.document_access_read': 'Read',
  'workspace.document_access_write': 'Write',
  'workspace.document_permissions': 'Document permissions',
  'workspace.document_permissions_inherit': 'Inherit permissions',
  'workspace.document_permissions_users': 'Members',
  'workspace.document_permissions_visitors': 'Visitors',
  'workspace.loading_permissions': 'Loading permissions',
  'workspace.no_members': 'No members'
}

const t = key => labels[key] || key

function createPanel(overrides = {}) {
  return {
    isOpen: true,
    loading: false,
    draft: { inherit: false, users: {} },
    members: [{ userId: 'alice', user: { username: 'Alice' }, documentAccess: 'read' }],
    visitorAccess: 'none',
    error: '',
    ...overrides
  }
}

afterEach(cleanup)

describe('DocumentPermissionsDialog', () => {
  it('updates inheritance and explicit member access through its controls', async () => {
    const user = userEvent.setup()
    const setPanel = vi.fn()
    const setUserAccess = vi.fn()

    render(
      <div className="workspace-container">
        <DocumentPermissionsDialog
          t={t}
          panel={createPanel()}
          setPanel={setPanel}
          document={{ name: 'Lore' }}
          savePermissions={vi.fn()}
          setUserAccess={setUserAccess}
        />
      </div>
    )

    await user.click(screen.getByRole('checkbox', { name: 'Inherit permissions' }))
    expect(setPanel).toHaveBeenCalledOnce()
    expect(setPanel.mock.calls[0][0](createPanel()).draft.inherit).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Write' }))
    expect(setUserAccess).toHaveBeenCalledWith('alice', 'write')
  })

  it('uses a permission-owned loading indicator', () => {
    const { container } = render(
      <div className="workspace-container">
        <DocumentPermissionsDialog
          t={t}
          panel={createPanel({ loading: true })}
          setPanel={vi.fn()}
          document={{ name: 'Lore' }}
          savePermissions={vi.fn()}
          setUserAccess={vi.fn()}
        />
      </div>
    )

    expect(screen.getByText('Loading permissions')).toBeTruthy()
    expect(container.querySelector('.document-permissions-loading-lines')).toBeTruthy()
    expect(container.querySelector('.sidebar-local-loading-lines')).toBeNull()
  })
})
