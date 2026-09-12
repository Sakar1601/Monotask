declare global {
  const Deno: { env: { get(name: string): string | undefined } };
}

export {};
