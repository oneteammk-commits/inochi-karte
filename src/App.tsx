import { RegistrationForm } from './components/RegistrationForm'
import { ViewPage } from './components/ViewPage'
import { EditPage } from './components/EditPage'
import { HomePage } from './components/HomePage'
import { PetCardPage } from './components/PetCardPage'

function App() {
  const path = window.location.pathname
  const viewMatch = path.match(/^\/card\/(.+)$/)
  const editMatch = path.match(/^\/edit\/(.+)$/)
  const petMatch = path.match(/^\/pet\/(.+)$/)

  if (editMatch) {
    return <EditPage id={editMatch[1]} />
  }
  if (petMatch) {
    return <PetCardPage petId={petMatch[1]} />
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
