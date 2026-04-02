// Base node with common fields
interface BaseNode {
    id: string;
    type: string;
    onEnter?: Action[];   // optional actions when node becomes active
    onExit?: Action[];    // optional actions when node is left
}

// Actions: can be simple functions or commands
export type Action = (context: ActionContext) => void;

export interface ActionContext {
    setVariable: (key: string, value: any) => void;
    getVariable: (key: string) => any;
}

// Speech node
export interface SpeechNode extends BaseNode {
    type: 'speech';
    speaker?: string;
    text: string;               // can include variables via {{var}}
    next: string;               // next node id
}

// Branch node (choice menu)
export interface BranchNode extends BaseNode {
    type: 'branch';
    options: BranchOption[];
}

export interface BranchOption {
    text: string;               // display text, may contain variables
    next: string;               // node id to go to if chosen
    condition?: Condition;      // optional condition to show/hide option
}

// Set variable node
export interface SetNode extends BaseNode {
    type: 'set';
    assignments: Record<string, Expression>;
    next: string;
}

// Conditional node
export interface ConditionNode extends BaseNode {
    type: 'condition';
    condition: Condition;
    next: string;               // if condition true
    elseNext: string;           // if condition false
}

// End node (stops dialog)
export interface EndNode extends BaseNode {
    type: 'end';
}

// Union of all node types
export type DialogNode =
    | SpeechNode
    | BranchNode
    | SetNode
    | ConditionNode
    | EndNode;

// Condition: function that returns boolean
export type Condition = (vars: Record<string, any>) => boolean;

// Expression: can be a literal value or a function that returns a value
export type Expression = any | ((vars: Record<string, any>) => any);
2. Graph Definition
typescript
export interface DialogGraph {
    startNodeId: string;                 // ID of the starting node
    nodes: Record<string, DialogNode>;   // all nodes keyed by id
}
3. Dynamic State(for serialization)
    typescript
export interface DialogState {
    currentNodeId: string;
    variables: Record<string, any>;
    // optionally add a stack if you support sub‑dialogs / call stack
    // stack?: string[];
}
4. Event System
We'll use a simple EventEmitter class. You can replace it with any standard emitter (e.g., mitt, eventemitter3). Here's a minimal version:

typescript
type EventHandler = (...args: any[]) => void;

class EventEmitter {
    private events: Map<string, EventHandler[]> = new Map();

    on(event: string, handler: EventHandler) {
        if (!this.events.has(event)) this.events.set(event, []);
        this.events.get(event)!.push(handler);
    }

    off(event: string, handler: EventHandler) {
        const handlers = this.events.get(event);
        if (handlers) {
            const idx = handlers.indexOf(handler);
            if (idx !== -1) handlers.splice(idx, 1);
        }
    }

    emit(event: string, ...args: any[]) {
        const handlers = this.events.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(...args));
        }
    }
}
5. DialogEngine Implementation
typescript
export interface DialogEngineOptions {
    variables?: Record<string, any>;
    events?: {
        onStart?: () => void;
        onEnd?: () => void;
        onNodeEnter?: (nodeId: string, node: DialogNode) => void;
        onNodeExit?: (nodeId: string, node: DialogNode) => void;
        onChoice?: (optionIndex: number, option: BranchOption) => void;
        onVariableChange?: (key: string, value: any, oldValue: any) => void;
        onError?: (error: Error) => void;
        onStateChange?: (state: DialogState) => void;
    };
}

export class DialogEngine {
    private graph: DialogGraph;
    private currentNodeId: string | null = null;
    private variables: Record<string, any> = {};
    private eventEmitter = new EventEmitter();
    private isRunning = false;

    constructor(graph: DialogGraph, options: DialogEngineOptions = {}) {
        this.graph = graph;
        this.variables = { ...options.variables };

        // Register event handlers from options
        if (options.events) {
            for (const [event, handler] of Object.entries(options.events)) {
                if (handler) this.on(event as any, handler);
            }
        }
    }

    // --- Public API ---

