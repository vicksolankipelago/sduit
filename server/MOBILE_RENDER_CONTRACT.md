# Mobile Render Contract v1

This contract defines the stable API shape that mobile clients use to fetch a renderable SDUI module and associated per-screen voice prompts.

## Primary Endpoint

- `GET /api/mobile/journey/:journeyId/modules`

### Response Envelope

All responses use the standard API envelope:

- success: `{ "success": true, "data": ... }`
- error: `{ "success": false, "error": { "message": "...", "code": "...", "details": ... } }`

### Success Payload

```json
{
  "contractVersion": "v1",
  "journeyId": "string",
  "journeyName": "string",
  "version": "string",
  "startingAgentId": "string",
  "publishedAt": "ISO-8601 string",
  "modules": [
    {
      "module": {
        "id": "string",
        "state": {},
        "conditions": [],
        "screens": []
      },
      "agentPrompt": "string",
      "tools": [],
      "screenPrompts": {
        "screen-id": "prompt text"
      }
    }
  ]
}
```

## Single-Module Endpoint

- `GET /api/mobile/journey/:journeyId/module/:agentId`

Returns:

- `module`: one iOS-renderable SDUI module
- `screenPrompts`: screen prompt map for that agent
- `metadata`: `journeyId`, `journeyName`, `version`, `publishedAt`

## Contract Guarantees

- Every event contains a `conditions` array (`[]` if empty).
- Every element payload is served under `state` (not `data`).
- Screen ordering follows the published agent screen order.
- Modules are returned in the same order as journey agents.

## Notes For Client Implementations

- Use `startingAgentId` to pick the first module to render.
- Use `screenPrompts[screenId]` to provide just-in-time screen instructions to voice providers.
- Treat unknown fields as forward-compatible and ignore them.
