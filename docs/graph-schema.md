# Dialogue/Script Graph JSON Schema

## Root Object

```typescript
{
    start: string | null,          // ID of the starting node
    variables?: {
        own?: {
            [name: string]: VarDef
        }
    },
    __settings?: Settings,
    nodes: { [id: string]: Node }  // Node ID → node definition
}
```

## Variable Definition (`VarDef`)

```typescript
{
    name: string,                   // Variable name
    type: { Type: string },         // Type descriptor (see AssetPropType)
    title?: string,                 // Display name (Used in visual editor only)
    description?: string | null,    // Description (Used in visual editor only)
    index?: number,                 // Ordinal index (Used in visual editor only)
    default?: AssetPropValue,       // Default value
    kind?: 'global' | 'local' | 'in' | 'out' | 'in-out'
}
```

- `kind` defaults to `'global'` when omitted
- `'global'` — shared across all frames (parent + sub-scripts)
- `'local'` — frame-local, not visible to sub-scripts
- `'in'` — input from parent to sub-script
- `'out'` — output copied back to parent when sub-script ends
- `'in-out'` — both input to sub-script and output back to parent

## Value System

### Value Types

A value can be any **plain value** (literal), or a **binding** that references another node's output.

```typescript
// Literal: any of the AssetPropValue types (primitives, objects)
| null | string | number | boolean 
| AssetPropValueText | AssetPropValueFile | AssetPropValueBlob 
| AssetPropValueTimestamp | AssetPropValueEnum | AssetPropValueFormula
| AssetPropValueAsset | AssetPropValueAccount | AssetPropValueSelection 
| AssetPropValueProject | AssetPropValueWorkspace | AssetPropValueType
| 

// Binding: resolves a value from another node at runtime
{ get: string, param: string }
//   get   — ID of the source node
//   param — output parameter name of that node
```

### AssetPropValue (literal types)

| Type | JSON representation |
|---|---|
| `null` | `null` |
| `string` | `"..."` |
| `number` | `42` or `3.14` |
| `boolean` | `true` / `false` |
| `number[]` | `[1, 2, 3]` |
| `AssetPropValueText` | `{ Str: "plain text", Ops: [...] }` |
| `AssetPropValueFile` | `{ FileId: "...", Title: "...", Size: N, Dir: "..."\|null, Store: "..." }` |
| `AssetPropValueBlob` | `{ Blob: "...", Type: "...", Key?: "..." }` |
| `AssetPropValueTimestamp` | `{ Str: "ISO string", Ts: unix_seconds }` |
| `AssetPropValueEnum` | `{ Enum: "...", Name: "...", Title: "..." }` |
| `AssetPropValueFormula` | `{ F: any }` |
| `AssetPropValueAsset` | `{ AssetId: "...", Title: "...", Name: "..."\|null, BlockId?: "..", Anchor?: "..", Pid?: ".." }` |
| `AssetPropValueAccount` | `{ AccountId: "...", Name: "..." }` |
| `AssetPropValueSelection` | `{ Select: any, Group: any, Str: "...", Where: any, Order?: [...], Offset?: N, Count?: N }` |
| `AssetPropValueProject` | `{ ProjectId: "...", Title: "..." }` |
| `AssetPropValueWorkspace` | `{ WorkspaceId: "...", Title: "...", Name: "..."\|null, Pid?: "..." }` |
| `AssetPropValueType` | `{ Type: "string"\|"integer"\|..., Kind?: "...", Of?: Type }` |

## Node Types

### Flow nodes (drive execution, have `next`)

#### `start`

Entry point. Must be the node referenced by the graph's `start`.

```typescript
{
    type: 'start',
    next: string | null,     // Next node ID
    index?: number,
    pos?: { x: number, y: number }
}
```

#### `end`

Terminates execution of the current graph.

```typescript
{
    type: 'end',
    index?: number,
    pos?: { x: number, y: number }
}
```

#### `speech`

Emits a speech action. Waits for `player.continue()` via `onSpeech` handler.

```typescript
{
    type: 'speech',
    next: string | null,
    values?: {
        [prop: string]: Val  // character, text, etc.
    },
    options?: [
        { values?: { [prop: string]: Val }, next: string | null }
    ],
    index?: number,
    pos?: { x: number, y: number }
}
```

#### `trigger`

Emits a custom action. Resolved via `onAction` event with type `trigger` which may return `{ outputs: { ... } }`.

```typescript
{
    type: 'trigger',
    next: string | null,
    subject: string,
    values?: { [prop: string]: Val },
    index?: number,
    pos?: { x: number, y: number }
}
```

