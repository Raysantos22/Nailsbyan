import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { BusinessProvider } from './lib/BusinessContext.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import { Loading } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import Services from './pages/Services.jsx'
import Gallery from './pages/Gallery.jsx'
import Book from './pages/Book.jsx'
import Contact from './pages/Contact.jsx'
import MyBookings from './pages/MyBookings.jsx'
import NotFound from './pages/NotFound.jsx'

// The admin dashboard is only downloaded by staff.
const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'))

export default function App() {
  return (
    <BrowserRouter>
      <BusinessProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="services" element={<Services />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="book" element={<Book />} />
              <Route path="contact" element={<Contact />} />
              <Route path="my-bookings" element={<MyBookings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route
              path="admin/*"
              element={
                <Suspense fallback={<Loading label="Loading dashboard…" />}>
                  <AdminApp />
                </Suspense>
              }
            />
          </Routes>
        </AuthProvider>
      </BusinessProvider>
    </BrowserRouter>
  )
}
