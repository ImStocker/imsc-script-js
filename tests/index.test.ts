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
            onAction: async ({ subject }) => {
                expect(subject).toBe('test')
                return {
                    outputs: {
                        result: 42
                    }
                }
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
                    }
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

    const player = new ImscScriptPlayer(graph, {
        initialVariables: {
            myVar: 25
        }
    })
    await player.play()
    expect(player.getVariable('myVar')).toBe(99)
})

test('function node computing max of two values', async () => {
    const graph: ImscScriptGraph = {
        start: 'setResult',
        nodes: {
            constA: {
                type: 'constInteger',
                values: { value: 10 }
            },
            constB: {
                type: 'constInteger',
                values: { value: 25 }
            },
            maxFunc: {
                type: 'function',
                subject: 'max',
                values: {
                    a: { get: 'constA', param: 'result' },
                    b: { get: 'constB', param: 'result' }
                }
            },
            setResult: {
                type: 'setVar',
                values: {
                    variable: 'result',
                    value: { get: 'maxFunc', param: 'result' }
                },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const player = new ImscScriptPlayer(graph, {
        events: {
            onAction: async ({ type, subject, inputs }) => {
                if (type === 'function' && subject === 'max') {
                    return { outputs: { result: Math.max(inputs.a as number, inputs.b as number) } }
                }
            }
        }
    })

    await player.play()
    expect(player.getVariable('result')).toBe(25)
})

test('callScript node runs a sub-graph and reads outputs', async () => {
    const subGraph: ImscScriptGraph = {
        start: 'start',
        variables: {
            own: {
                a: { name: 'a', type: { Type: 'integer' }, kind: 'in' },
                b: { name: 'b', type: { Type: 'integer' }, kind: 'in' },
                sum: { name: 'sum', type: { Type: 'integer' }, kind: 'out' }
            }
        },
        nodes: {
            start: { type: 'start', next: 'setSum' },
            getA: {
                type: 'getVar',
                values: { variable: 'a' }
            },
            getB: {
                type: 'getVar',
                values: { variable: 'b' }
            },
            add: {
                type: 'opPlus',
                values: {
                    arg1: { get: 'getA', param: 'result' },
                    arg2: { get: 'getB', param: 'result' }
                }
            },
            setSum: {
                type: 'setVar',
                values: { variable: 'sum', value: { get: 'add', param: 'result' } },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const graph: ImscScriptGraph = {
        start: 'callCalc',
        nodes: {
            callCalc: {
                type: 'callScript',
                subject: 'adder',
                values: { a: 5, b: 3 },
                next: 'readResult'
            },
            readResult: {
                type: 'setVar',
                values: { variable: 'result', value: { get: 'callCalc', param: 'sum' } },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const player = new ImscScriptPlayer(graph, {
        events: {
            onLoadScript: async ({ scriptId }) => {
                if (scriptId === 'adder') return subGraph
                else throw new Error('Not found')
            }
        }
    })

    await player.play()
    expect(player.getVariable('result')).toBe(8)
})

test('callScript node reads and modifies globals from sub-graph', async () => {
    const subGraph: ImscScriptGraph = {
        start: 'start',
        variables: {
            own: {
                amount: { name: 'amount', type: { Type: 'integer' }, kind: 'in' },
                counter: { name: 'counter', type: { Type: 'integer' }, kind: 'global' }
            }
        },
        nodes: {
            start: { type: 'start', next: 'setCounter' },
            getCounter: {
                type: 'getVar',
                values: { variable: 'counter' }
            },
            getAmount: {
                type: 'getVar',
                values: { variable: 'amount' }
            },
            add: {
                type: 'opPlus',
                values: {
                    arg1: { get: 'getCounter', param: 'result' },
                    arg2: { get: 'getAmount', param: 'result' }
                }
            },
            setCounter: {
                type: 'setVar',
                values: { variable: 'counter', value: { get: 'add', param: 'result' } },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const graph: ImscScriptGraph = {
        start: 'callInc',
        variables: {
            own: {
                counter: { name: 'counter', type: { Type: 'integer' } },
                result: { name: 'result', type: { Type: 'integer' }, kind: 'local' }
            }
        },
        nodes: {
            callInc: {
                type: 'callScript',
                subject: 'increment',
                values: { amount: 5 },
                next: 'saveCounter'
            },
            getCounter: {
                type: 'getVar',
                values: { variable: 'counter' }
            },
            saveCounter: {
                type: 'setVar',
                values: { variable: 'result', value: { get: 'getCounter', param: 'result' } },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const player = new ImscScriptPlayer(graph, {
        events: {
            onLoadScript: async ({ scriptId }) => {
                if (scriptId === 'increment') return subGraph
                else throw new Error('Not found')
            }
        }
    })

    await player.play()
    expect(player.getVariable('counter')).toBe(5)
    expect(player.getVariable('result')).toBe(5)
})

test('custom exec node runs handler with inputs and stores outputs', async () => {
    const graph: ImscScriptGraph = {
        start: 'greet',
        nodes: {
            greet: {
                type: 'makeGreeting' as any,
                next: 'save',
                values: { name: 'Alice' }
            },
            save: {
                type: 'setVar',
                values: { variable: 'result', value: { get: 'greet', param: 'greeting' } },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const player = new ImscScriptPlayer(graph)
    player.registerCustomNode('makeGreeting', 'exec', async ({ inputs }) => {
        return { outputs: { greeting: `Hello, ${inputs.name}!` } }
    })

    await player.play()
    expect(player.getVariable('result')).toBe('Hello, Alice!')
})

test('custom exec node next override via handler', async () => {
    const graph: ImscScriptGraph = {
        start: 'decide',
        nodes: {
            decide: {
                type: 'route' as any,
                next: 'skipped',
                values: { goTo: 'target' }
            },
            skipped: {
                type: 'setVar',
                values: { variable: 'result', value: 'wrong' },
                next: 'end'
            },
            target: {
                type: 'setVar',
                values: { variable: 'result', value: 'correct' },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const player = new ImscScriptPlayer(graph)
    player.registerCustomNode('route', 'exec', async ({ inputs }) => {
        return { next: inputs.goTo as string }
    })

    await player.play()
    expect(player.getVariable('result')).toBe('correct')
})

test('custom data node used in expression', async () => {
    const graph: ImscScriptGraph = {
        start: 'setResult',
        nodes: {
            double: {
                type: 'doubleValue' as any,
                values: { value: 21 }
            },
            setResult: {
                type: 'setVar',
                values: { variable: 'result', value: { get: 'double', param: 'result' } },
                next: 'end'
            },
            end: { type: 'end' }
        }
    }

    const player = new ImscScriptPlayer(graph)
    player.registerCustomNode('doubleValue', 'data', async ({ inputs }) => {
        return { outputs: { result: (inputs.value as number) * 2 } }
    })

    await player.play()
    expect(player.getVariable('result')).toBe(42)
})
