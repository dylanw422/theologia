import type { Message } from "./chat-state"

export type Exchange = {
  id: string
  index: number
  user: Message
  assistant: Message | null
}

export function groupIntoExchanges(messages: Message[]): Exchange[] {
  const exchanges: Exchange[] = []
  for (let i = 0; i < messages.length; i += 2) {
    const user = messages[i]
    const assistant = messages[i + 1] ?? null
    exchanges.push({ id: user.id, index: exchanges.length, user, assistant })
  }
  return exchanges
}
