import { ImportParams } from '../rule-extractor';
import { Resolver, ResolverResult } from './index';
import { Result } from 'postcss';

/**
 * A Resolver that encapsulates an ordered list of Resolvers that can be queried in order to produce a result.
 */
export default class ResolverChain implements Resolver {
  /** List of resolvers to delegate to */
  private resolvers: Resolver[];

  constructor(resolvers: Resolver[]) {
    this.resolvers = resolvers;
  }

  /**
   * Indicates whether any of the resolvers in this chain will attempt to resolve the given `ImportParams`.
   *
   * TODO: cache the resolvers in the chain that want to deal with certain ImportParams, to speed up the process
   * of asking each one later.
   *
   * @param importParams parameters from the `@import` rule
   * @param from location that's requesting the parameters to be resolved
   */
  public willResolve(importParams: ImportParams, result: Result): boolean {
    let canResolve = false;
    for (const resolver of this.resolvers) {
      if (resolver.willResolve !== undefined) {
        canResolve = resolver.willResolve(importParams, result);
      }
      if (canResolve) {
        return true;
      }
    }
    return canResolve;
  }

  /**
   * Delegates to resolvers. Returns the content from the first resolver that succeeds, otherwise keeps attempting the
   * next in the chain.
   *
   * @param importParams parameters from the `@import` rule
   * @param from location that's requesting the parameters to be resolved
   */
  public async resolve(importParams: ImportParams, result: Result): Promise<ResolverResult> {
    for (const resolver of this.resolvers) {
      try {
        return await resolver.resolve(importParams, result);
      } finally { } // tslint:disable-line:no-empty Ignore individual resolver errors
    }
    throw new Error('Resolution failed.');
  }
}
