import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="text-sm font-semibold tracking-widest text-brand-600 uppercase">404</p>
      <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-stone-600">The page you’re looking for doesn’t exist.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/" className="btn-secondary">
          Home
        </Link>
        <Link to="/book" className="btn-primary">
          Book now
        </Link>
      </div>
    </div>
  )
}
