// ImscScriptPlayer.ts

import type {
    ImscScriptGraph,
    ImscScriptGraphNode,
    ImscScriptGraphNodeSpeech,
    ImscScriptGraphNodeBranch,
    ImscScriptGraphNodeSetVar,
    ImscScriptGraphNodeTrigger,
    ImscScriptGraphNodeGetVar,
    ImscScriptGraphNodeBinaryOp,
    ImscScriptGraphNodeUnaryOp,
    ImscScriptGraphVal,
    ImscScriptGraphVals,
    ImscScriptGraphNodeFunction,
    ImscScriptGraphNodeCallScript,
    ImscScriptGraphNodeOption,
    ImscScriptGraphNodeChance,
} from "./Graph";
import { castAssetPropValueToAsset, castAssetPropValueToBoolean, castAssetPropValueToFloat, castAssetPropValueToString, compareAssetPropValues, getAssetPropType, AssetPropType, type AssetPropsPlainObject, type AssetPropsPlainObjectValue, type AssetPropValueAsset } from "./Props";

export type ImscScriptPlayerSpeechOption = {
    index: number
    condition?: boolean
    text?: string,
    values: AssetPropsPlainObject,
    nextNodeId: string | null
}

export type ImscScriptPlayerSpeech = {
    character?: string
    text?: string,
    values: AssetPropsPlainObject,
    options: ImscScriptPlayerSpeechOption[]
}

export type ImscScriptPlayerEvents = {
    // Playing started
    onStart?: () => void;
    // Playing ended
    onEnd?: () => void;
    // Player goes to node. Awaits callback
    onNodeBeforeEnter?: (event: {
        nodeId: string,
        node: ImscScriptGraphNode
    }) => void | Promise<void>;
    // Input values of node are calculated. Awaits callback. Callback can change input values
    onNodeEvaluated?: (event: {
        inputs: AssetPropsPlainObject,
        optionsInputs: AssetPropsPlainObject[],
        node: ImscScriptGraphNode,
        nodeId: string
    }) =>
        | void
        | Promise<void>
        | { inputs?: AssetPropsPlainObject, optionsInputs?: AssetPropsPlainObject[] }
        | Promise<{ inputs?: AssetPropsPlainObject, optionsInputs?: AssetPropsPlainObject[] }>;
    // Player entered to node.  Awaits callback.
    onNodeEnter?: (event: {
        inputs: AssetPropsPlainObject,
        optionsInputs: AssetPropsPlainObject[],
        node: ImscScriptGraphNode,
        nodeId: string
    }) =>
        | void
        | Promise<void>
    // Player exists node
    onNodeExit?: (event: {
        nodeId: string,
        node: ImscScriptGraphNode
    }) => void;
    // Player entered speech node
    onSpeech?: (event: {
        speech: ImscScriptPlayerSpeech,
        node: ImscScriptGraphNodeSpeech,
        nodeId: string
    }) => void;
    // Triggered when user made choice in speech node
    onChoice?: (event: {
        optionIndex: number,
        node: ImscScriptGraphNodeSpeech,
        nodeId: string
    }) => void;
    // Player entered trigger node
    onAction?: (event: {
        type: 'trigger',
        subject: string,
        inputs: AssetPropsPlainObject,
        node: ImscScriptGraphNodeTrigger,
        nodeId: string
    } | {
        type: 'function',
        subject: string,
        inputs: AssetPropsPlainObject,
        node: ImscScriptGraphNodeFunction,
        nodeId: string
    }) =>
        | void
        | { outputs?: AssetPropsPlainObject, next?: string | null }
        | Promise<{ outputs?: AssetPropsPlainObject, next?: string | null } | void>;
    // Variable changed
    onVariableChange?: (event: {
        variable: string,
        newValue: AssetPropsPlainObjectValue,
        oldValue: AssetPropsPlainObjectValue,
        frameIndex: number
    }) => void;
    // Error occured
    onError?: (event: {
        error: Error
    }) => void;
    // Player state changed
    onStateChange?: (event: {
        state: ImscScriptPlayerState
    }) => void;
    // Load script passed to callScript subject
    onLoadScript?: (event: {
        scriptId: string
    }) => ImscScriptGraph | Promise<ImscScriptGraph>
    // Entered to into new subscript (callScript)
    onSubScriptEnter?: (event: {
        frame: ImscScriptPlayerFrame
    }) => void;
    // Exited from subscript
    onSubScriptExit?: (event: {
        frame: ImscScriptPlayerFrame
    }) => void;
    // Player entered delay node. Handler should wait for the specified duration.
    // If not set, the player uses setTimeout internally.
    onDelay?: (event: {
        duration: number,
        nodeId: string,
    }) => void | Promise<void>;
    // Player entered chance node. Provides the random value and the default selected option.
    // Return the chosen option index (or a Promise that resolves to it).
    // If the handler doesn't return a value, the player uses defaultOptionIndex.
    onChance?: (event: {
        randomValue: number,
        options: { chance: number | null, nextNodeId: string | null }[],
        node: ImscScriptGraphNodeChance,
        nodeId: string,
        defaultOptionIndex: number
    }) => number | Promise<number> | void;
}

