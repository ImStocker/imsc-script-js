import type { AssetPropsPlainObjectValue } from "./Props"

export type ImscScriptGraphVarDef = {
    name: string,
    type: { Type: string },
    title: string,
    default?: AssetPropsPlainObjectValue,
    description: string | null,
    index: number
    autoFill?: boolean | null;
}

export type ImscScriptGraphSettings = {
    speech?: {
        main?: { [prop: string]: ImscScriptGraphVarDef },
        option?: { [prop: string]: ImscScriptGraphVarDef }
    }
}

export type ImscScriptGraphVariables = {
    own?: { [prop: string]: ImscScriptGraphVarDef },
}

export type ImscScriptGraphNodeType =
    | "trigger"


export type ImscScriptGraphValBind = { get: string; param: string };
export type ImscScriptGraphVal = ImscScriptGraphValBind | AssetPropsPlainObjectValue
export type ImscScriptGraphVals = {
    [prop: string]: ImscScriptGraphVal
}

export type ImscScriptGraphNodeOption = {
    values?: ImscScriptGraphVals,
    next: string | null
}

export type ImscScriptGraphNodeBase = {
    index: number,
    pos: { x: number, y: number },
}

export type ImscScriptGraphNodeTrigger = ImscScriptGraphNodeBase & {
    next: string | null,
    type: 'trigger',
    values?: ImscScriptGraphVals,
    subject: string,
    params?: {
        in?: ImscScriptGraphVarDef[],
        out?: ImscScriptGraphVarDef[],
    },
}

export type ImscScriptGraphNodeSpeech = ImscScriptGraphNodeBase & {
    next: string | null,
    type: 'speech',
    values?: ImscScriptGraphVals,
    subject: string,
    options?: ImscScriptGraphNodeOption[]
}


export type ImscScriptGraphNodeConst = ImscScriptGraphNodeBase & {
    type: 'constAsset' | 'constText' | 'constString' | 'constInteger' | 'constFloat' | 'constBoolean',
    values: {
        value: AssetPropsPlainObjectValue
    },
}

export type ImscScriptGraphNodeBinaryOp = ImscScriptGraphNodeBase & {
    type: 'opAnd' | 'opOr' | 'opMod' | 'opDiv' | 'opMult' | 'opMinus' | 'opPlus' | 'opMoreEqual' | 'opMore' | 'opLessEqual' | 'opLess' | 'opNotEqual' | 'opEqual'
    values: {
        arg1: ImscScriptGraphVal,
        arg2: ImscScriptGraphVal
    },
}

export type ImscScriptGraphNodeUnaryOp = ImscScriptGraphNodeBase & {
    type: 'opNot'
    values: {
        arg1: ImscScriptGraphVal
    },
}

export type ImscScriptGraphNodeEnd = ImscScriptGraphNodeBase & {
    type: 'end'
}

export type ImscScriptGraphNodeStart = ImscScriptGraphNodeBase & {
    type: 'start',
    next: string | null,
}

export type ImscScriptGraphNodeGetVar = ImscScriptGraphNodeBase & {
    type: 'getVar',
    values: {
        variable: string
    }
}

export type ImscScriptGraphNodeSetVar = ImscScriptGraphNodeBase & {
    type: 'setVar',
    next: string | null,
    values: {
        variable: string,
        value: ImscScriptGraphVal
    }
}

export type ImscScriptGraphNodeBranch = ImscScriptGraphNodeBase & {
    type: 'branch',
    values: {
        condition: ImscScriptGraphVal
    },
    options: [
        ImscScriptGraphNodeOption,
        ImscScriptGraphNodeOption
    ]
}


export type ImscScriptGraphNode =
    | ImscScriptGraphNodeTrigger
    | ImscScriptGraphNodeSpeech
    | ImscScriptGraphNodeConst
    | ImscScriptGraphNodeBinaryOp
    | ImscScriptGraphNodeUnaryOp
    | ImscScriptGraphNodeEnd
    | ImscScriptGraphNodeStart
    | ImscScriptGraphNodeGetVar
    | ImscScriptGraphNodeSetVar
    | ImscScriptGraphNodeBranch

export type ImscScriptGraph = {
    start: string | null,
    variables?: ImscScriptGraphVariables,
    __settings?: ImscScriptGraphSettings,
    nodes: { [id: string]: ImscScriptGraphNode }
}