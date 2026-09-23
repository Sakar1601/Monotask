export function providerHttpError(provider: string, operation: string, response: Response): Error {
  return new Error(`${provider} ${operation} failed: HTTP ${response.status}`);
}
