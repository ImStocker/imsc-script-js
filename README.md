# ImscScript JS
[![NPM Version](https://img.shields.io/npm/v/imsc-script)](https://www.npmjs.com/package/imsc-script)

A JavaScript library to play dialogs and visual scripts created with [**IMS Creators**](https://ims.cr5.space/) ([Desktop version](https://github.com/ImStocker/ims-creators))

Works with any web game engine (Phaser, PixiJS, or vanilla JS) and provides full control over dialog flow, branching, variables, triggers, and serialization.

## Features

- 🎭 **Speech nodes** with optional choices (branching dialogs)
- 🔀 **Conditional branching** based on variables or expressions
- 📦 **Variable management** – set, get, and use in conditions
- ⚡ **Trigger / Function nodes** – invoke game logic and receive outputs
- 💾 **Serializable state** – save/load, undo/redo, replay
- 🔌 **Framework agnostic** – works with Phaser, PixiJS, or any rendering engine
- 📝 **Expression evaluation** – math, comparison, and logical operators
- 🧩 **Async support** – triggers can be asynchronous
- 📜 **Sub‑scripts** – `callScript` nodes run nested graphs with isolated variables and `in`/`out` data flow
- ⏸️ **Pause/Resume** – pause execution during triggers or user input

## Installation

```bash
npm install imsc-script
```

or include from CDN

```html
<script src="https://cdn.jsdelivr.net/gh/ImStocker/imsc-script-js@main/dist-browser/index.iife.js"></script>
```

and use `new ImscScript.ImscScriptPlayer` to create player

## **Usage**

### **1. Create a script graph in IMS Creators**

Export your dialog graph as JSON or just use saved file from Desktop version. Use the `computed` content of a script block as the graph input.
 
<img width="800" alt="image" src="https://github.com/user-attachments/assets/ad6d752e-f23f-4874-9d0b-71584a7d71fb" />

Example minimal graph:

```json
{
  "start": "greeting",
  "nodes": {
    "greeting": {
      "type": "speech",
      "values": {
        "character": "Guard",
        "text": "Hello!"
      },
      "next": "ask"
    },
    "ask": {
      "type": "speech",
      "values": {
        "character": "Guard",
        "text": "What do you want?"
      },
      "options": [
        { "values": { "text": "I seek adventure." }, "next": "adventure" },
        { "values": { "text": "I want to trade." }, "next": "trade" },
        { "values": { "text": "Nothing, goodbye." }, "next": "end" }
      ]
    },
    "trade": {
      "type": "trigger",
      "subject": "trade",
      "next": "ask"
    },
    "adventure": {
      "type": "speech",
      "values": {
        "character": "Guard",
        "text": "Then go east, brave soul!"
      },
      "next": "end"
    },
    "end": { "id": "end", "type": "end" }
  }
}
```

### **2. Initialize and play**

```javascript
import { ImscScriptPlayer } from 'imsc-script';
import myDialogGraph from './myDialog.json';

const player = new ImscScriptPlayer(myDialogGraph, {
  initialVariables: { customVar: 42 }, // overrides defaults values of variables
  events: {
    onSpeech: ({ speech, node, nodeId }) => {
      // Render speech bubble 
      console.log(`${speech.character}: ${speech.text}`);
      if (speech.options.length) {
        // Show choice buttons (option.text - text of option)
        // ...
        // buttons should call player.continue(option.index)
      } else {
        // Show "Continue" button
        // ...
        // button should call player.continue()
      }
    },
    onAction: async ({ type, subject, inputs, node, nodeId }) => {
      // Handle game logic (e.g., give item, play sound)
      console.log(`Action: ${type} - ${subject}`, inputs);
      // Return outputs and optionally override the next node
      return { outputs: { success: true, reward: 100 } };
    },
    onEnd: () => {
      console.log('Dialog finished');
    }
  }
});

// Start the dialog (returns a Promise that resolves when dialog ends)
await player.play();
```

See browser usage in [tests/browser.html](tests/browser.html)

### **3. Control the dialog from your UI**

* When a speech node **without options** appears, call `player.continue()` after the user clicks "Continue".

* When a speech node **with options** appears, call `player.continue(selectedIndex)` when the user picks an option.

* Use `player.pause()` to pause execution (e.g., if you need run script step by step), and `player.resume()` to continue. Use `player.continue()` to make one step forward while paused.

* Jump to any node using `player.goto(nodeId)`.

```javascript
// Example: button click handlers
continueButton.onclick = () => player.continue();
choiceButton.onclick = () => player.continue(0);

// Pause during a long animation
player.pause();
await playAnimation();
player.resume();
```

## **API Reference**

### **Constructor**

```typescript
new ImscScriptPlayer(graph: ImscScriptGraph, options?: ImscScriptPlayerOptions)
```

|Option|Type|Description|
|--- |--- |--- |
|`initialVariables`|`AssetPropsPlainObject`|Initial variable values (overrides graph defaults).|
|`events`|`ImscScriptPlayerEvents`|Event handlers (see below)|

### **Properties**
|Property|Type|Description|
|--- |--- |--- |
|`isRunning`|`boolean`|true if a dialog is currently playing (not ended).|
|`isPaused`|`boolean`|true if the dialog is paused.|
|`currentNode`|`ImscScriptGraphNode` | null|The currently active node.|
|`currentNodeId`|`string` | null|ID of the currently active node.|
|`variables`|`Readonly<AssetPropsPlainObject>`|Current frame's variable values (read‑only).|
|`globals`|`Readonly<AssetPropsPlainObject>`|Global variable values shared across all frames (read‑only).|
|`frames`|`ImscScriptPlayerFrame[]`|Frame stack (current frame is index 0).|


### **Methods**

|Method|Description|
|--- |--- |
|`play(startNodeId?: string): Promise<void>`|Starts the dialog from the graph's start node (or a specific node). Returns a promise that resolves when the dialog ends.|
|`pause()`|Pauses execution. The dialog will not advance until resume() or continue() is called.|
|`resume()`|Resumes execution without advancing (e.g., after a paused trigger).|
|`continue(optionIndex?: number): void`|Advances to the next node from a speech node (with optionIndex selects that choice). Also makes one step forward when paused.|
|`goto(nodeId: string \| null): void`|Jumps to a specific node (or ends if null).|
|`end(): void`|Ends the current dialog (resolves the play() promise).|
|`setVariable(key: string, value: any): void`|Sets a runtime variable.|
|`getVariable(key: string): any`|Gets a runtime variable.|
|`serialize(): ImscScriptPlayerState`|Returns the current state (frame stack, globals).|
|`load(state: ImscScriptPlayerState): void`|Restores a previously serialized state.|
|`on(event, handler): void`|Registers an event handler. Can be only one handler per event|
|`inspectGraph(callback, startNodeId?)`|Walk over script graph nodes. Allows to check consequences of a choice without actually playing.|


### **Events**

All event handlers receive a single event object with named properties.

|Event|Event Properties|Description|
|--- |--- |--- |
|`onStart`|`()`|Dialog started.|
|`onEnd`|`()`|Dialog ended.|
|`onNodeBeforeEnter`|`{ nodeId, node }`|Called before node inputs are evaluated. Can be async.|
|`onNodeEnter`|`{ inputs, node, nodeId }` → `inputs` (optional)|Input values have been calculated. Return modified inputs if needed. Can be async.|
|`onNodeExit`|`{ nodeId, node }`|Exited a node.|
|`onSpeech`|`{ speech, node, nodeId }`|A speech node is active. `speech` contains character, text, values, and options array (each with index, condition, text, values).|
|`onChoice`|`{ optionIndex, node, nodeId }`|User selected a choice (fired before moving to the next node).|
|`onAction`|`{ type, subject, inputs, node, nodeId }` → `{ outputs?, next? }` (optional)|A trigger or function node is active. `type` is `'trigger'` or `'function'`. Return `outputs` for downstream bindings and optionally `next` to override the target node.|
|`onLoadScript`|`{ scriptId }` → `ImscScriptGraph`|Load a sub‑script by ID when a `callScript` node is activated.|
|`onVariableChange`|`{ variable, newValue, oldValue, frameIndex }`|A variable changed in a frame.|
|`onError`|`{ error }`|An error occurred.|
|`onStateChange`|`{ state }`|State changed (useful for auto‑saving).|


## **State Serialization (Save / Load)**

You can save the exact dialog state at any time and restore it later:

```javascript
// Save
const savedState = player.serialize();
localStorage.setItem('dialogSave', JSON.stringify(savedState));

// Load later
const loadedState = JSON.parse(localStorage.getItem('dialogSave'));
player.load(loadedState);
```

## **License**

MIT

## **Links**

* [IMS Creators](https://ims.cr5.space/) – The visual editor for creating dialogs and scripts (both web and [desktop](https://ims.cr5.space/desktop) version)

* [IMS Creators Desktop source code](https://github.com/ImStocker/ims-creators)

* [GitHub Repository](https://github.com/ImStocker/imsc-script-js)

## **Contributing**

Issues and pull requests are welcome. Please ensure your code passes the existing tests and follows the coding style.