    start(startNodeId?: string): void {
        if (this.isRunning) {
            this.end();
        }
        this.isRunning = true;
        const nodeId = startNodeId ?? this.graph.startNodeId;
        if (!nodeId || !this.graph.nodes[nodeId]) {
            this.emitError(new Error(`Start node "${nodeId}" not found in graph`));
            return;
        }
        this.currentNodeId = nodeId;
        this.emit('onStart');
        this.enterNode(this.currentNodeId);
    }

    next(): void {
        if (!this.isRunning || !this.currentNodeId) return;

        const node = this.graph.nodes[this.currentNodeId];
        if (!node) {
            this.end();
            return;
        }

        // Determine next node based on node type
        let nextId: string | null = null;

        switch (node.type) {
            case 'speech':
                nextId = node.next;
                break;
            case 'set':
                this.executeSetNode(node);
                nextId = node.next;
                break;
            case 'condition':
                const conditionMet = this.evaluateCondition(node.condition);
                nextId = conditionMet ? node.next : node.elseNext;
                break;
            case 'branch':
                // branch nodes are handled via choose()
                return;
            case 'end':
                this.end();
                return;
        }

        if (nextId) {
            this.goto(nextId);
        } else {
            this.end();
        }
    }

    choose(optionIndex: number): void {
        if (!this.isRunning || !this.currentNodeId) return;
        const node = this.graph.nodes[this.currentNodeId];
        if (node.type !== 'branch') return;

        const validOptions = node.options.filter(opt => !opt.condition || this.evaluateCondition(opt.condition));
        if (optionIndex < 0 || optionIndex >= validOptions.length) return;

        const chosen = validOptions[optionIndex];
        this.emit('onChoice', optionIndex, chosen);

        if (chosen.next) {
            this.goto(chosen.next);
        } else {
            this.end();
        }
    }

    goto(nodeId: string): void {
        if (!this.isRunning) return;
        if (!this.graph.nodes[nodeId]) {
            this.emitError(new Error(`Node "${nodeId}" not found`));
            this.end();
            return;
        }

        this.exitCurrentNode();
        this.currentNodeId = nodeId;
        this.enterNode(nodeId);
    }

    end(): void {
        if (!this.isRunning) return;
        this.exitCurrentNode();
        this.currentNodeId = null;
        this.isRunning = false;
        this.emit('onEnd');
    }

    setVariable(key: string, value: any): void {
        const oldValue = this.variables[key];
        this.variables[key] = value;
        this.emit('onVariableChange', key, value, oldValue);
        this.emitStateChange();
    }

    getVariable(key: string): any {
        return this.variables[key];
    }

    getCurrentNode(): DialogNode | null {
        if (!this.currentNodeId) return null;
        return this.graph.nodes[this.currentNodeId] || null;
    }

    getCurrentNodeId(): string | null {
        return this.currentNodeId;
    }

    getVariables(): Readonly<Record<string, any>> {
        return { ...this.variables };
    }

    // --- Snapshot & Serialization (for history) ---

    getSnapshot(): DialogState {
        return {
            currentNodeId: this.currentNodeId ?? '',
            variables: { ...this.variables },
        };
    }

    restoreSnapshot(state: DialogState): void {
        if (!this.graph.nodes[state.currentNodeId]) {
            this.emitError(new Error(`Cannot restore: node "${state.currentNodeId}" not found`));
            return;
        }
        this.currentNodeId = state.currentNodeId;
        this.variables = { ...state.variables };
        this.isRunning = true; // assume snapshot is taken while running
        this.emitStateChange();
    }

    serialize(): DialogState {
        return this.getSnapshot();
    }

    load(state: DialogState): void {
        this.restoreSnapshot(state);
    }

    // --- Event handling ---

    on(event: string, handler: EventHandler): void {
        this.eventEmitter.on(event, handler);
    }

    off(event: string, handler: EventHandler): void {
        this.eventEmitter.off(event, handler);
    }

    // --- Private helpers ---

    private enterNode(nodeId: string): void {
        const node = this.graph.nodes[nodeId];
        if (!node) return;

        // Execute onEnter actions
        if (node.onEnter) {
            this.executeActions(node.onEnter);
        }

        this.emit('onNodeEnter', nodeId, node);
        this.emitStateChange();
    }

