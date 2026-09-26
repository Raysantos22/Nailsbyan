import { Link } from 'react-router-dom'
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { Facebook } from '../components/icons.jsx'
import { useBusiness } from '../lib/BusinessContext.jsx'
import { isPlaceholder, mapsEmbedUrl, mapsLink, messengerLink } from '../lib/format.js'
import { OpeningHours } from '../components/Layout.jsx'
import { PageHeader } from '../components/ui.jsx'

export default function Contact() {
  const { business } = useBusiness()
  const mLink = messengerLink(business)
  const showMap = business.address && !isPlaceholder(business.address)

  return (
    <>
      <PageHeader eyebrow="Say hello" title="Contact & location">
        The quickest way to reach us is Facebook Messenger.
      </PageHeader>
      <div className="container-page grid gap-8 py-10 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-sans text-lg font-semibold">Get in touch</h2>
            <ul className="mt-4 space-y-4 text-sm">
              {business.address && (
                <li className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-stone-600">{business.address}</p>
                    {showMap && (
                      <a href={mapsLink(business.address)} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                        Get directions
                      </a>
                    )}
                  </div>
                </li>
              )}
              {business.phone && (
                <li className="flex gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="text-stone-600 hover:underline">
                      {business.phone}
                    </a>
                  </div>
                </li>
              )}
              {business.email && (
                <li className="flex gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Email</p>
                    <a href={`mailto:${business.email}`} className="text-stone-600 hover:underline">
                      {business.email}
                    </a>
                  </div>
                </li>
              )}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              {mLink && (
                <a href={mLink} target="_blank" rel="noreferrer" className="btn bg-brand-600 text-white hover:bg-brand-700">
                  <MessageCircle className="h-4 w-4" /> Message us on Messenger
                </a>
              )}
              {business.facebook_page_url && (
                <a href={business.facebook_page_url} target="_blank" rel="noreferrer" className="btn-secondary">
                  <Facebook className="h-4 w-4" /> Facebook Page
                </a>
              )}
            </div>
          </div>
          <div className="card p-6">
            <h2 className="mb-4 font-sans text-lg font-semibold">Opening hours</h2>
            <OpeningHours hours={business.hours_json} />
          </div>
          <div className="text-center">
            <Link to="/book" className="btn-primary px-7 py-3 text-base">
              Book an appointment
            </Link>
          </div>
        </div>
        <div className="card min-h-80 overflow-hidden">
          {showMap ? (
            <iframe
              title={`Map showing ${business.name}`}
              src={mapsEmbedUrl(business.address)}
              className="h-full min-h-80 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-full min-h-80 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-stone-500">
              <MapPin className="h-8 w-8 text-brand-300" aria-hidden="true" />
              Map will appear here once the salon address is added.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
