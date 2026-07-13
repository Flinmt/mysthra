import { Trash2 } from 'lucide-react'
import DropdownSelect from '../../components/ui/DropdownSelect'

export function WorldMembersDialog({ t, panel, setPanel, availableUsers, addExistingMember, createAndAddMember, removeMember, updateMemberRole }) {
  if (!panel.isOpen) return null
  const close = () => setPanel(previous => ({ ...previous, isOpen: false }))

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="user-admin-modal members-admin-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="user-admin-modal-header">
          <div><h2>{t('workspace.world_members')}</h2><p>{t('workspace.world_members_hint')}</p></div>
          <button type="button" className="user-admin-close" onClick={close} disabled={panel.loading} aria-label={t('common.cancel')}>×</button>
        </div>
        <div className="user-admin-modal-body members-admin-grid">
          <div className="user-admin-directory">
            <div className="user-admin-section-title">{t('workspace.current_members')}</div>
            {panel.loading && panel.members.length === 0 ? (
              <div className="user-admin-local-loading"><div className="sidebar-local-loading-lines" aria-hidden="true"><span /><span /><span /></div><strong>{t('workspace.loading_members')}</strong></div>
            ) : panel.members.length === 0 ? (
              <div className="user-admin-empty compact">{t('workspace.no_members')}</div>
            ) : (
              <div className="user-admin-list members-list">
                {panel.members.map(member => (
                  <div key={member.userId} className="member-row">
                    <div className="member-row-main"><strong>{member.user?.username || member.userId}</strong></div>
                    <div className="member-row-actions">
                      <div className="user-admin-role-segments" aria-label={t('workspace.member_role')}>
                        {[['member', t('workspace.member_role_member')], ['admin', t('workspace.member_role_admin')]].map(([role, label]) => (
                          <button key={role} type="button" className={member.role === role ? 'active' : ''} disabled={panel.loading} onClick={() => role !== member.role && updateMemberRole(member.userId, role)}>{label}</button>
                        ))}
                      </div>
                      <button type="button" className="user-admin-text-danger" onClick={() => removeMember(member.userId)} disabled={panel.loading}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="members-add-card">
            <div className="user-admin-section-title">{t('workspace.add_existing_member')}</div>
            <div className="member-form-row">
              <DropdownSelect value={panel.userId} onChange={userId => setPanel(previous => ({ ...previous, userId }))} options={availableUsers.map(user => ({ value: user.id, label: user.username }))} placeholder={t('workspace.select_user')} disabled={panel.loading || availableUsers.length === 0} />
              <button type="button" className="user-admin-secondary" onClick={addExistingMember} disabled={panel.loading || !panel.userId}>{t('common.add')}</button>
            </div>
            <div className="members-create-divider" />
            <div className="user-admin-section-title">{t('workspace.create_member_user')}</div>
            <div className="user-admin-form-stack">
              <input type="text" value={panel.username} onChange={event => setPanel(previous => ({ ...previous, username: event.target.value }))} placeholder={t('login.username_placeholder')} disabled={panel.loading} />
              <input type="password" value={panel.password} onChange={event => setPanel(previous => ({ ...previous, password: event.target.value }))} placeholder={t('login.password_placeholder')} disabled={panel.loading} />
              <button type="button" className="user-admin-primary" onClick={createAndAddMember} disabled={panel.loading || !panel.username.trim() || !panel.password}>{t('workspace.create_and_add_member')}</button>
            </div>
          </div>
        </div>
        {panel.error && <div className="user-admin-error">{panel.error}</div>}
      </div>
    </div>
  )
}

export function DocumentPermissionsDialog({ t, panel, setPanel, document, savePermissions, setUserAccess }) {
  if (!panel.isOpen || !document) return null
  const close = () => setPanel(previous => ({ ...previous, isOpen: false }))
  const accessOptions = [
    ['none', t('dashboard.no_access')],
    ['read', t('workspace.document_access_read')],
    ['write', t('workspace.document_access_write')],
    ['admin', t('workspace.document_access_admin')]
  ]

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="user-admin-modal document-permissions-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="user-admin-modal-header">
          <div><h2>{t('workspace.document_permissions')}</h2><p>{document.name}</p></div>
          <button type="button" className="user-admin-close" onClick={close} disabled={panel.loading} aria-label={t('common.cancel')}>×</button>
        </div>
        <div className="user-admin-modal-body document-permissions-body">
          <label className="document-permissions-inherit">
            <input type="checkbox" checked={panel.draft.inherit} onChange={event => setPanel(previous => ({ ...previous, draft: { ...previous.draft, inherit: event.target.checked } }))} disabled={panel.loading} />
            <span>{t('workspace.document_permissions_inherit')}</span>
          </label>
          <div className="user-admin-section-title">{t('workspace.document_permissions_users')}</div>
          <div className="document-permissions-list">
            {panel.loading ? (
              <div className="user-admin-local-loading compact"><div className="sidebar-local-loading-lines" aria-hidden="true"><span /><span /></div><strong>{t('workspace.loading_permissions')}</strong></div>
            ) : panel.members.length === 0 ? (
              <div className="user-admin-empty compact">{t('workspace.no_members')}</div>
            ) : panel.members.map(member => {
              const userId = member.userId
              const explicit = Object.prototype.hasOwnProperty.call(panel.draft.users || {}, userId)
              const access = explicit ? panel.draft.users[userId] : (member.documentAccess || 'none')
              return (
                <div key={userId} className="document-permissions-row">
                  <strong>{member.user?.username || userId}</strong>
                  <div className="user-admin-role-segments" aria-label={t('workspace.document_permissions')}>
                    {accessOptions.map(([nextAccess, label]) => <button key={nextAccess} type="button" className={access === nextAccess ? 'active' : ''} disabled={panel.loading} onClick={() => setUserAccess(userId, nextAccess)}>{label}</button>)}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="user-admin-section-title">{t('workspace.document_permissions_visitors')}</div>
          <div className="document-permissions-list">
            <div className="document-permissions-row">
              <strong>{t('workspace.document_permissions_visitors')}</strong>
              <div className="user-admin-role-segments segments-visitor" aria-label={t('workspace.document_permissions')}>
                {[['none', t('dashboard.no_access')], ['read', t('workspace.document_access_read')]].map(([access, label]) => {
                  const explicit = Object.prototype.hasOwnProperty.call(panel.draft.users || {}, 'visitor')
                  const current = explicit ? panel.draft.users.visitor : panel.visitorAccess
                  return <button key={access} type="button" className={current === access ? 'active' : ''} disabled={panel.loading} onClick={() => setUserAccess('visitor', access)}>{label}</button>
                })}
              </div>
            </div>
          </div>
          {panel.error && <div className="user-admin-error">{panel.error}</div>}
          <div className="document-permissions-actions">
            <button type="button" className="user-admin-secondary" onClick={close} disabled={panel.loading}>{t('common.cancel')}</button>
            <button type="button" className="user-admin-primary" onClick={savePermissions} disabled={panel.loading}>{panel.loading ? t('common.saving') : t('common.save')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