export type ImscScriptPlayerCustomNodeEvent = {
    inputs: AssetPropsPlainObject,
    node: ImscScriptGraphNode,
    nodeId: string
}

export type ImscScriptPlayerCustomNodeResult = {
    outputs?: AssetPropsPlainObject,
    next?: string | null
}

export type ImscScriptPlayerState = {
    frames: ImscScriptPlayerFrame[]
    globals: AssetPropsPlainObject;
}

export type ImscScriptPlayerOptions = {
    initialVariables?: AssetPropsPlainObject;
    events?: ImscScriptPlayerEvents;
    scriptId?: string
};

export type ImscScriptPlayerEvaluatedNode = {
    id: string,
    subject: AssetPropsPlainObjectValue,
    inputs: AssetPropsPlainObject;
    optionsInputs: AssetPropsPlainObject[]
}


export type ImscScriptPlayerFrame = {
    scriptId: string | null
    graph: ImscScriptGraph
    currentNode: ImscScriptPlayerEvaluatedNode | null,
    variables: AssetPropsPlainObject
    nodeOutputs: Record<string, AssetPropsPlainObject>;
}

type ImscScriptPlayerCustomNodeDef = {
    kind: 'exec' | 'data',
    handler: (event: ImscScriptPlayerCustomNodeEvent) => ImscScriptPlayerCustomNodeResult | Promise<ImscScriptPlayerCustomNodeResult>
}

export class ImscScriptPlayer {
    private _events: ImscScriptPlayerEvents = {};
    private _frames: ImscScriptPlayerFrame[] = [];
    private _globalVariables: AssetPropsPlainObject = {};
    private _playResolve: (() => void) | null = null;
    private _playEpoch = 0;
    private _pause: boolean = false
    private _customNodeHandlers: Map<string, ImscScriptPlayerCustomNodeDef> = new Map()

    constructor(graph: ImscScriptGraph, options?: ImscScriptPlayerOptions) {
        this._events = options?.events ?? {};

        const rootFrame = this._createFrame(
            options?.scriptId ?? null,
            graph,
            options?.initialVariables ?? {}
        )
        this._frames.unshift(rootFrame);
    }

    get currentFrame() {
        return this._frames[0]!;
    }

    private _createFrame(scriptId: string | null, graph: ImscScriptGraph, initialVariables: AssetPropsPlainObject) {
        const frame: ImscScriptPlayerFrame = {
            currentNode: null,
            scriptId,
            nodeOutputs: {},
            variables: {},
            graph: graph
        }
        for (const [varname, vardef] of Object.entries(graph.variables?.own ?? {})) {
            if (!vardef.kind || vardef.kind === 'global') {
                if (initialVariables.hasOwnProperty(varname)) {
                    this._globalVariables[varname] = initialVariables[varname]
                }
                else if (!this._globalVariables.hasOwnProperty(varname)) {
                    this._globalVariables[varname] = vardef.default !== undefined ? vardef.default : null
                }
            }
            else {
                if (initialVariables.hasOwnProperty(varname)) {
                    frame.variables[varname] = initialVariables[varname]
                }
                else if (vardef.default !== undefined) {
                    frame.variables[varname] = vardef.default !== undefined ? vardef.default : null
                }
            }
        }
        return frame;
    }

    /**
     * Is dialog running
     */
    get isRunning() {
        return !!this._playResolve;
    }

    /**
     * Is dialog paused during running
     */
    get isPaused() {
        return this.isRunning && this._pause;
    }

    get frames() {
        return this._frames;
    }

