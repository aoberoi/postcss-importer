import { Resolver, ImportParams } from './index';

export interface NodeResolverOptions {
  // TODO: maybe we don't need this afterall. in the old version, its only used when the file doesn't have a source
  // file defined
  root?: string;
}

export default class NodeResolver implements Resolver {
  // @ts-ignore
  private root: string;

  constructor({ root }: NodeResolverOptions = {}) {
    // TODO: do i need to make sure the passed in option is an absolute path, or just document that?
    this.root = root || process.cwd();
  }

  public willResolve(_importParams: ImportParams): boolean {
    return false;
  }

  public resolve(_importParams: ImportParams): Promise<string> {
    return Promise.resolve('');
  }
}
