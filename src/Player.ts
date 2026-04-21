// ImscScriptPlayer.ts

import type { ImscAsset, ImscBlock, ImscBlockScript } from "./Asset";
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
    ImscScriptGraphNodeOption,
    ImscScriptGraphVals,
} from "./Graph";
import { castAssetPropValueToBoolean, castAssetPropValueToFloat, castAssetPropValueToString, compareAssetPropValues, type AssetPropsPlainObjectValue } from "./Props";

export type ImscScriptPlayerSpeechOption = {
    index: number
    condition?: boolean
    text?: string,
    values: Record<string, AssetPropsPlainObjectValue>,
}

export type ImscScriptPlayerSpeech = {
    character?: string
    text?: string,
    values: Record<string, AssetPropsPlainObjectValue>,
    options: ImscScriptPlayerSpeechOption[]
}

export type ImscScriptPlayerEvents = {
    onStart?: () => void;
    onEnd?: () => void;
    onNodeEnter?: (nodeId: string, node: ImscScriptGraphNode) => void;
    onNodeExit?: (nodeId: string, node: ImscScriptGraphNode) => void;
    onSpeech?: (
        speech: ImscScriptPlayerSpeech,
        node: ImscScriptGraphNodeSpeech
    ) => void;
    onChoice?: (optionIndex: number) => void;
    onTrigger?: (
        subject: string,
        inputs: Record<string, AssetPropsPlainObjectValue>,
        node: ImscScriptGraphNodeTrigger
    ) =>
        | void
        | Record<string, AssetPropsPlainObjectValue>
        | Promise<Record<string, AssetPropsPlainObjectValue> | void>;
    onVariableChange?: (key: string, value: AssetPropsPlainObjectValue, oldValue: AssetPropsPlainObjectValue) => void;
    onError?: (error: Error) => void;
    onStateChange?: (state: ImscScriptPlayerState) => void;
}

export type ImscScriptPlayerState = {
    currentNodeId: string | null;
    variables: Record<string, any>;
    triggerOutputs: Record<string, Record<string, any>>; // nodeId -> outputs
}

export type ImscScriptPlayerOptions = {
    blockName?: string;
    initialVariables?: Record<string, AssetPropsPlainObjectValue>;
    events?: ImscScriptPlayerEvents;
};


export class ImscScriptPlayer {
    private _graph: ImscScriptGraph;
    private _currentNodeId: string | null = null;
    private _variables: Record<string, AssetPropsPlainObjectValue> = {};
    private _triggerOutputs: Record<string, Record<string, AssetPropsPlainObjectValue>> = {};
    private _events: ImscScriptPlayerEvents = {};
    private _playResolve: (() => void) | null = null;
    private _pause: boolean = false

