# ImscScript JS

A JavaScript library to play dialogs and visual scripts created with [**IMS Creators**](https://ims.cr5.space/).\
Works with any web game engine (Phaser, PixiJS, or vanilla JS) and provides full control over dialog flow, branching, variables, triggers, and serialization.

## Features

- 🎭 **Speech nodes** with optional choices (branching dialogs)
- 🔀 **Conditional branching** based on variables or expressions
- 📦 **Variable management** – set, get, and use in conditions
- ⚡ **Trigger nodes** – invoke game logic and receive outputs
- 💾 **Serializable state** – save/load, undo/redo, replay
- 🔌 **Framework agnostic** – works with Phaser, PixiJS, or any rendering engine
- 📝 **Expression evaluation** – math, comparison, and logical operators
- 🧩 **Async support** – triggers can be asynchronous
- ⏸️ **Pause/Resume** – pause execution during triggers or user input

## Installation

```bash
npm install imsc-script
```

## **Usage**

### **1. Create a script asset in IMS Creators**

Export your dialog graph as JSON. The asset must contain at least one block of type `"script"` 

Example minimal asset:

```json
{
  "id": "my_dialog",
  "blocks": [
    {
      "id": "block1",
      "type": "script",
      "name": "content",
      "computed": {
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
    }
  ]
}
```

### **2. Initialize and play**

```javascript
import { ImscScriptPlayer } from 'imsc-script';
import myDialogAsset from './myDialog.json';

const player = new ImscScriptPlayer(myDialogAsset, {
  blockName: 'content',                // optional, uses first script block if omitted
  initialVariables: { customVar: 42 }, // overrides defaults values of variables
  events: {
    onSpeech: (speech) => {
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
    onTrigger: async (subject, inputs, node) => {
      // Handle game logic (e.g., give item, play sound)
      console.log(`Trigger: ${subject}`, inputs);
      // Return outputs that can be bound to other nodes
      return { success: true, reward: 100 };
    },
    onEnd: () => {
      console.log('Dialog finished');
    }
  }
});

// Start the dialog (returns a Promise that resolves when dialog ends)
await player.play();
```

See browser usage in `tests/browser.html`

### **3. Control the dialog from your UI**

* When a speech node **without options** appears, call `player.continue()` after the user clicks "Continue".

* When a speech node **with options** appears, call `player.continue(selectedIndex)` when the user picks an option.

* Use `player.pause()` to pause execution (e.g., during a trigger animation), and `player.continue()` to resume.

* Jump to any node using `player.goto(nodeId)`.

```javascript
// Example: button click handlers
continueButton.onclick = () => player.continue();
choiceButton.onclick = () => player.continue(0);

// Pause during a long animation
player.pause();
await playAnimation();
player.continue();
```

## **API Reference**

### **Constructor**

```typescript
new ImscScriptPlayer(asset: ImscAsset, options?: ImscScriptPlayerOptions)
```

|Option|Type|Description|
|--- |--- |--- |
|`blockName`|`string`|Name of the script block to play (uses first if omitted)|
|`initialVariables`|`Record<string, Record<string, AssetPropsPlainObjectValue>`|Initial variable values (overrides graph defaults). `AssetPropsPlainObjectValue` is primitive value or IMS Creators's Enum, Asset, Workspace, File and etc.|
|`events`|`ImscScriptPlayerEvents`|Event handlers (see below)|

### **Properties**
|Property|Type|Description|
|--- |--- |--- |
|`isRunning`|`boolean`|true if a dialog is currently playing (not ended).|
|`isPaused`|`boolean`|true if the dialog is paused.|
|`currentNode`|`ImscScriptGraphNode` | null|The currently active node.|
|`currentNodeId`|`string` | null|ID of the currently active node.|
|`variables`|`Readonly<Record<string, AssetPropsPlainObjectValue>>`|Current variable values (read‑only).|


### **Methods**

|Method|Description|
|--- |--- |
|`play(startNodeId?: string): Promise<void>`|Starts the dialog from the graph's start node (or a specific node). Returns a promise that resolves when the dialog ends.|
|`pause()`|Pauses execution. The dialog will not advance until continue() is called.|
|`continue(optionIndex?: number): void`|Resumes execution. If called on a speech node, advances to the next node. If optionIndex is provided, selects that choice option.|
|`goto(nodeId: string \| null): void`|Jumps to a specific node (or ends if null).|
|`end(): void`|Ends the current dialog (resolves the play() promise).|
|`setVariable(key: string, value: any): void`|Sets a runtime variable.|
|`getVariable(key: string): any`|Gets a runtime variable.|
|`serialize(): ImscScriptPlayerState`|Returns the current state (current node, variables, trigger outputs).|
|`load(state: ImscScriptPlayerState): void`|Restores a previously serialized state.|
|`on(event, handler): void`|Registers an event handler. Can be only one handler per event|


### **Events**

|Event|Parameters|Description|
|--- |--- |--- |
|`onStart`|`()`|Dialog started.|
|`onEnd`|`()`|Dialog ended.|
|`onNodeEnter`|`(nodeId: string, node: ImscScriptGraphNode)`|Entered a new node.|
|`onNodeExit`|`(nodeId: string, node: ImscScriptGraphNode)`|Exited a node.|
|`onSpeech`|`(speech: ImscScriptPlayerSpeech, node: ImscScriptGraphNodeSpeech)`|A speech node is active. speech contains character, text, values, and options array (each with index, condition, text, values).|
|`onChoice`|`(optionIndex: number)`|User selected a choice (fired before moving to the next node).|
|`onTrigger`|`(subject: string, inputs: Record<string, AssetPropsPlainObjectValue>, node: ImscScriptGraphNodeTrigger)` → `outputs` (optional)|A trigger node is active. Perform game logic and optionally return outputs (record of values).|
|`onVariableChange`|`(key: string, value: AssetPropsPlainObjectValue, oldValue: AssetPropsPlainObjectValue)`|A variable changed.|
|`onError`|`(error: Error)`|An error occurred.|
|`onStateChange`|`(state: ImscScriptPlayerState)`|State changed (useful for auto‑saving).|


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

* [GitHub Repository](https://github.com/ImStocker/imsc-script-js)

## **Contributing**

Issues and pull requests are welcome. Please ensure your code passes the existing tests and follows the coding style.