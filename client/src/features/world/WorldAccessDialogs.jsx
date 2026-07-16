import { Globe2, Network, ShieldCheck, Users, X } from 'lucide-react'

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
    <div className="modal-backdrop document-permissions-backdrop" onClick={close}>
      <div className="user-admin-modal document-permissions-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="user-admin-modal-header">
          <div className="document-permissions-heading">
            <span className="document-permissions-heading-icon" aria-hidden="true"><ShieldCheck size={17} /></span>
            <div><h2>{t('workspace.document_permissions')}</h2><p>{document.name}</p></div>
          </div>
          <button type="button" className="user-admin-close" onClick={close} disabled={panel.loading} aria-label={t('common.cancel')}><X size={15} /></button>
        </div>
        <div className="user-admin-modal-body document-permissions-body">
          <label className="document-permissions-inherit">
            <input
              type="checkbox"
              checked={panel.draft.inherit}
              onChange={event => {
                const inherit = event.target.checked
                setPanel(previous => ({ ...previous, draft: { ...previous.draft, inherit } }))
              }}
              disabled={panel.loading}
            />
            <span className="document-permissions-inherit-icon" aria-hidden="true"><Network size={15} /></span>
            <span className="document-permissions-inherit-label">{t('workspace.document_permissions_inherit')}</span>
            <span className="document-permissions-switch" aria-hidden="true"><span /></span>
          </label>
          <div className="user-admin-section-title document-permissions-section-title"><Users size={13} /><span>{t('workspace.document_permissions_users')}</span></div>
          <div className="document-permissions-list">
            {panel.loading ? (
              <div className="user-admin-local-loading compact"><div className="document-permissions-loading-lines" aria-hidden="true"><span /><span /></div><strong>{t('workspace.loading_permissions')}</strong></div>
            ) : panel.members.length === 0 ? (
              <div className="user-admin-empty compact">{t('workspace.no_members')}</div>
            ) : panel.members.map(member => {
              const userId = member.userId
              const explicit = Object.prototype.hasOwnProperty.call(panel.draft.users || {}, userId)
              const access = explicit ? panel.draft.users[userId] : (member.documentAccess || 'none')
              return (
                <div key={userId} className="document-permissions-row">
                  <div className="document-permissions-identity">
                    <span className="document-permissions-avatar" aria-hidden="true">{(member.user?.username || userId).slice(0, 1).toUpperCase()}</span>
                  <strong>{member.user?.username || userId}</strong>
                  </div>
                  <div className="user-admin-role-segments" aria-label={t('workspace.document_permissions')}>
                    {accessOptions.map(([nextAccess, label]) => <button key={nextAccess} type="button" className={access === nextAccess ? 'active' : ''} aria-pressed={access === nextAccess} disabled={panel.loading} onClick={() => setUserAccess(userId, nextAccess)}><span>{label}</span></button>)}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="user-admin-section-title document-permissions-section-title"><Globe2 size={13} /><span>{t('workspace.document_permissions_visitors')}</span></div>
          <div className="document-permissions-list">
            <div className="document-permissions-row">
              <div className="document-permissions-identity">
                <span className="document-permissions-avatar" aria-hidden="true"><Globe2 size={13} /></span>
                <strong>{t('workspace.document_permissions_visitors')}</strong>
              </div>
              <div className="user-admin-role-segments segments-visitor" aria-label={t('workspace.document_permissions')}>
                {[['none', t('dashboard.no_access')], ['read', t('workspace.document_access_read')]].map(([access, label]) => {
                  const explicit = Object.prototype.hasOwnProperty.call(panel.draft.users || {}, 'visitor')
                  const current = explicit ? panel.draft.users.visitor : panel.visitorAccess
                  return <button key={access} type="button" className={current === access ? 'active' : ''} aria-pressed={current === access} disabled={panel.loading} onClick={() => setUserAccess('visitor', access)}><span>{label}</span></button>
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