    private exitCurrentNode(): void {
        if (!this.currentNodeId) return;
        const node = this.graph.nodes[this.currentNodeId];
        if (node && node.onExit) {
            this.executeActions(node.onExit);
        }
        this.emit('onNodeExit', this.currentNodeId, node);
    }

    private executeActions(actions: Action[]): void {
        const context: ActionContext = {
            setVariable: (key, value) => this.setVariable(key, value),
            getVariable: (key) => this.getVariable(key),
        };
        actions.forEach(action => action(context));
    }

    private executeSetNode(node: SetNode): void {
        for (const [key, expr] of Object.entries(node.assignments)) {
            const value = this.evaluateExpression(expr);
            this.setVariable(key, value);
        }
    }

    private evaluateCondition(condition: Condition): boolean {
        try {
            return condition(this.variables);
        } catch (err) {
            this.emitError(new Error(`Condition evaluation failed: ${err}`));
            return false;
        }
    }

    private evaluateExpression(expr: Expression): any {
        if (typeof expr === 'function') {
            return expr(this.variables);
        }
        return expr;
    }

    private emitStateChange(): void {
        this.emit('onStateChange', this.getSnapshot());
    }

    private emit(event: string, ...args: any[]): void {
        this.eventEmitter.emit(event, ...args);
    }

    private emitError(error: Error): void {
        this.emit('onError', error);
    }
}
6. Example Usage
typescript
// Define graph
const graph: DialogGraph = {
    startNodeId: 'greeting',
    nodes: {
        greeting: {
            id: 'greeting',
            type: 'speech',
            speaker: 'Guard',
            text: 'Hello, {{playerName}}. What is your quest?',
            next: 'askQuest'
        },
        askQuest: {
            id: 'askQuest',
            type: 'branch',
            options: [
                { text: 'Seek the Holy Grail', next: 'grail' },
                { text: 'I just want to pass', next: 'pass' }
            ]
        },
        grail: {
            id: 'grail',
            type: 'speech',
            speaker: 'Guard',
            text: 'Ah, a noble quest! You may pass.',
            next: 'end'
        },
        pass: {
            id: 'pass',
            type: 'speech',
            speaker: 'Guard',
            text: 'Very well, move along.',
            next: 'end'
        },
        end: { id: 'end', type: 'end' }
    }
};

// Create engine with initial variables and event handlers
const engine = new DialogEngine(graph, {
    variables: { playerName: 'Arthur' },
    events: {
        onStart: () => console.log('Dialog started'),
        onNodeEnter: (id, node) => {
            if (node.type === 'speech') {
                const text = node.text.replace(/\{\{(\w+)\}\}/g, (_, key) => engine.getVariable(key));
                console.log(`${node.speaker}: ${text}`);
            } else if (node.type === 'branch') {
                console.log('Choose an option:');
                node.options.forEach((opt, i) => {
                    if (!opt.condition || engine.evaluateCondition(opt.condition))
                        console.log(`  ${i}: ${opt.text}`);
                });
            }
        },
        onEnd: () => console.log('Dialog ended')
    }
});

// Start dialog
engine.start();

// Simulate user choosing option 0 (after askQuest node)
// In a real game, you'd call engine.choose(index) from UI.
setTimeout(() => {
    engine.choose(0);
}, 1000);
7. History Management Outside Engine
The engine exposes getSnapshot() / serialize() and restoreSnapshot() / load() as well as the onStateChange event.This allows you to implement undo / redo, branching timelines, or save / load without touching internals.

    typescript
class HistoryManager {
    private stack: DialogState[] = [];
    private index = -1;
    private isRestoring = false;

    constructor(private engine: DialogEngine) {
        engine.on('onStateChange', (state: DialogState) => {
            if (this.isRestoring) return;
            // discard forward history on new action
            this.stack = this.stack.slice(0, this.index + 1);
            this.stack.push(state);
            this.index++;
        });
    }

    undo(): void {
        if (this.index <= 0) return;
        this.index--;
        this.isRestoring = true;
        this.engine.restoreSnapshot(this.stack[this.index]);
        this.isRestoring = false;
    }

    redo(): void {
        if (this.index >= this.stack.length - 1) return;
        this.index++;
        this.isRestoring = true;
        this.engine.restoreSnapshot(this.stack[this.index]);
        this.isRestoring = false;
    }
}