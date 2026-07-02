import { describe, expect, it } from "vitest"
import { groupIntoExchanges } from "./exchanges"
import type { Message } from "./chat-state"

const u = (id: string): Message => ({ id, role: "user", content: "Q" })
const a = (id: string): Message => ({ id, role: "assistant", content: "A" })

describe("groupIntoExchanges", () => {
  it("returns empty array for empty messages", () => {
    expect(groupIntoExchanges([])).toEqual([])
  })

  it("pairs user + assistant into one exchange", () => {
    const result = groupIntoExchanges([u("u1"), a("a1")])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("u1")
    expect(result[0].index).toBe(0)
    expect(result[0].user.id).toBe("u1")
    expect(result[0].assistant?.id).toBe("a1")
  })

  it("handles trailing user message with no reply yet", () => {
    const result = groupIntoExchanges([u("u1"), a("a1"), u("u2")])
    expect(result).toHaveLength(2)
    expect(result[1].assistant).toBeNull()
  })

  it("assigns sequential index values", () => {
    const msgs = [u("u1"), a("a1"), u("u2"), a("a2")]
    const result = groupIntoExchanges(msgs)
    expect(result[0].index).toBe(0)
    expect(result[1].index).toBe(1)
  })

  it("uses the user message id as exchange id", () => {
    const result = groupIntoExchanges([u("user-abc"), a("asst-xyz")])
    expect(result[0].id).toBe("user-abc")
  })
})
