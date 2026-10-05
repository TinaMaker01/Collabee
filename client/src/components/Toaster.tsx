import { Toaster as SonnerToaster } from 'sonner'
import { useTheme } from '../context/ThemeContext'

export function Toaster() {
  const { theme } = useTheme()
  return <SonnerToaster richColors position="top-right" theme={theme} />
}
