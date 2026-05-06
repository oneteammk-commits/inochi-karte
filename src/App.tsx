import { RegistrationForm } from './components/RegistrationForm'
import { ViewPage } from './components/ViewPage'

function App() {
  const path = window.location.pathname
  const viewMatch = path.match(/^\/card\/(.+)$/)

  if (viewMatch) {
    return <ViewPage id={viewMatch[1]} />
  }

  return <RegistrationForm />
}

export default App
