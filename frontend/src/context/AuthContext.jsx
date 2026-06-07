import { createContext, useContext, useState, useEffect } from 'react'
import { getProfil, login as apiLogin, register as apiRegister } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [utilizator, setUtilizator] = useState(null)
  const [gata, setGata] = useState(false)   // s-a terminat verificarea initiala?

  // La pornire: daca exista token, incarca profilul
  useEffect(() => {
    if (localStorage.getItem('token')) {
      getProfil()
        .then(setUtilizator)
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setGata(true))
    } else {
      setGata(true)
    }
  }, [])

  // Autentificare
  async function login(email, parola) {
    const { access_token } = await apiLogin(email, parola)
    localStorage.setItem('token', access_token)
    setUtilizator(await getProfil())
  }

  // Inregistrare (te si loghează automat)
  async function register(email, parola, nume) {
    const { access_token } = await apiRegister(email, parola, nume)
    localStorage.setItem('token', access_token)
    setUtilizator(await getProfil())
  }

  // Deconectare
  function logout() {
    localStorage.removeItem('token')
    setUtilizator(null)
  }

  return (
    <AuthContext.Provider value={{ utilizator, login, register, logout, gata }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