    constructor(asset: ImscAsset, options?: ImscScriptPlayerOptions) {
        this._events = options?.events ?? {};

        // Find the block to play
        let block: ImscBlock | undefined = asset.blocks.find(b => {
            return b.type === 'script' && (!options?.blockName || options.blockName === b.name)
        })
        if (block) {
            this._graph = (block as ImscBlockScript).computed;
            this._variables = {
                ...(this._graph.variables?.own ?
                    Object.fromEntries(
                        Object.entries(this._graph.variables.own).map(([varname, vardef]) => {
                            return [varname, vardef.default ?? null]
                        })
                    ) : {}),
                ...(options?.initialVariables ?? {})
            };
        }
        else {
            throw new Error('No valid script graph found in asset');
        }
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

    /**
     * Starts the dialog from the given node, or from the graph's start node if none provided.
     * If the player is already running, it ends the current dialog first.
     * @param startNodeId Optional node ID to start from.
     */
    async play(startNodeId?: string): Promise<void> {
        if (this.isRunning) this.end();

        this._pause = false;
        let nodeId = startNodeId ?? this._graph.start;
        if (!nodeId || !this._graph.nodes[nodeId]) {
            this.emitError(new Error(`Start node "${nodeId}" not found in graph`));
            return;
        }

        const playPromise = new Promise<void>(resolve => this._playResolve = resolve);
        this.emit('onStart');
        this.enterNode(nodeId); // Don't await

        await playPromise;
    }

    /**
     * Allow to pause execution during trigger calls
     */
    pause() {
        this._pause = true;
    }

    /**
     * Continue execution after speech node or pause
     * @param optionIndex selected choice if there are options
     */
    continue(optionIndex?: number): void {
        if (!this.isRunning || !this._currentNodeId) return;
        this._pause = false;
        const node = this._graph.nodes[this._currentNodeId];

        const speechNode = node as ImscScriptGraphNodeSpeech;
        let next: string | null = null;
        if (optionIndex === undefined) {
            if (speechNode.next) {
                next = speechNode.next;
            }
            else {
                if (!speechNode.options || speechNode.options.length === 0) return;
                optionIndex = 0;
            }
        }
        if (optionIndex !== undefined) {
            if (optionIndex < 0 || !speechNode.options || optionIndex >= speechNode.options.length) {
                return;
            }
            const chosen = speechNode.options[optionIndex];
            this.emit('onChoice', optionIndex);
            next = chosen.next
        }

        this.goto(next);
    }

    /**
     * Jumps to a specific node.
     * @param nodeId ID of the node to jump to, or null to end.
     */
    goto(nodeId: string | null): void {
        if (!this.isRunning) return;
        if (nodeId === null) {
            this.end();
            return;
        }
        if (!this._graph.nodes[nodeId]) {
            this.emitError(new Error(`Node "${nodeId}" not found`));
            if (!this._pause) {
                this.end();
            }
            return;
        }

        this.enterNode(nodeId);  // Don't await
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
    setVariable(key: string, value: any): void {
        const old = this._variables[key] ?? null;
        this._variables[key] = value;
        this.emit('onVariableChange', key, value, old);
        this.emitStateChange();
    }

    /**
     * Get current value of variable
     * @param key variable name to get\
     */
    getVariable(key: string): any {
        return this._variables[key] ?? null;
    }

    /**
     * Get current node
     */
    get currentNode(): ImscScriptGraphNode | null {
        if (!this._currentNodeId) return null;
        return this._graph.nodes[this._currentNodeId] || null;
    }

    /**
     * Get current node id
     */
    get currentNodeId() {
        return this._currentNodeId;
    }

    /**
     * Get current state of variables
     */
    get variables(): Readonly<Record<string, AssetPropsPlainObjectValue>> {
        return { ...this._variables };
    }

    /**
     * Searilize current state of dialog run
     */
    serialize(): ImscScriptPlayerState {
        return {
            currentNodeId: this._currentNodeId,
            variables: { ...this._variables },
            triggerOutputs: { ...this._triggerOutputs },
        };
    }

    /**
     * Load previously saved state of dialog run
     */
    load(state: ImscScriptPlayerState): void {
        if (state.currentNodeId && !this._graph.nodes[state.currentNodeId]) {
            this.emitError(new Error(`Cannot restore: node "${state.currentNodeId}" not found`));
            return;
        }
        this._currentNodeId = state.currentNodeId;
        this._variables = { ...state.variables };
        this._triggerOutputs = { ...state.triggerOutputs };
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

    private async enterNode(nodeId: string): Promise<void> {
        if (!this.isRunning) return;

        this.exitCurrentNode();

        const node = nodeId ? this._graph.nodes[nodeId] : null;
        if (!node) {
            this.end();
            return;
        }

        this._currentNodeId = nodeId;
        this.emit('onNodeEnter', nodeId, node);
        this.emitStateChange();
        try {
            // Process the current node
            switch (node.type) {
                case 'start':
                    this.goto(node.next);
                    break;

                case 'speech':
                    await this.handleSpeechNode(nodeId, node);
                    break;

                case 'branch':
                    const next = await this.handleBranchNode(nodeId, node);
                    this.goto(next);
                    break;

                case 'setVar':
                    this.handleSetVarNode(nodeId, node);
                    this.goto(node.next);
                    break;

                case 'trigger':
                    await this.handleTriggerNode(nodeId, node);
                    if (!this.isPaused) {
                        this.goto(node.next);
                    }
                    break;

                case 'end':
                    this.end();
                    break;

                default:
                    // Expression nodes should not be visited as flow nodes
                    throw new Error(`Unexpected node type "${node.type}" in flow`)
            }
        }
        catch (err: any) {
            this.emitError(err)
            if (!this._pause) {
                this.end();
            }
        }
    }

    private exitCurrentNode(): void {
        if (!this._currentNodeId) return;
        const node = this._graph.nodes[this._currentNodeId];
        this.emit('onNodeExit', this._currentNodeId, node);
        this._currentNodeId = null;
    }

    private async handleSpeechNode(nodeId: string, node: ImscScriptGraphNodeSpeech): Promise<void> {
        const inputs = await this.evaluateVals(node.values);

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
                    text: optVals.text ? castAssetPropValueToString(optVals.text) : undefined
                } as ImscScriptPlayerSpeechOption
            }))
        }

        this.emit('onSpeech', content, node);
        // Do not automatically advance; UI will call continue()
    }

    private async handleBranchNode(nodeId: string, node: ImscScriptGraphNodeBranch): Promise<string | null> {
        const conditionVal = await this.evaluateValue(node.values.condition);
        const condition = castAssetPropValueToBoolean(conditionVal);
        const chosenOption = condition ? node.options[0] : node.options[1];
        return chosenOption?.next ?? null;
    }

    private async handleSetVarNode(nodeId: string, node: ImscScriptGraphNodeSetVar): Promise<void> {
        const variable = castAssetPropValueToString(await this.evaluateValue(node.values.variable));
        const value = await this.evaluateValue(node.values.value);
        this.setVariable(variable, value);
    }

    private async handleTriggerNode(nodeId: string, node: ImscScriptGraphNodeTrigger): Promise<void> {
        const inputs = await this.evaluateVals(node.values);
        const outputs = await this.emitTrigger(node.subject, inputs, node);
        this._triggerOutputs[nodeId] = outputs;
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

    private async evaluateVals(vals?: ImscScriptGraphVals): Promise<Record<string, AssetPropsPlainObjectValue>> {
        if (!vals) return {};
        return Object.fromEntries(
            await Promise.all(Object.entries(vals).map(async ([key, val]) => {
                return [key, await this.evaluateValue(val)]
            }))
        )
    }

    private async evaluateNode(nodeId: string, visited_pins?: Set<string>): Promise<Record<string, AssetPropsPlainObjectValue>> {
        const node = this._graph.nodes[nodeId];
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

            case 'getVar':
                const varName = (node as ImscScriptGraphNodeGetVar).values.variable;
                return { result: this._variables[varName] };

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

            case 'trigger':
                // Return stored outputs for this trigger node (may be empty if not yet executed)
                return this._triggerOutputs[nodeId] ?? {};

            default:
                return {}
        }
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

    private async emitTrigger(
        subject: string,
        inputs: Record<string, AssetPropsPlainObjectValue>,
        node: ImscScriptGraphNodeTrigger
    ): Promise<Record<string, AssetPropsPlainObjectValue>> {
        const handler = this._events.onTrigger;
        if (handler) {
            return (await handler(subject, inputs, node)) ?? {};
        }
        else return {}

    }

    private emitError(error: Error): void {
        this.emit('onError', error);
    }

    private emitStateChange(): void {
        const handler = this._events.onStateChange;
        if (handler) {
            handler(this.serialize())
        }
    }
}