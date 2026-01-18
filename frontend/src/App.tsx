import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Settings from './pages/Settings';
import TopicDetail from './pages/TopicDetail';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600">
            D2E Content Creator
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
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
