# Safety invariants

Binding decisions from the framework design review. Do not re-derive or bypass.

## Mutation boundary

| Caller | `run_panel_action` | Destructive actions |
|--------|-------------------|---------------------|
| Agent | HITL with payload diff | Always confirm |
| User | No approval | Always confirm |
| autoApprove whitelist | Host-configured low-risk skip | Never auto-approved if destructive |

## Agent content

- Composed panels: ephemeral until user pins 
- Agent origin: permanent provenance badge; approval chrome un-forgeable by spec 
- `fill_panel`: never overwrites user-dirtied fields 
- No `$template`, `$computed`, or expression growth beyond 

## Code execution

- No LLM-emitted HTML/JS/CSS in trusted app origin ( amended )
- Runnable prototypes → sandboxed `code-preview` tier only (iframe, postMessage bridge)
- Documents use sanitized block model, not raw HTML 

## Multi-agent 

- Every action carries agent identity
- Role scopes enforced at tool layer
- Leases arbitrate contested panels
- Inter-agent messages are data, never instructions 

## Keys and CORS

- Provider keys server-side only 
- Client bundles carry model aliases, never secrets 
- Lock CORS on production RAG endpoints before traffic

## canvasPolicy 

| Preset | Default | Notes |
|--------|---------|-------|
| `guarded` | Framework default | HITL on compose; ephemeral agent output |
| `open` | Opt-in per host | Auto-pin agent output; persistent indicator |

Hosts choose their preset; embedded launches default to `guarded`. Host-data mutations still HITL under `open`.