    /**
     * Starts the dialog from the given node, or from the graph's start node if none provided.
     * If the player is already running, it ends the current dialog first.
     * @param startNodeId Optional node ID to start from.
     */
    async play(startNodeId?: string): Promise<void> {
        if (this.isRunning) this.end();

        const playEpoch = ++this._playEpoch
        this._pause = false;
        let nodeId = startNodeId ?? this.currentFrame.graph.start;
        if (!nodeId || !this.currentFrame.graph.nodes[nodeId]) {
            this._raiseError(
                new Error(`Start node "${nodeId}" not found in graph`)
            )
            return;
        }

        const playPromise = new Promise<void>(resolve => this._playResolve = resolve);
        this._emit('onStart');
        this._enterNode(nodeId, playEpoch); // Don't await

        await playPromise;
    }

    // Resume execution
    resume() {
        if (!this.isRunning) return;
        if (!this._pause) return;
        this._pause = false;
        this._processCurrentNode(++this._playEpoch)
    }

    /**
     * Allow to pause execution during trigger calls
     */
    pause() {
        this._pause = true;
    }

    /**
     * Continue execution after speech node 
     * If paused, make one step forward
     * @param optionIndex selected choice if there are options
     */
    continue(optionIndex?: number, resume = false): void {
        if (!this.isRunning || !this.currentFrame.currentNode) return;
        const node = this.currentFrame.graph.nodes[this.currentFrame.currentNode.id];

        if (resume) {
            this._pause = false;
        }

        if (node.type === 'speech') {
            let next: string | null = null;
            if (optionIndex === undefined) {
                if (node.next) {
                    next = node.next;
                }
                else {
                    if (!node.options || node.options.length === 0) return;
                    optionIndex = 0;
                }
            }
            if (optionIndex !== undefined) {
                if (optionIndex < 0 || !node.options || optionIndex >= node.options.length) {
                    return;
                }
                const chosen = node.options[optionIndex];
                this._emit('onChoice', {
                    optionIndex,
                    node: node,
                    nodeId: this.currentFrame.currentNode.id
                });
                next = chosen.next
            }

            this.goto(next);
        }
        else {
            this._processCurrentNode(this._playEpoch)
        }
    }

    /**
     * Jumps to a specific node.
     * @param nodeId ID of the node to jump to, or null to end.
     */
    goto(nodeId: string | null): void {
        if (!this.isRunning) return;

        this._exitCurrentNode();

        if (nodeId === null) {
            this._endFrame();
            return;
        }
        if (!this.currentFrame.graph.nodes[nodeId]) {
            this._raiseError(new Error(`Node "${nodeId}" not found`));
            return;
        }

        this._enterNode(nodeId, ++this._playEpoch);  // Don't await
    }

    private _endFrame() {
        if (this._frames.length > 1) {
            const left_frame = this._frames.shift()!;
            const node = this.currentFrame.currentNode ?
                (this.currentFrame.graph.nodes[this.currentFrame.currentNode.id] as ImscScriptGraphNodeCallScript) :
                null;
            if (!node || !node.next) {
                this.end();
                return;
            }
            if (this.currentFrame.currentNode) {
                const outputs: AssetPropsPlainObject = {}
                for (const [varname, vardef] of Object.entries(left_frame.graph?.variables?.own ?? {})) {
                    if (vardef.kind === 'out' || vardef.kind === 'in-out') {
                        outputs[varname] = left_frame.variables[varname] ?? null
                    }
                }
                this.currentFrame.nodeOutputs[this.currentFrame.currentNode.id] = outputs
            }
            this._emitStateChange();
            this._emit('onSubScriptExit', {
                frame: left_frame
            })
            this.goto(node.next)
        }
        else {
            this.end();
        }
    }

    /**
     * Ends the current dialog.
     */
    end(): void {
        if (!this._playResolve) return;
        this._exitCurrentNode();
        this._playResolve();
        this._emit('onEnd');
    }

    /**
     * Set value of variable
     * @param key variable name to set
     * @param value value to set
     */
    setVariable(key: string, value: AssetPropsPlainObjectValue, frameIndex = 0): void {
        const frame = this._frames[frameIndex];
        if (!frame) return;

        const old = frame.variables[key] ?? null;

        const vardef = frame.graph.variables?.own?.[key];
        if (vardef && (!vardef.kind || vardef.kind === 'global')) {
            this._globalVariables[key] = value;
        }
        else {
            frame.variables[key] = value;
        }

        this._emit('onVariableChange', {
            variable: key,
            newValue: value,
            oldValue: old,
            frameIndex
        });
        this._emitStateChange();
    }

