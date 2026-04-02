import type { ImscScriptGraph } from "./Graph"

export type ImscBlock = ImscBlockScript | {
    id: string,
    name: string | null,
    type: string,
}


export type ImscBlockScript = {
    id: string,
    name: string | null,
    type: 'script',
    computed: ImscScriptGraph
}


export type ImscAsset = {
    id: string,
    blocks: ImscBlock[]
}