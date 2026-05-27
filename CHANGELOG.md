# v2.0.0

Breaking changes:
- All event handlers now receive a single event object instead of positional arguments
- `onNodeEnter` can now return modified inputs; called after input values are calculated (use `onNodeBeforeEnter` for pre-calculation callback)
- `ImscScriptPlayerState` now includes `currentInputs`
- `load()` now pauses execution before restoring state
- `continue()` behavior changed: no longer unpauses; use new `resume()` method to unpause without advancing
- Input values are pre-calculated and passed through node handlers (branch, setVar, trigger, speech)
- Type `AssetPropsPlainObject` replaces `Record<string, AssetPropsPlainObjectValue>`
- **`ImscScriptPlayer` constructor now takes `ImscScriptGraph` directly** instead of `ImscAsset` – removed `Asset.ts`, `blockName`, `ImscAsset`, `ImscBlock`, `ImscBlockScript` types
- `index.ts` no longer exports from `./Asset`
- `ImscScriptPlayerOptions.blockName` removed (no longer used)
- `ImscScriptGraphNodeSpeech.subject` field removed
- `ImscScriptGraphNodeBase.index` and `pos` are now optional
- `ImscScriptGraphNodeTrigger.params` removed
- `ImscScriptPlayerEvents.onTrigger` renamed to `onAction` with discriminated `type` union (`'trigger'` / `'function'`)
- `onAction` return type changed to `{ outputs?, next? }` - can override next node
- `emitError` / `emitTrigger` removed in favor of `raiseError` / unified `onAction` event

New features:
- `onNodeBeforeEnter` event – called before node inputs are evaluated
- `resume()` method – resumes execution after pause
- Play epoch tracking to prevent stale async execution
- `continue()` can make one step forward while paused
- `onChoice`, `onTrigger`, `onNodeExit`, `onVariableChange`, `onError`, `onStateChange`, `onSpeech` events now include `nodeId` and extra context
- Pause on error instead of ending
- Fixed `enterNode` guard condition to correctly detect `goto()` calls during async handlers
- **`ImscScriptGraphNodeFunction`** - new node type for side-effect-only expressions (evaluated during value resolution, calls `onAction` with `type: 'function'`)
- **`getVar` now evaluates variable name** as a value expression (supports dynamic variable names)
- **Trigger `onAction` can override next node** by returning `{ next: 'nodeId' }`
- **`callScript` node** – runs a sub‑graph loaded via `onLoadScript`; supports `in`/`out`/`in-out`/`local`/`global` variable kind scoping across frames
- **Frame‑stack architecture** – `ImscScriptPlayerFrame` with isolated `variables` and `nodeOutputs` per frame; `end` node pops the current frame and returns control to the caller
- **Variable kinds** – `global` (shared, default), `local` (frame‑isolated), `in` (passed into sub‑script), `out` (returned from sub‑script), `in-out` (passed and returned)
- **`onLoadScript` event** – called with `{ scriptId }` to resolve sub‑graphs at runtime
- **`globals` / `frames` properties** – expose the full frame stack and shared globals
- **`frameIndex`** added to `onVariableChange` event
- **`registerCustomNode(typeName, kind, handler)`** – register handlers for custom node types; `kind: 'exec'` for flow nodes, `kind: 'data'` for expression nodes

# v1.1.0

Added `inspectGraph` function that can be used to check consequences of a choice without actually playing.