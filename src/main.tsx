import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './app/App.tsx'

function UpdateAvailable() {
  const [show, setShow] = useState(false)
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        updateSWRef.current = updateSW
        setShow(true)
      },
    })
  }, [])

  if (!show) return null

  return (
    <div className="update-banner" role="alert">
      <span>Update available — </span>
      <button type="button" onClick={() => updateSWRef.current?.(true)}>Reload</button>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateAvailable />
  </StrictMode>,
)
