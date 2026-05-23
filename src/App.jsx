import { Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout.jsx'
import Home from './pages/Home.jsx'
import Explore from './pages/Explore.jsx'
import NoteDetail from './pages/NoteDetail.jsx'
import Upload from './pages/Upload.jsx'
import EditNote from './pages/EditNote.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Profile from './pages/Profile.jsx'
import TodayRevision from './pages/TodayRevision.jsx'
import WalkMode from './pages/WalkMode.jsx'
import TravelMode from './pages/TravelMode.jsx'
import Problems from './pages/Problems.jsx'
import ProblemDetail from './pages/ProblemDetail.jsx'
import MistakeBook from './pages/MistakeBook.jsx'
import EmailSettings from './pages/EmailSettings.jsx'
import CursorGlow from './components/CursorGlow.jsx'

export default function App() {
  return (
    <>
      <CursorGlow />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="library" element={<Explore />} />
          <Route path="explore" element={<Explore />} />
          <Route path="add-note" element={<Upload />} />
          <Route path="upload" element={<Upload />} />
          <Route path="note/:id" element={<NoteDetail />} />
          <Route path="edit/:id" element={<EditNote />} />
          <Route path="revision/today" element={<TodayRevision />} />
          <Route path="walk-mode" element={<WalkMode />} />
          <Route path="travel-mode" element={<TravelMode />} />
          <Route path="problems" element={<Problems />} />
          <Route path="problems/:id" element={<ProblemDetail />} />
          <Route path="mistakes" element={<MistakeBook />} />
          <Route path="email-settings" element={<EmailSettings />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </>
  )
}
