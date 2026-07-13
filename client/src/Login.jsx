import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Flame, KeyRound, LogIn, ShieldCheck, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const ROOT_FALLBACK = { id: 'root', username: 'admin', globalRole: 'root' }

function getRoleLabel(t, user) {
  if (user.globalRole === 'root') return t('login.root_user')
  if (user.globalRole === 'server-admin') return t('login.server_admin_user')
  return null
}

function UserCombobox({ users, query, selectedUser, error, onQueryChange, onSelect }) {
  const { t } = useTranslation()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return users
    return users.filter(user => user.username.toLowerCase().includes(normalized))
  }, [query, users])

  useEffect(() => {
    const closeOnOutsidePointer = event => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [])

  useEffect(() => {
    if (activeIndex >= filteredUsers.length) setActiveIndex(filteredUsers.length - 1)
  }, [activeIndex, filteredUsers.length])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const activeUser = filteredUsers[activeIndex]
    if (!activeUser) return
    listRef.current
      ?.querySelector(`#login-user-option-${CSS.escape(activeUser.id)}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, filteredUsers, open])

  const selectUser = user => {
    onSelect(user)
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      if (filteredUsers.length > 0) {
        setActiveIndex(index => index >= filteredUsers.length - 1 ? 0 : index + 1)
      }
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (filteredUsers.length > 0) {
        setActiveIndex(index => index <= 0 ? filteredUsers.length - 1 : index - 1)
      }
      return
    }
    if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault()
      selectUser(filteredUsers[activeIndex])
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const activeOptionId = open && activeIndex >= 0 ? `login-user-option-${filteredUsers[activeIndex]?.id}` : undefined

  return (
    <div ref={rootRef} className="auth-combobox">
      <div className={`auth-input-shell ${error ? 'has-error' : ''}`}>
        <UserRound size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          id="login-username"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="login-user-listbox"
          aria-expanded={open}
          aria-activedescendant={activeOptionId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'login-username-error' : undefined}
          value={query}
          onChange={event => {
            onQueryChange(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t('login.username_placeholder')}
          autoComplete="off"
          autoFocus
        />
        <button
          type="button"
          className="auth-combobox-toggle"
          onClick={() => {
            setOpen(value => !value)
            setActiveIndex(-1)
            inputRef.current?.focus()
          }}
          aria-label={open ? t('login.close_user_dropdown') : t('login.open_user_dropdown')}
          tabIndex={-1}
        >
          <ChevronDown size={16} className={open ? 'open' : ''} />
        </button>
      </div>

      {open && (
        <div ref={listRef} id="login-user-listbox" className="auth-user-list" role="listbox" aria-label={t('login.available_users')}>
          {filteredUsers.length === 0 ? (
            <div className="auth-user-empty">{t('login.no_users_found')}</div>
          ) : filteredUsers.map((user, index) => {
            const role = getRoleLabel(t, user)
            const selected = selectedUser?.id === user.id
            return (
              <button
                id={`login-user-option-${user.id}`}
                key={user.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`auth-user-option ${selected ? 'selected' : ''} ${activeIndex === index ? 'active' : ''}`}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => selectUser(user)}
              >
                <span className={`auth-user-avatar role-${user.globalRole || 'user'}`}>{user.username.slice(0, 1).toUpperCase()}</span>
                <span className="auth-user-copy"><strong>{user.username}</strong>{role && <small>{role}</small>}</span>
                {selected && <ShieldCheck size={15} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Login({ onLogin, languageSwitcher }) {
  const { t } = useTranslation()
  const [users, setUsers] = useState([ROOT_FALLBACK])
  const [selectedUser, setSelectedUser] = useState(null)
  const [query, setQuery] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/users')
      .then(async response => {
        if (!response.ok) return
        const data = await response.json()
        setUsers(data.items?.length ? data.items : [ROOT_FALLBACK])
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async event => {
    event.preventDefault()
    setFieldError('')
    setAuthError('')

    const exactUser = users.find(user => user.username.toLowerCase() === query.trim().toLowerCase())
    const loginUser = selectedUser?.username.toLowerCase() === query.trim().toLowerCase() ? selectedUser : exactUser
    if (!loginUser) {
      setFieldError(t('login.select_user_first'))
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser.username, password })
      })
      const data = await response.json()
      if (!response.ok) {
        setAuthError(data.error || t('login.failed'))
        return
      }
      onLogin(data.user)
    } catch {
      setAuthError(t('common.error_connection'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-language">{languageSwitcher}</div>
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-brand">
          <span className="auth-brand-mark"><Flame size={18} aria-hidden="true" /></span>
          <div><h1 id="login-title">Mysthra</h1><p>{t('login.subtitle')}</p></div>
        </div>

        <div className="auth-divider" aria-hidden="true" />

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <span className="auth-field-label">{t('login.username')}</span>
            <UserCombobox
              users={users}
              query={query}
              selectedUser={selectedUser}
              error={fieldError}
              onQueryChange={value => {
                setQuery(value)
                setSelectedUser(null)
                setFieldError('')
                setAuthError('')
              }}
              onSelect={user => {
                setSelectedUser(user)
                setQuery(user.username)
                setFieldError('')
                setAuthError('')
              }}
            />
            {fieldError && <small id="login-username-error" className="auth-field-error">{fieldError}</small>}
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">{t('login.password')}</label>
            <span className="auth-input-shell">
              <KeyRound size={16} aria-hidden="true" />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={event => { setPassword(event.target.value); setAuthError('') }}
                placeholder={t('login.password_placeholder')}
                autoComplete="current-password"
                required
              />
            </span>
          </div>

          {authError && <div className="auth-error" role="alert">{authError}</div>}

          <button type="submit" className="auth-submit" disabled={loading || !password}>
            {loading ? <span>{t('login.authenticating')}</span> : <><LogIn size={17} /><span>{t('login.enter')}</span></>}
          </button>
        </form>
      </section>
    </main>
  )
}
