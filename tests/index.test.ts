import { expect, test } from 'vitest'
import { ImscScriptPlayer } from '../src/Player'
import type { ImscScriptGraph } from '../src/Graph'

test('plays a simple speech graph and ends', async () => {
    const graph: ImscScriptGraph = {
        start: 'hello',
        nodes: {
            hello: {
                type: 'speech',
                values: { character: 'NPC', text: 'Hi!' },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const speeches: any[] = []
    const player = new ImscScriptPlayer(graph, {
        events: {
            onSpeech: ({ speech }) => {
                speeches.push(speech)
                player.continue()
            }
        }
    })

    await player.play()
    expect(speeches).toHaveLength(1)
    expect(speeches[0].character).toBe('NPC')
    expect(speeches[0].text).toBe('Hi!')
})

test('plays a trigger node and receives outputs', async () => {
    const graph: ImscScriptGraph = {
        start: 'trg',
        nodes: {
            trg: {
                type: 'trigger',
                subject: 'test',
                values: {},
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const player = new ImscScriptPlayer(graph, {
        events: {
            onTrigger: async ({ subject }) => {
                expect(subject).toBe('test')
                return { result: 42 }
            }
        }
    })

    await player.play()
})

test('branch node follows condition', async () => {
    const graph: ImscScriptGraph = {
        start: 'branch',
        variables: {
            own: {
                flag: {
                    default: true,
                    name: 'flag',
                    type: {
                        Type: 'boolean'
                    },
                    title: 'Flag',
                    description: null,
                    index: 0
                }
            }
        },
        nodes: {
            branch: {
                type: 'branch',
                values: { condition: { get: 'getFlag', param: 'result' } },
                options: [
                    { next: 'a' },
                    { next: 'b' }
                ]
            },
            getFlag: {
                type: 'getVar',
                values: { variable: 'flag' }
            },
            a: {
                type: 'speech',
                values: { text: 'A' },
                next: 'end'
            },
            b: {
                type: 'speech',
                values: { text: 'B' },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const texts: string[] = []
    const player = new ImscScriptPlayer(graph, {
        events: {
            onSpeech: ({ speech }) => {
                texts.push(speech.text ?? '')
                player.continue()
            }
        }
    })

    await player.play()
    expect(texts).toEqual(['A'])
})

test('setVar node modifies a variable', async () => {
    const graph: ImscScriptGraph = {
        start: 'set',
        nodes: {
            set: {
                type: 'setVar',
                values: { variable: 'myVar', value: 99 },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const player = new ImscScriptPlayer(graph)
    await player.play()
    expect(player.getVariable('myVar')).toBe(99)
})
