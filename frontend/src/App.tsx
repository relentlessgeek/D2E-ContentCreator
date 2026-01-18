import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Settings from './pages/Settings';
import TopicDetail from './pages/TopicDetail';
import StandaloneLessonDetail from './pages/StandaloneLessonDetail';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md transition-colors ${
        isActive
          ? 'bg-teal-500 text-white'
          : 'text-gray-600 hover:bg-teal-50 hover:text-teal-600'
      }`}
    >
      {children}
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-purple-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-teal-500 to-purple-500 bg-clip-text text-transparent">
                Content Magic
              </span>
              <span className="block text-xs text-gray-500">by Desk2Educate</span>
            </div>
          </Link>
          <nav className="flex gap-2">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="border-t bg-white py-4 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          Content Magic v{__APP_VERSION__} by Desk2Educate
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/topic/:id" element={<TopicDetail />} />
          <Route path="/standalone-lesson/:id" element={<StandaloneLessonDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
