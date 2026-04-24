import { useState, useEffect, useRef } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import WorldWorkspace from './WorldWorkspace'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/verify')
      .then(res => {
        if (res.ok) setIsAuthenticated(true)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return <div className="login-container">Carregando...</div>
  }

  return isAuthenticated ? (
    <Switch>
      <Route path="/">
        <Dashboard onLogout={() => setIsAuthenticated(false)} />
      </Route>
      <Route path="/world/:id">
        {params => <WorldWorkspace params={params} />}
      </Route>
    </Switch>
  ) : (
    <Login onLogin={() => setIsAuthenticated(true)} />
  )
}

function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (res.ok) {
        onLogin()
      } else {
        const data = await res.json()
        setError(data.error || 'Falha no login')
      }
    } catch (err) {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <h1>Mythra</h1>
        <p>Acesso Restrito ao Construtor de Mundos</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="password">Master Password</label>
            <input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha secreta"
              autoFocus
            />
          </div>
          
          {error && <div className="error-msg">{error}</div>}
          
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Dashboard({ onLogout }) {
  const [, setLocation] = useLocation()
  const [worlds, setWorlds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingWorld, setEditingWorld] = useState(null)
  const [deletingWorld, setDeletingWorld] = useState(null)

  const loadWorlds = async () => {
    try {
      const res = await fetch('/api/worlds')
      if (res.ok) {
        const data = await res.json()
        setWorlds(data.items || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorlds()
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    onLogout()
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="logo">Mythra</div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Criar Mundo
          </button>
          <button className="btn-secondary" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>
      
      <main className="dashboard-main">
        {loading ? (
          <p>Carregando mundos...</p>
        ) : worlds.length === 0 ? (
          <div className="empty-state">
            <h2>Nenhum mundo encontrado</h2>
            <p>Comece sua jornada criando seu primeiro mundo no botão superior direito.</p>
          </div>
        ) : (
          <div className="worlds-grid">
            {worlds.map(world => (
              <div key={world.id} className="world-card glass-panel" onClick={() => setLocation(`/world/${world.id}`)} style={{
                  backgroundImage: world.thumbnailUrl ? `url(${world.thumbnailUrl}?t=${Date.now()})` : 'none',
                  backgroundColor: !world.thumbnailUrl ? '#1e1e2f' : 'transparent'
                }}>
                <div className="world-card-overlay">
                  <div className="world-card-actions">
                    <button className="icon-btn edit-btn" onClick={(e) => { e.stopPropagation(); setEditingWorld(world); }}>Editar</button>
                    <button className="icon-btn delete-btn" onClick={(e) => { e.stopPropagation(); setDeletingWorld(world); }}>Deletar</button>
                  </div>
                  <h3>{world.displayName || world.name}</h3>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <CreateWorldModal 
          onClose={() => setShowModal(false)} 
          onCreated={() => {
            setShowModal(false)
            loadWorlds()
          }} 
        />
      )}
      
      {editingWorld && (
        <EditWorldModal 
          world={editingWorld}
          onClose={() => setEditingWorld(null)} 
          onUpdated={() => {
            setEditingWorld(null)
            loadWorlds()
          }} 
        />
      )}

      {deletingWorld && (
        <DeleteWorldModal 
          world={deletingWorld}
          onClose={() => setDeletingWorld(null)} 
          onDeleted={() => {
            setDeletingWorld(null)
            loadWorlds()
          }} 
        />
      )}
    </div>
  )
}

function CreateWorldModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailBase64, setThumbnailBase64] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem válida.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setThumbnailBase64(event.target.result)
      setPreviewUrl(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await fetch('/api/worlds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          thumbnailBase64
        })
      })

      if (res.ok) {
        onCreated()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao criar mundo')
      }
    } catch (err) {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel">
        <h2>Criar Novo Mundo</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Nome do Mundo</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Ex: Faerûn, Arrakis..." 
              required
              autoFocus
            />
          </div>
          
          <div className="input-group">
            <label>Descrição Curta</label>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Um universo de fantasia..." 
            />
          </div>

          <div className="input-group">
            <label>Thumbnail (Imagem de Capa)</label>
            <div 
              className="thumbnail-upload-area" 
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" />
              ) : (
                <span>Clique para selecionar uma imagem</span>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Criando...' : 'Criar Mundo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditWorldModal({ world, onClose, onUpdated }) {
  const [name, setName] = useState(world.displayName || '')
  const [description, setDescription] = useState(world.description || '')
  const [thumbnailBase64, setThumbnailBase64] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(world.thumbnailUrl || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem válida.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setThumbnailBase64(event.target.result)
      setPreviewUrl(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await fetch(`/api/worlds/${world.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          thumbnailBase64
        })
      })

      if (res.ok) {
        onUpdated()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao editar mundo')
      }
    } catch (err) {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel">
        <h2>Editar Mundo</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Nome do Mundo</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>
          
          <div className="input-group">
            <label>Descrição Curta</label>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
            />
          </div>

          <div className="input-group">
            <label>Nova Thumbnail (Opcional)</label>
            <div 
              className="thumbnail-upload-area" 
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" />
              ) : (
                <span>Clique para selecionar uma imagem</span>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteWorldModal({ world, onClose, onDeleted }) {
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async (e) => {
    e.preventDefault()
    
    const targetName = world.displayName || world.name
    if (confirmName !== targetName) {
      setError('O nome digitado não confere.')
      return
    }

    setError('')
    setDeleting(true)

    try {
      const res = await fetch(`/api/worlds/${world.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        onDeleted()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao deletar mundo')
      }
    } catch (err) {
      setError('Erro de conexão')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel" style={{ borderColor: 'var(--error-color)' }}>
        <h2 style={{ color: 'var(--error-color)' }}>Deletar Mundo</h2>
        <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
          Tem certeza de que deseja deletar o mundo <strong>{world.displayName || world.name}</strong>? Esta ação é irreversível e apagará todas as páginas e imagens permanentemente.
        </p>
        <form onSubmit={handleDelete}>
          <div className="input-group">
            <label>Para confirmar, digite o nome do mundo:</label>
            <input 
              type="text" 
              value={confirmName} 
              onChange={e => setConfirmName(e.target.value)} 
              placeholder={world.displayName || world.name}
              required
              autoFocus
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={deleting}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--error-color)' }} disabled={deleting || confirmName !== (world.displayName || world.name)}>
              {deleting ? 'Deletando...' : 'Sim, Deletar Mundo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
