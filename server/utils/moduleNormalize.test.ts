import { describe, expect, it } from "vitest";
import { normalizeAgentToModule } from "./moduleNormalize";

describe("normalizeAgentToModule", () => {
  it("normalizes missing event and action conditions to empty arrays", () => {
    const module = normalizeAgentToModule({
      id: "agent-1",
      screens: [
        {
          id: "screen-1",
          title: "Screen",
          sections: [
            {
              id: "section-1",
              position: "body",
              elements: [
                {
                  type: "button",
                  state: { id: "cta_button", title: "Continue" },
                  events: [
                    {
                      id: "event-1",
                      type: "onSelected",
                      action: [
                        {
                          type: "navigation",
                          deeplink: "next-screen",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          events: [
            {
              id: "screen-event",
              type: "onLoad",
              action: [
                {
                  type: "stateUpdate",
                  scope: "module",
                  updates: { ready: true },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(module.screens[0].events[0].conditions).toEqual([]);
    expect(module.screens[0].sections[0].elements[0].events?.[0].conditions).toEqual([]);
  });
});