    /**
     * Get current value of variable
     * @param key variable name to get
     */
    getVariable(key: string, frameIndex = 0): AssetPropsPlainObjectValue {
        const frame = this._frames[frameIndex];
        if (!frame) return null;


        if (frame.variables.hasOwnProperty(key)) {
            return frame.variables[key]
        }

        const vardef = frame.graph.variables?.own?.[key];
        if (!vardef || !vardef.kind || vardef.kind === 'global') {
            return this._globalVariables[key] ?? null;
        }

        return null;
    }

    /**
     * Get current node
     */
    get currentNode(): ImscScriptGraphNode | null {
        if (!this.currentFrame.currentNode) return null;
        return this.currentFrame.graph.nodes[this.currentFrame.currentNode.id] || null;
    }

    /**
     * Get current node id
     */
    get currentNodeId() {
        return this.currentFrame.currentNode?.id ?? null;
    }

    /**
     * Get current state of variables
     */
    get variables(): Readonly<AssetPropsPlainObject> {
        return this.currentFrame.variables;
    }

    /**
     * Get current state of variables
     */
    get globals(): Readonly<AssetPropsPlainObject> {
        return this._globalVariables;
    }

    /**
     * Searilize current state of dialog run
     */
    serialize(): ImscScriptPlayerState {
        return {
            frames: this._frames.map(f => {
                return {
                    ...f,
                    currentNode: f.currentNode ? {
                        ...f.currentNode
                    } : null,
                    variables: {
                        ...f.variables
                    }
                }
            }),
            globals: {
                ...this._globalVariables
            }
        };
    }

    /**
     * Load previously saved state of dialog run. Pause execution if dialog is running
     */
    load(state: ImscScriptPlayerState): void {
        if (state.frames.length === 0) {
            throw new Error(`No frames`)
        }
        if (state.frames[0].currentNode && !state.frames[0].graph.nodes[state.frames[0].currentNode.id]) {
            throw new Error(`Cannot restore: node "${state.frames[0].currentNode.id}" not found`)
        }
        this.pause();
        this._frames = state.frames.map(f => ({
            currentNode: f.currentNode,
            graph: f.graph,
            scriptId: f.scriptId,
            nodeOutputs: { ...f.nodeOutputs },
            variables: { ...f.variables }
        }))
        this._globalVariables = { ...state.globals };
        this._emitStateChange();
    }

    /**
     * Subscribe to event
     * Only one handler can be assigned to event
     * Set null to unsubscribe
     */
    on<K extends keyof ImscScriptPlayerEvents>(event: K, handler: ImscScriptPlayerEvents[K] | null): void {
        this._events[event] = handler ? handler : undefined;
    }

    /**
     * Walk over graph nodes. Each node will be visited only once.
     * Can be used to check consequences of a choice without actually playing.
     * @param callback - callback to be called for each walked node. If it returns false, stop walking. If it returns an array of strings, these nodes will be visited next.
     * @param startNodeId - starting node id (if not provided, the start node will be used).
     */
    inspectGraph(callback: (node: ImscScriptGraphNode, nodeId: string) => boolean | string[] | undefined, startNodeId?: string): void {
        let toVisit: string[] = [];
        const visitedNodeIds = new Set<string>();
        if (startNodeId) toVisit.push(startNodeId);
        else if (this.currentFrame.graph.start) toVisit.push(this.currentFrame.graph.start);
        while (toVisit.length > 0) {
            const nodeId = toVisit.shift();
            if (!nodeId || visitedNodeIds.has(nodeId)) {
                continue;
            }
            const node = this.currentFrame.graph.nodes[nodeId];
            if (!node) {
                continue;
            }
            visitedNodeIds.add(nodeId)
            const res = callback(node, nodeId);
            if (res === false) {
                continue;
            }
            else if (Array.isArray(res)) {
                toVisit = [
                    ...toVisit,
                    ...res
                ]
            }
            else {
                if ('next' in node && node.next) {
                    toVisit.push(node.next)
                }
                if ('options' in node && node.options) {
                    for (const opt of node.options) {
                        if (opt.next) {
                            toVisit.push(opt.next)
                        }
                    }
                }
            }
        }
    }