#### `function`

Expression node that evaluates a named function via `onAction` event with type `function`. Returns `{ outputs: { result: ... } }`.

```typescript
{
    type: 'function',
    subject: string,
    values?: { [prop: string]: Val },
    index?: number,
    pos?: { x: number, y: number }
}
```

#### `setVar`

Assigns a value to a variable

```typescript
{
    type: 'setVar',
    next: string | null,
    values: {
        variable: string,    // Variable name
        value: Val           // Value to assign
    },
    index?: number,
    pos?: { x: number, y: number }
}
```

#### `branch`

Conditional branch with two outgoing edges.

```typescript
{
    type: 'branch',
    values: {
        condition: Val       // Evaluated as boolean
    },
    options: [
        { next: string | null },   // true branch
        { next: string | null }    // false branch
    ],
    index?: number,
    pos?: { x: number, y: number }
}
```

#### `callScript`

Calls a sub-graph (sub-script). The sub-graph is loaded via the `onLoadScript` event. Passes `in`/`in-out` variables from `values`, and copies `out`/`in-out` variables back on return.

```typescript
{
    type: 'callScript',
    next: string | null,
    subject: string | { AssetId: string, Title: string, ... },  // Script identifier
    values?: { [prop: string]: Val },
    index?: number,
    pos?: { x: number, y: number }
}
```

### Expression nodes (evaluated only when referenced by a binding)

#### `getVar`

Reads a variable

```typescript
{
    type: 'getVar',
    values: { variable: string },
    index?: number,
    pos?: { x: number, y: number }
}
```

Outputs: `{ result: <value> }`

#### `constAsset` / `constText` / `constString` / `constInteger` / `constFloat` / `constBoolean`

Emits a constant literal value.

```typescript
{
    type: 'constAsset' | 'constText' | 'constString' | 'constInteger' | 'constFloat' | 'constBoolean',
    values: { value: AssetPropValue },
    index?: number,
    pos?: { x: number, y: number }
}
```

Outputs: `{ result: <literal value> }`

#### `opEqual` / `opNotEqual` / `opLess` / `opLessEqual` / `opMore` / `opMoreEqual`

Binary comparison operator. Outputs a boolean.

```typescript
{
    type: 'opEqual' | 'opNotEqual' | 'opLess' | 'opLessEqual' | 'opMore' | 'opMoreEqual',
    values: {
        arg1: Val,
        arg2: Val
    },
    index?: number,
    pos?: { x: number, y: number }
}
```

Outputs: `{ result: boolean }`

#### `opPlus` / `opMinus` / `opMult` / `opDiv` / `opMod` / `opAnd` / `opOr`

Binary arithmetic/logic operator.

```typescript
{
    type: 'opPlus' | 'opMinus' | 'opMult' | 'opDiv' | 'opMod' | 'opAnd' | 'opOr',
    values: {
        arg1: Val,
        arg2: Val
    },
    index?: number,
    pos?: { x: number, y: number }
}
```

Outputs: `{ result: number | boolean }`

#### `opNot`

Unary negation operator.

```typescript
{
    type: 'opNot',
    values: {
        arg1: Val
    },
    index?: number,
    pos?: { x: number, y: number }
}
```

Outputs: `{ result: boolean }`

## Settings (`__settings`)

```typescript
{
    speech?: {
        main?: {
            [prop: string]: {
                name: string,
                type: { Type: string },
                title: string,
                default?: AssetPropValue,
                description: string | null,
                index: number
            }
        },
        option?: {
            [prop: string]: { ... }
        }
    }
}
```

## Common Fields

Every node may include:

| Field | Type | Description |
|---|---|---|
| `index` | `number` (optional) | Ordinal index for UI ordering |
| `pos` | `{ x: number, y: number }` (optional) | Position in the visual editor |

## Evaluation Model

- **Flow nodes** are entered in sequence via `next` pointers. Each node produces one successor.
- **Expression nodes** are never entered directly by the flow. They are evaluated on demand when a binding (`{ get: nodeId, param: name }`) references them.
- **`callScript`** pushes a new frame onto the stack, runs the sub-graph, then pops the frame and copies `out`/`in-out` variable values into the parent frame's `nodeOutputs`.
- **Global variables** (`kind: 'global'` or omitted) are stored in a shared store accessible from any frame.
- **`function`** / **`trigger`** nodes delegate to external handlers (`onAction` event) which return output values. `function` is non-blocking (expression-only), `trigger` blocks the flow until the handler resolves.
