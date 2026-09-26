import type { Channel, NotificationProvider, OutgoingMessage, Recipient, SendResult } from './types.ts'
import { ALL_PROVIDERS } from './providers.ts'

export type { Channel, NotificationProvider, OutgoingMessage, Recipient, SendResult }

// Which channels to use, from NOTIFY_CHANNELS (default "email,sms,messenger").
export function enabledProviders(
  providers: NotificationProvider[] = ALL_PROVIDERS,
  channels = Deno.env.get('NOTIFY_CHANNELS') ?? 'email,sms,messenger',
): NotificationProvider[] {
  const wanted = new Set(channels.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean))
  return providers.filter((p) => wanted.has(p.channel))
}

// Send one message to one recipient on every enabled channel. Never throws —
// each channel's outcome is returned so it can be logged.
export async function notify(
  recipient: Recipient,
  message: OutgoingMessage,
  opts: { providers?: NotificationProvider[]; skipChannels?: Set<Channel> } = {},
): Promise<SendResult[]> {
  const providers = opts.providers ?? enabledProviders()
  const results: SendResult[] = []
  for (const p of providers) {
    if (opts.skipChannels?.has(p.channel)) continue
    const address = p.addressFor(recipient)
    if (!p.isConfigured()) {
      results.push({ channel: p.channel, recipient: address, status: 'skipped', error: 'Channel not configured' })
      continue
    }
    if (!address) {
      results.push({ channel: p.channel, recipient: null, status: 'skipped', error: 'No address for this customer' })
      continue
    }
    try {
      await p.send(address, message)
      results.push({ channel: p.channel, recipient: address, status: 'sent' })
    } catch (e) {
      results.push({ channel: p.channel, recipient: address, status: 'failed', error: (e as Error).message })
    }
  }
  return results
}