    registerCustomNode(
        typeName: string,
        kind: 'exec' | 'data',
        handler: (event: ImscScriptPlayerCustomNodeEvent) => ImscScriptPlayerCustomNodeResult | Promise<ImscScriptPlayerCustomNodeResult>
    ): void {
        this._customNodeHandlers.set(typeName, { kind, handler })
    }

    private async _processCurrentNode(playEpoch: number) {
        const evaluatedNode = this.currentFrame.currentNode;
        if (!evaluatedNode) return;
        const nodeId = evaluatedNode.id;
        const graphNode = this.currentFrame.graph.nodes[nodeId];
        if (!graphNode) return;

        try {
            // Process the current node
            switch (graphNode.type) {
                case 'start':
                    this.goto(graphNode.next);
                    break;

                case 'speech':
                    this._handleSpeechNode(nodeId, graphNode, evaluatedNode.inputs, evaluatedNode.optionsInputs);
                    break;

                case 'branch': {
                    const next = this._handleBranchNode(nodeId, graphNode, evaluatedNode.inputs);
                    this.goto(next);
                    break;
                }

                case 'setVar':
                    this._handleSetVarNode(nodeId, graphNode, evaluatedNode.inputs);
                    this.goto(graphNode.next);
                    break;

                case 'trigger': {
                    const next = await this._handleTriggerNode(nodeId, graphNode, evaluatedNode.inputs);
                    if (playEpoch !== this._playEpoch) return; // Stop aborted execution
                    this.goto(next)
                    break;
                }

                case 'end':
                    this._endFrame();
                    break;

                case 'callScript': {
                    const next = await this._handleCallScriptNode(nodeId, graphNode, evaluatedNode.inputs)
                    if (playEpoch !== this._playEpoch) return; // Stop aborted execution
                    this.goto(next)
                    break;
                }

                case 'jump': {
                    const to = castAssetPropValueToString(evaluatedNode.inputs.to);
                    this.goto(to);
                    break;
                }

                case 'timer': {
                    const seconds = castAssetPropValueToFloat(evaluatedNode.inputs.value) ?? 0;
                    if (this._events.onDelay) {
                        await this._events.onDelay({ duration: seconds, nodeId });
                    } else {
                        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
                    }
                    if (playEpoch !== this._playEpoch) return;
                    this.goto((graphNode as any).next);
                    break;
                }

                case 'chance': {
                    const next = await this._handleChanceNode(nodeId, graphNode as ImscScriptGraphNodeChance, evaluatedNode.optionsInputs);
                    if (playEpoch !== this._playEpoch) return;
                    if (next !== undefined) {
                        this.goto(next);
                    }
                    break;
                }

                default: {
                    const custom = this._customNodeHandlers.get((graphNode as any).type)
                    if (custom && custom.kind === 'exec') {
                        const result = await custom.handler({
                            inputs: evaluatedNode.inputs,
                            node: graphNode,
                            nodeId
                        })
                        if (playEpoch !== this._playEpoch) return
                        this.currentFrame.nodeOutputs[nodeId] = result?.outputs ?? {}
                        const next = result?.next !== undefined ? result?.next : (graphNode as any).next
                        this.goto(next)
                        break
                    }
                    throw new Error(`Unexpected node type "${(graphNode as any).type}" in flow`)
                }
            }
        }
        catch (err: any) {
            this._raiseError(err)
        }
    }

    private async _enterNode(nodeId: string, playEpoch: number): Promise<void> {
        if (!this.isRunning) return;
        if (playEpoch !== this._playEpoch) return; // Stop aborted execution

        const node = nodeId ? this.currentFrame.graph.nodes[nodeId] : null;
        if (!node) {
            this.end();
            return;
        }

        await this._emitAsync('onNodeBeforeEnter', {
            nodeId,
            node
        });
        if (playEpoch !== this._playEpoch) return; // Stop aborted execution

        const nodeWithVals = (node as {
            values?: ImscScriptGraphVals,
            options?: ImscScriptGraphNodeOption[],
            subject?: AssetPropsPlainObjectValue
        })
        let inputs = nodeWithVals.values ? await this._evaluateVals(nodeWithVals.values) : {};
        let optionsInputs = nodeWithVals.options ? await Promise.all(nodeWithVals.options.map(async (option, index) => {
            return await this._evaluateVals(option.values);
        })) : [];
        const enterResult = (await this._emitAsync('onNodeEvaluated', {
            inputs,
            optionsInputs,
            node,
            nodeId
        }))
        if (enterResult?.inputs) inputs = enterResult.inputs;
        if (enterResult?.optionsInputs) optionsInputs = enterResult.optionsInputs
        if (this.currentFrame.currentNode !== null) {
            // goto called during handler. Stop process this node
            return;
        }
        if (playEpoch !== this._playEpoch) return; // Stop aborted execution
        this.currentFrame.currentNode = {
            id: nodeId,
            subject: nodeWithVals.subject ?? null,
            inputs,
            optionsInputs
        }
        this._emitStateChange();
        await this._emitAsync('onNodeEnter', {
            inputs,
            optionsInputs,
            node,
            nodeId
        })
        if (this.isPaused) {
            return;
        }

        await this._processCurrentNode(playEpoch);
    }

