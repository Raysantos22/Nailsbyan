// Provider interface: booking logic builds a channel-agnostic message and
// hands it to whichever providers are enabled. Add/swap a channel by adding
// a provider — nothing in the booking code changes.

export type Channel = 'email' | 'sms' | 'messenger'

export interface Recipient {
  name: string
  email?: string | null
  phone?: string | null
  // Page-scoped Messenger id; only known once the customer has messaged the Page
  messengerPsid?: string | null
}

export interface OutgoingMessage {
  subject: string
  text: string // plain text (SMS, Messenger, email fallback)
  html?: string // rich email body
}

export interface NotificationProvider {
  channel: Channel
  // Env vars present?
  isConfigured(): boolean
  // Address for this channel, or null if the recipient can't be reached on it.
  addressFor(recipient: Recipient): string | null
  send(address: string, message: OutgoingMessage): Promise<void>
}

export interface SendResult {
  channel: Channel
  recipient: string | null
  status: 'sent' | 'failed' | 'skipped'
  error?: string
}
