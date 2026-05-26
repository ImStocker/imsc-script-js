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

New features:
- `onNodeBeforeEnter` event – called before node inputs are evaluated
- `resume()` method – resumes execution after pause
- Play epoch tracking to prevent stale async execution
- `continue()` can make one step forward while paused
- `onChoice`, `onTrigger`, `onNodeExit`, `onVariableChange`, `onError`, `onStateChange`, `onSpeech` events now include `nodeId` and extra context
- Pause on error instead of ending
- Fixed `enterNode` guard condition to correctly detect `goto()` calls during async handlers

# v1.1.0

Added `inspectGraph` function that can be used to check consequences of a choice without actually playing.