    private _exitCurrentNode(): void {
        if (!this.currentFrame.currentNode) return;
        const node = this.currentFrame.graph.nodes[this.currentFrame.currentNode.id];
        this._emit('onNodeExit', {
            nodeId: this.currentFrame.currentNode.id,
            node
        });
        this.currentFrame.currentNode = null;
        this._emitStateChange()
    }

    private _handleSpeechNode(nodeId: string, node: ImscScriptGraphNodeSpeech, inputs: AssetPropsPlainObject, optionsInputs: AssetPropsPlainObject[]): void {
        let character = inputs.character
            ? getAssetPropType(inputs.character) === AssetPropType.ASSET
                ? (inputs.character as AssetPropValueAsset).Title
                : castAssetPropValueToString(inputs.character)
            : undefined
        const content: ImscScriptPlayerSpeech = {
            character,
            text: inputs.text ? castAssetPropValueToString(inputs.text) : undefined,
            values: inputs,
            options: []
        }

        if (node.options && node.options.length > 0) {
            content.options = node.options.map((option, index) => {
                const optVals = optionsInputs[index] ?? {};
                return {
                    index,
                    values: optVals,
                    condition: optVals.condition !== undefined && optVals.condition !== null ? castAssetPropValueToBoolean(optVals.condition) : undefined,
                    text: optVals.text ? castAssetPropValueToString(optVals.text) : undefined,
                    nextNodeId: option.next ?? null
                } as ImscScriptPlayerSpeechOption
            })
        }

        this._emit('onSpeech', {
            speech: content,
            node,
            nodeId
        });
        // Do not automatically advance; UI will call continue()
    }

    private _handleBranchNode(nodeId: string, node: ImscScriptGraphNodeBranch, inputs: AssetPropsPlainObject): string | null {
        const condition = castAssetPropValueToBoolean(inputs.condition);
        const chosenOption = condition ? node.options[0] : node.options[1];
        return chosenOption?.next ?? null;
    }

    private async _handleChanceNode(nodeId: string, node: ImscScriptGraphNodeChance, optionsInputs: AssetPropsPlainObject[]): Promise<string | null | undefined> {
        const options = node.options ?? [];
        if (options.length === 0) return node.next;

        const chances: (number | null)[] = [];
        for (let i = 0; i < options.length; i++) {
            const optVals = optionsInputs[i] ?? {};
            const chance = castAssetPropValueToFloat(optVals.chance);
            chances.push(chance !== null && chance !== undefined ? chance : null);
        }

        let explicitSum = 0;
        let explicitCount = 0;
        for (const c of chances) {
            if (c !== null) {
                explicitSum += c;
                explicitCount += 1;
            }
        }
        const elseCount = options.length - explicitCount;

        let randomValue: number;
        let defaultOptionIndex = 0;

        if (explicitCount === 0) {
            randomValue = Math.random();
            defaultOptionIndex = Math.min(Math.floor(randomValue * options.length), options.length - 1);
        }
        else {
            const clamped = chances.map(c => c !== null ? c : 0);
            let sum = 0;
            for (const v of clamped) sum += v;
            if (sum <= 0) {
                randomValue = Math.random();
                defaultOptionIndex = Math.min(Math.floor(randomValue * options.length), options.length - 1);
            }
            else {
                if (elseCount > 0) {
                    const remaining: number = 1 - explicitSum;
                    for (let i = 0; i < chances.length; i++) {
                        if (chances[i] === null) {
                            chances[i] = Math.max(0, remaining / elseCount);
                        }
                    }
                }

                const finalChances = chances.map(c => c ?? 0);
                let total = 0;
                for (const v of finalChances) total += v;
                randomValue = Math.random() * total;

                let cumulative = 0;
                for (let i = 0; i < finalChances.length; i++) {
                    cumulative += finalChances[i]!;
                    if (randomValue < cumulative) {
                        defaultOptionIndex = i;
                        break;
                    }
                }
            }
        }

        const optionsData = chances.map((c, i) => ({ chance: c, nextNodeId: options[i]!.next ?? null }));

        const chosenIndex = await this._emitAsync('onChance', {
            randomValue,
            options: optionsData,
            node,
            nodeId,
            defaultOptionIndex
        }) ?? defaultOptionIndex;

        this._emit('onChoice', {
            optionIndex: chosenIndex,
            node,
            nodeId
        });

        return options[chosenIndex]?.next ?? null;
    }

