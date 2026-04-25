import { useState, useEffect, useRef, useMemo } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { LogOut, Plus, Globe, Settings, Trash2, Edit3, Key, ShieldCheck, Sparkles, Search, Home, Layers, Layout as LayoutIcon, User } from 'lucide-react'
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

  return (
    <Switch>
      <Route path="/world/:id">
        {(params) => {
          const isVisitor = new URLSearchParams(window.location.search).get('view') === 'true';
          if (isAuthenticated || isVisitor) {
            return <WorldWorkspace params={params} />;
          }
          return <Login onLogin={() => setIsAuthenticated(true)} />;
        }}
      </Route>
      <Route path="/">
        {isAuthenticated ? (
          <Dashboard onLogout={() => setIsAuthenticated(false)} />
        ) : (
          <Login onLogin={() => setIsAuthenticated(true)} />
        )}
      </Route>
    </Switch>
  );
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
        <Sparkles size={40} color="var(--accent-color)" style={{ marginBottom: 16 }} />
        <h1>Mythra</h1>
        <p>A Forja de Mundos Interativos</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="password">
              <Key size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Master Password
            </label>
            <input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha de mestre..."
              autoFocus
            />
          </div>
          
          {error && <div className="error-msg">{error}</div>}
          
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? (
              'Autenticando...'
            ) : (
              <><ShieldCheck size={18} style={{ marginRight: 8 }} /> Entrar no Nexus</>
            )}
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
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredWorlds = useMemo(() => {
    return worlds.filter(w => 
      (w.displayName || w.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [worlds, searchQuery])

  return (
    <div className="dashboard-container">
      {/* Main Content Nexus */}
      <main className="nexus-main">
        <header className="nexus-header">
          <div className="welcome-msg">
            <h1 className="nexus-title-mysthra">Mysthra</h1>
            <p>Seus universos estão prontos para serem forjados.</p>
          </div>

          <div className="nexus-search-group">
            <div className="nexus-search-wrapper">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                className="nexus-search-bar"
                placeholder="Pesquisar universos..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <button className="nexus-icon-btn logout-btn-nexus" onClick={handleLogout} title="Sair do Nexus">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="loading-state-dashboard">
            <div className="spinner"></div>
            <p>Conectando ao Nexus...</p>
          </div>
        ) : (
          <div className="nexus-grid">
            {filteredWorlds.map(world => (
              <div key={world.id} className="nexus-card" onClick={() => setLocation(`/world/${world.id}`)}>
                <div 
                  className="nexus-card-bg" 
                  style={{ backgroundImage: world.thumbnailUrl ? `url(${world.thumbnailUrl})` : 'none' }}
                ></div>
                <div className="nexus-card-actions">
                  <button className="nexus-icon-btn" onClick={(e) => { e.stopPropagation(); setEditingWorld(world); }}>
                    <Settings size={14} />
                  </button>
                  <button className="nexus-icon-btn" onClick={(e) => { e.stopPropagation(); setDeletingWorld(world); }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="nexus-card-content">
                  <h3>{world.displayName || world.name}</h3>
                  <p>{world.description || 'Um universo em formação.'}</p>
                </div>
              </div>
            ))}
            
            {/* Create Card */}
            {!searchQuery && (
              <div className="nexus-card nexus-create-btn" onClick={() => setShowModal(true)}>
                <div className="plus-circle-nexus">
                  <Plus size={24} />
                </div>
                <div style={{ fontWeight: 600 }}>Criar Novo Mundo</div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals remain the same */}
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
  const [previewUrl, setPreviewUrl] = useState(world.thumbnailUrl ? `${world.thumbnailUrl}?v=${Date.now()}` : null)
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
