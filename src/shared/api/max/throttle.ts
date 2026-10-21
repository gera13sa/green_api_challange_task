// TODO Ограничитель rps, иначе бэк выдает 429, потом над будет убрать
export class MethodThrottle {

	private chain: Promise<unknown> = Promise.resolve();

	private lastAt = 0;

	private readonly intervalMs: number;

	constructor(intervalMs: number) {
		this.intervalMs = intervalMs;
	}

	schedule<T>(fn: () => Promise<T>): Promise<T> {
		const run = this.chain.then(async () => {
			const wait = Math.max(0, this.intervalMs - (Date.now() - this.lastAt));
			if (wait > 0) {
				await new Promise<void>((resolve) => {
					window.setTimeout(resolve, wait);
				});
			}
			this.lastAt = Date.now();
			return fn();
		});
		this.chain = run.then(() => undefined, () => undefined);
		return run;
	}

}