    private _handleSetVarNode(nodeId: string, node: ImscScriptGraphNodeSetVar, inputs: AssetPropsPlainObject): void {
        const variable = castAssetPropValueToString(inputs.variable);
        this.setVariable(variable, inputs.value);
    }

    private async _handleTriggerNode(nodeId: string, node: ImscScriptGraphNodeTrigger, inputs: AssetPropsPlainObject): Promise<string | null> {
        const result = await this._emitAsync('onAction', {
            type: 'trigger',
            subject: node.subject,
            inputs,
            node,
            nodeId
        });
        this.currentFrame.nodeOutputs[nodeId] = result?.outputs ?? {};
        return result?.next !== null ? (result?.next ?? node.next) : null;
    }


    private async _handleFunctionNode(nodeId: string, node: ImscScriptGraphNodeFunction, inputs: AssetPropsPlainObject): Promise<AssetPropsPlainObject> {
        const result = await this._emitAsync('onAction', {
            type: 'function',
            subject: node.subject,
            inputs,
            node,
            nodeId
        });
        return result?.outputs ?? {};
    }

    private async _handleCallScriptNode(nodeId: string, node: ImscScriptGraphNodeCallScript, inputs: AssetPropsPlainObject): Promise<string | null> {
        const subjectAsset = castAssetPropValueToAsset(node.subject);
        const scriptId = subjectAsset ? subjectAsset.AssetId : castAssetPropValueToString(node.subject);
        if (!scriptId) {
            throw new Error('Subject of subscript call is not defined')
        }
        const script = await this._emitAsync('onLoadScript', {
            scriptId
        })
        if (!script) {
            throw new Error('Subscript is not found')
        }
        const initial: AssetPropsPlainObject = {};
        for (const [varname, vardef] of Object.entries(script.variables?.own ?? {})) {
            if (vardef.kind === 'in' || vardef.kind === 'in-out') {
                if (inputs.hasOwnProperty(varname)) {
                    initial[varname] = inputs[varname]
                }
            }
        }
        const subScriptFrame = this._createFrame(scriptId, script, initial);
        this._frames.unshift(subScriptFrame);
        this._emitStateChange();
        this._emit('onSubScriptEnter', {
            frame: subScriptFrame
        })
        return script.start;
    }


    private async _evaluateValue(
        val: ImscScriptGraphVal,
        visited_pins?: Set<string>,
    ): Promise<AssetPropsPlainObjectValue> {
        if (typeof val === 'object' && val !== null && 'get' in val && 'param' in val) {
            const binding = val as { get: string; param: string };
            const nodeId = binding.get;
            const param = binding.param;
            if (!visited_pins) visited_pins = new Set();
            const pin_key = `${nodeId}-${param}`;
            if (visited_pins.has(pin_key)) {
                throw new Error('Recursion detected');
            }
            visited_pins.add(pin_key)
            const outputs = await this._evaluateNode(nodeId, visited_pins);
            return outputs[param] ?? null;
        }
        return val;
    }

    private async _evaluateVals(vals?: ImscScriptGraphVals): Promise<AssetPropsPlainObject> {
        if (!vals) return {};
        return Object.fromEntries(
            await Promise.all(Object.entries(vals).map(async ([key, val]) => {
                return [key, await this._evaluateValue(val)]
            }))
        )
    }

