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
} from "./Graph";
import { castAssetPropValueToAsset, castAssetPropValueToBoolean, castAssetPropValueToFloat, castAssetPropValueToString, compareAssetPropValues, type AssetPropsPlainObject, type AssetPropsPlainObjectValue } from "./Props";

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
    onNodeEnter?: (event: {
        inputs: AssetPropsPlainObject,
        node: ImscScriptGraphNode,
        nodeId: string
    }) => void | Promise<void> | AssetPropsPlainObject | Promise<AssetPropsPlainObject>;
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


export type ImscScriptPlayerFrame = {
    scriptId: string | null
    graph: ImscScriptGraph
    currentNodeId: string | null
    currentNodeInputs: AssetPropsPlainObject
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

        this._newFrame(
            options?.scriptId ?? null,
            graph,
            options?.initialVariables ?? {}
        )
    }

    get currentFrame() {
        return this._frames[0]!;
    }

    private _newFrame(scriptId: string | null, graph: ImscScriptGraph, initialVariables: AssetPropsPlainObject) {
        const frame: ImscScriptPlayerFrame = {
            currentNodeId: null,
            currentNodeInputs: {},
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
        this._frames.unshift(frame);
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
            this.raiseError(
                new Error(`Start node "${nodeId}" not found in graph`)
            )
            return;
        }

        const playPromise = new Promise<void>(resolve => this._playResolve = resolve);
        this.emit('onStart');
        this.enterNode(nodeId, playEpoch); // Don't await

        await playPromise;
    }

    // Resume execution
    resume() {
        if (!this.isRunning) return;
        if (!this._pause) return;
        this._pause = false;
        this.processCurrentNode(++this._playEpoch)
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
    continue(optionIndex?: number): void {
        if (!this.isRunning || !this.currentFrame.currentNodeId) return;
        const node = this.currentFrame.graph.nodes[this.currentFrame.currentNodeId];

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
                this.emit('onChoice', {
                    optionIndex,
                    node: node,
                    nodeId: this.currentFrame.currentNodeId
                });
                next = chosen.next
            }

            this.goto(next);
        }
        else {
            this.processCurrentNode(this._playEpoch)
        }
    }

    /**
     * Jumps to a specific node.
     * @param nodeId ID of the node to jump to, or null to end.
     */
    goto(nodeId: string | null): void {
        if (!this.isRunning) return;
        if (nodeId === null) {
            this.endFrame();
            return;
        }
        if (!this.currentFrame.graph.nodes[nodeId]) {
            this.raiseError(new Error(`Node "${nodeId}" not found`));
            return;
        }

        this.enterNode(nodeId, ++this._playEpoch);  // Don't await
    }

    private endFrame() {
        if (this._frames.length > 1) {
            const left_frame = this._frames.shift();
            const node = this.currentFrame.currentNodeId ?
                (this.currentFrame.graph.nodes[this.currentFrame.currentNodeId] as ImscScriptGraphNodeCallScript) :
                null;
            if (!node || !node.next) {
                this.end();
                return;
            }
            if (this.currentFrame.currentNodeId) {
                const outputs: AssetPropsPlainObject = {}
                for (const [varname, vardef] of Object.entries(left_frame?.graph?.variables?.own ?? {})) {
                    if (vardef.kind === 'out' || vardef.kind === 'in-out') {
                        outputs[varname] = left_frame?.variables[varname] ?? null
                    }
                }
                this.currentFrame.nodeOutputs[this.currentFrame.currentNodeId] = outputs
            }
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
        this.exitCurrentNode();
        this._playResolve();
        this.emit('onEnd');
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

        this.emit('onVariableChange', {
            variable: key,
            newValue: value,
            oldValue: old,
            frameIndex
        });
        this.emitStateChange();
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
        if (!this.currentFrame.currentNodeId) return null;
        return this.currentFrame.graph.nodes[this.currentFrame.currentNodeId] || null;
    }

    /**
     * Get current node id
     */
    get currentNodeId() {
        return this.currentFrame.currentNodeId;
    }

    /**
     * Get current state of variables
     */
    get variables(): Readonly<AssetPropsPlainObject> {
        return { ...this.currentFrame.variables };
    }

    /**
     * Get current state of variables
     */
    get globals(): Readonly<AssetPropsPlainObject> {
        return { ...this._globalVariables };
    }

    /**
     * Searilize current state of dialog run
     */
    serialize(): ImscScriptPlayerState {
        return {
            frames: this._frames,
            globals: this._globalVariables
        };
    }

    /**
     * Load previously saved state of dialog run. Pause execution if dialog is running
     */
    load(state: ImscScriptPlayerState): void {
        if (state.frames.length === 0) {
            throw new Error(`No frames`)
        }
        if (state.frames[0].currentNodeId && !state.frames[0].graph.nodes[state.frames[0].currentNodeId]) {
            throw new Error(`Cannot restore: node "${state.frames[0].currentNodeId}" not found`)
        }
        this.pause();
        this._frames = state.frames.map(f => ({
            currentNodeId: f.currentNodeId,
            currentNodeInputs: f.currentNodeInputs,
            graph: f.graph,
            scriptId: f.scriptId,
            nodeOutputs: { ...f.nodeOutputs },
            variables: { ...f.variables }
        }))
        this._globalVariables = { ...state.globals };
        this.emitStateChange();
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

    private async processCurrentNode(playEpoch: number) {
        const nodeId = this.currentFrame.currentNodeId;
        if (!nodeId) return;
        const node = nodeId ? this.currentFrame.graph.nodes[nodeId] : null;
        if (!node) return;

        try {
            // Process the current node
            switch (node.type) {
                case 'start':
                    this.goto(node.next);
                    break;

                case 'speech':
                    await this.handleSpeechNode(nodeId, node, this.currentFrame.currentNodeInputs);
                    break;

                case 'branch': {
                    const next = this.handleBranchNode(nodeId, node, this.currentFrame.currentNodeInputs);
                    this.goto(next);
                    break;
                }

                case 'setVar':
                    this.handleSetVarNode(nodeId, node, this.currentFrame.currentNodeInputs);
                    this.goto(node.next);
                    break;

                case 'trigger': {
                    const next = await this.handleTriggerNode(nodeId, node, this.currentFrame.currentNodeInputs);
                    if (playEpoch !== this._playEpoch) return; // Stop aborted execution
                    this.goto(next)
                    break;
                }

                case 'end':
                    this.endFrame();
                    break;

                case 'callScript': {
                    const next = await this.handleCallScriptNode(nodeId, node, this.currentFrame.currentNodeInputs)
                    if (playEpoch !== this._playEpoch) return; // Stop aborted execution
                    this.goto(next)
                    break;
                }

                default: {
                    const custom = this._customNodeHandlers.get((node as any).type)
                    if (custom && custom.kind === 'exec') {
                        const result = await custom.handler({
                            inputs: this.currentFrame.currentNodeInputs,
                            node,
                            nodeId
                        })
                        if (playEpoch !== this._playEpoch) return
                        this.currentFrame.nodeOutputs[nodeId] = result?.outputs ?? {}
                        const next = result?.next !== undefined ? result?.next : (node as any).next
                        this.goto(next)
                        break
                    }
                    throw new Error(`Unexpected node type "${(node as any).type}" in flow`)
                }
            }
        }
        catch (err: any) {
            this.raiseError(err)
        }
    }

    private async enterNode(nodeId: string, playEpoch: number): Promise<void> {
        if (!this.isRunning) return;
        if (playEpoch !== this._playEpoch) return; // Stop aborted execution

        this.exitCurrentNode();

        const node = nodeId ? this.currentFrame.graph.nodes[nodeId] : null;
        if (!node) {
            this.end();
            return;
        }

        await this.emitAsync('onNodeBeforeEnter', {
            nodeId,
            node
        });
        if (playEpoch !== this._playEpoch) return; // Stop aborted execution

        const nodeRawValues = (node as { values?: ImscScriptGraphVals }).values;
        const inputs = nodeRawValues ? await this.evaluateVals(nodeRawValues) : {};
        const preprocessedInputs = (await this.emitAsync('onNodeEnter', {
            inputs,
            node,
            nodeId
        })) ?? inputs;
        if (this.currentFrame.currentNodeId !== null) {
            // goto called during handler. Stop process this node
            return;
        }
        if (playEpoch !== this._playEpoch) return; // Stop aborted execution
        this.currentFrame.currentNodeInputs = preprocessedInputs;
        this.currentFrame.currentNodeId = nodeId;
        this.emitStateChange();
        if (this.isPaused) {
            return;
        }

        await this.processCurrentNode(playEpoch);
    }

    private exitCurrentNode(): void {
        if (!this.currentFrame.currentNodeId) return;
        const node = this.currentFrame.graph.nodes[this.currentFrame.currentNodeId];
        this.emit('onNodeExit', {
            nodeId: this.currentFrame.currentNodeId,
            node
        });
        this.currentFrame.currentNodeId = null;
        this.currentFrame.currentNodeInputs = {}
    }

    private async handleSpeechNode(nodeId: string, node: ImscScriptGraphNodeSpeech, inputs: AssetPropsPlainObject): Promise<void> {
        const content: ImscScriptPlayerSpeech = {
            character: inputs.character ? castAssetPropValueToString(inputs.character) : undefined,
            text: inputs.text ? castAssetPropValueToString(inputs.text) : undefined,
            values: inputs,
            options: []
        }

        if (node.options && node.options.length > 0) {
            content.options = await Promise.all(node.options.map(async (option, index) => {
                const optVals = await this.evaluateVals(option.values);
                return {
                    index,
                    values: optVals,
                    condition: optVals.condition !== undefined && optVals.condition !== null ? castAssetPropValueToBoolean(optVals.condition) : undefined,
                    text: optVals.text ? castAssetPropValueToString(optVals.text) : undefined,
                    nextNodeId: option.next ?? null
                } as ImscScriptPlayerSpeechOption
            }))
        }

        this.emit('onSpeech', {
            speech: content,
            node,
            nodeId
        });
        // Do not automatically advance; UI will call continue()
    }

    private handleBranchNode(nodeId: string, node: ImscScriptGraphNodeBranch, inputs: AssetPropsPlainObject): string | null {
        const condition = castAssetPropValueToBoolean(inputs.condition);
        const chosenOption = condition ? node.options[0] : node.options[1];
        return chosenOption?.next ?? null;
    }

    private handleSetVarNode(nodeId: string, node: ImscScriptGraphNodeSetVar, inputs: AssetPropsPlainObject): void {
        const variable = castAssetPropValueToString(inputs.variable);
        this.setVariable(variable, inputs.value);
    }

    private async handleTriggerNode(nodeId: string, node: ImscScriptGraphNodeTrigger, inputs: AssetPropsPlainObject): Promise<string | null> {
        const result = await this.emitAsync('onAction', {
            type: 'trigger',
            subject: node.subject,
            inputs,
            node,
            nodeId
        });
        this.currentFrame.nodeOutputs[nodeId] = result?.outputs ?? {};
        return result?.next !== null ? (result?.next ?? node.next) : null;
    }


    private async handleFunctionNode(nodeId: string, node: ImscScriptGraphNodeFunction, inputs: AssetPropsPlainObject): Promise<AssetPropsPlainObject> {
        const result = await this.emitAsync('onAction', {
            type: 'function',
            subject: node.subject,
            inputs,
            node,
            nodeId
        });
        return result?.outputs ?? {};
    }

    private async handleCallScriptNode(nodeId: string, node: ImscScriptGraphNodeCallScript, inputs: AssetPropsPlainObject): Promise<string | null> {
        const subjectAsset = castAssetPropValueToAsset(node.subject);
        const scriptId = subjectAsset ? subjectAsset.AssetId : castAssetPropValueToString(node.subject);
        if (!scriptId) {
            throw new Error('Subject of subscript call is not defined')
        }
        const script = await this.emitAsync('onLoadScript', {
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
        this._newFrame(scriptId, script, initial);
        return script.start;
    }


    private async evaluateValue(
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
            const outputs = await this.evaluateNode(nodeId, visited_pins);
            return outputs[param] ?? null;
        }
        return val;
    }

    private async evaluateVals(vals?: ImscScriptGraphVals): Promise<AssetPropsPlainObject> {
        if (!vals) return {};
        return Object.fromEntries(
            await Promise.all(Object.entries(vals).map(async ([key, val]) => {
                return [key, await this.evaluateValue(val)]
            }))
        )
    }

    private async evaluateNode(nodeId: string, visited_pins?: Set<string>): Promise<AssetPropsPlainObject> {
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
                const varName = await this.evaluateValue((node as ImscScriptGraphNodeGetVar).values.variable);
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
                    this.evaluateValue(binaryNode.values.arg1, visited_pins),
                    this.evaluateValue(binaryNode.values.arg2, visited_pins)
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
                const a = await this.evaluateValue(unaryNode.values.arg1, visited_pins);
                return { result: !a };
            }

            case 'callScript':
            case 'trigger':
                // Return stored outputs for this trigger node (may be empty if not yet executed)
                return this.currentFrame.nodeOutputs[nodeId] ?? {};

            case 'function': {
                const inputs = await this.evaluateVals(node.values)
                return await this.handleFunctionNode(
                    nodeId,
                    node,
                    inputs,
                )
            }

            default: {
                const custom = this._customNodeHandlers.get((node as any).type)
                if (custom) {
                    if (custom.kind === 'data') {
                        const inputs = await this.evaluateVals((node as any).values)
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

    private raiseError(error: Error) {
        this.emit('onError', {
            error
        })
        this.pause();
    }

    private emit<K extends keyof ImscScriptPlayerEvents>(
        event: K,
        ...args: Parameters<NonNullable<ImscScriptPlayerEvents[K]>>
    ): void {
        const handler = this._events[event];
        if (handler) {
            (handler as any)(...args);
        }
    }

    private async emitAsync<K extends keyof ImscScriptPlayerEvents>(
        event: K,
        ...args: Parameters<NonNullable<ImscScriptPlayerEvents[K]>>
    ): Promise<ReturnType<Required<ImscScriptPlayerEvents>[K]> | undefined> {
        const handler = this._events[event];
        if (handler) {
            return (handler as any)(...args);
        }
    }

    private emitStateChange(): void {
        const handler = this._events.onStateChange;
        if (handler) {
            handler({
                state: this.serialize()
            })
        }
    }
}