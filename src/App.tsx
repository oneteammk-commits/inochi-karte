import { RegistrationForm } from './components/RegistrationForm'
import { ViewPage } from './components/ViewPage'
import { EditPage } from './components/EditPage'
import { HomePage } from './components/HomePage'

function App() {
  const path = window.location.pathname
  const viewMatch = path.match(/^\/card\/(.+)$/)
  const editMatch = path.match(/^\/edit\/(.+)$/)

  if (editMatch) {
    return <EditPage id={editMatch[1]} />
  }
  if (viewMatch) {
    return <ViewPage id={viewMatch[1]} />
  }
  if (path === '/register') {
    return <RegistrationForm />
  }
  return <HomePage />
}

export default App