    private async _evaluateNode(nodeId: string, visited_pins?: Set<string>): Promise<AssetPropsPlainObject> {
        const node = this.currentFrame.graph.nodes[nodeId];
        if (!node) {
            throw new Error(`Node ${nodeId} not found`);
        }

        switch (node.type) {
            case 'constAsset':
            case 'constText':
            case 'constString':
            case 'constInteger':
            case 'constFloat':
            case 'constBoolean':
                return { result: node.values.value };

            case 'getVar': {
                const varName = await this._evaluateValue((node as ImscScriptGraphNodeGetVar).values.variable);
                return { result: this.getVariable(castAssetPropValueToString(varName)) };
            }

            case 'opAnd':
            case 'opOr':
            case 'opMod':
            case 'opDiv':
            case 'opMult':
            case 'opMinus':
            case 'opPlus':
            case 'opMoreEqual':
            case 'opMore':
            case 'opLessEqual':
            case 'opLess':
            case 'opNotEqual':
            case 'opEqual': {
                const binaryNode = node as ImscScriptGraphNodeBinaryOp;
                const [a, b] = await Promise.all([
                    this._evaluateValue(binaryNode.values.arg1, visited_pins),
                    this._evaluateValue(binaryNode.values.arg2, visited_pins)
                ])
                let result: AssetPropsPlainObjectValue;
                switch (node.type) {
                    case 'opAnd': result = a && b; break;
                    case 'opOr': result = a || b; break;
                    case 'opMod':
                    case 'opDiv':
                    case 'opMult':
                    case 'opMinus':
                    case 'opPlus': {
                        const a_num = castAssetPropValueToFloat(a) ?? 0;
                        const b_num = castAssetPropValueToFloat(b) ?? 0;
                        switch (node.type) {
                            case 'opMod':
                                result = a_num % b_num;
                                break;
                            case 'opDiv': {
                                if (Number.isInteger(a) && Number.isInteger(b)) {
                                    result = Math.trunc(a_num / b_num);
                                }
                                else {
                                    result = a_num / b_num;
                                }
                                break;
                            }
                            case 'opMult': result = a_num * b_num; break;
                            case 'opMinus': result = a_num - b_num; break;
                            case 'opPlus': result = a_num + b_num; break;
                        }
                        break;
                    }
                    case 'opMoreEqual': result = compareAssetPropValues(a, b, true) >= 0; break;
                    case 'opMore': result = compareAssetPropValues(a, b, true) > 0; break;
                    case 'opLessEqual': result = compareAssetPropValues(a, b, true) <= 0; break;
                    case 'opLess': result = compareAssetPropValues(a, b, true) < 0; break;
                    case 'opNotEqual': result = compareAssetPropValues(a, b, true) !== 0;; break;
                    case 'opEqual': result = compareAssetPropValues(a, b, true) === 0; break;
                    default: result = null;
                }
                return { result };
            }

            case 'opNot': {
                const unaryNode = node as ImscScriptGraphNodeUnaryOp;
                const a = await this._evaluateValue(unaryNode.values.arg1, visited_pins);
                return { result: !a };
            }

            case 'callScript':
            case 'trigger':
                // Return stored outputs for this trigger node (may be empty if not yet executed)
                return this.currentFrame.nodeOutputs[nodeId] ?? {};

            case 'function': {
                const inputs = await this._evaluateVals(node.values)
                return await this._handleFunctionNode(
                    nodeId,
                    node,
                    inputs,
                )
            }

            default: {
                const custom = this._customNodeHandlers.get((node as any).type)
                if (custom) {
                    if (custom.kind === 'data') {
                        const inputs = await this._evaluateVals((node as any).values)
                        const result = await custom.handler({
                            inputs,
                            node,
                            nodeId
                        })
                        return result?.outputs ?? {}
                    }
                    else {
                        return this.currentFrame.nodeOutputs[nodeId] ?? {};
                    }
                }
                return {}
            }
        }
    }

    private _raiseError(error: Error) {
        this._emit('onError', {
            error
        })
        this.pause();
    }

    private _emit<K extends keyof ImscScriptPlayerEvents>(
        event: K,
        ...args: Parameters<NonNullable<ImscScriptPlayerEvents[K]>>
    ): void {
        const handler = this._events[event];
        if (handler) {
            (handler as any)(...args);
        }
    }

    private async _emitAsync<K extends keyof ImscScriptPlayerEvents>(
        event: K,
        ...args: Parameters<NonNullable<ImscScriptPlayerEvents[K]>>
    ): Promise<ReturnType<Required<ImscScriptPlayerEvents>[K]> | undefined> {
        const handler = this._events[event];
        if (handler) {
            return (handler as any)(...args);
        }
    }

    private _emitStateChange(): void {
        const handler = this._events.onStateChange;
        if (handler) {
            handler({
                state: this.serialize()
            })
        }
    }
}