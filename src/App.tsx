import { AppProviders } from './app/AppProviders'
import { DisplayModeProvider } from './app/DisplayModeContext'
import { AppRouter } from './app/router'

function App() {
  return (
    <AppProviders>
      <DisplayModeProvider><AppRouter /></DisplayModeProvider>
    </AppProviders>
  )
}

export default App
