type Environment = Record<string, string | undefined>
type Options = { encoding?: string; env?: Environment; input?: string }
type Command = (command: string, args: string[], options: Options) => { status: number | null; stdout: string }
export function localDocker(run?: Command, environment?: Environment): { env: Environment; run(args: string[], options?: Options): ReturnType<Command> }
