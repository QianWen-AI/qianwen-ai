import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import MobileTabs from './components/MobileTabs.jsx'
import { PAGE_TITLES } from './data/skills.js'
import Dashboard from './pages/Dashboard.jsx'
import TextChat from './pages/TextChat.jsx'
import ImageGen from './pages/ImageGen.jsx'
import VideoGen from './pages/VideoGen.jsx'
import AudioTTS from './pages/AudioTTS.jsx'
import Vision from './pages/Vision.jsx'
import Models from './pages/Models.jsx'
import Usage from './pages/Usage.jsx'
import History from './pages/History.jsx'
import Settings from './pages/Settings.jsx'

const PAGES = {
  dashboard: Dashboard,
  text: TextChat,
  image: ImageGen,
  video: VideoGen,
  audio: AudioTTS,
  vision: Vision,
  models: Models,
  usage: Usage,
  history: History,
  settings: Settings,
}

function readHash() {
  const key = window.location.hash.replace('#/', '')
  return PAGES[key] ? key : 'dashboard'
}

export default function App() {
  const [page, setPage] = useState(readHash)
  const mainRef = useRef(null)

  useEffect(() => {
    window.location.hash = `/${page}`
    mainRef.current?.scrollTo({ top: 0 })
    document.title = `${PAGE_TITLES[page] || '控制台总览'} · QianWen AI Console`
  }, [page])

  const Page = PAGES[page]

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar active={page} onChange={setPage} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar page={page} />
        <MobileTabs active={page} onChange={setPage} />
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <div
            key={page}
            className="fade-in mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8"
          >
            <Page onNavigate={setPage} />
          </div>
        </main>
      </div>
    </div>
  )
}
