import { RegistrationForm } from './components/RegistrationForm'
import { ViewPage } from './components/ViewPage'
import { EditPage } from './components/EditPage'

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
  return <RegistrationForm />
}

export default App
