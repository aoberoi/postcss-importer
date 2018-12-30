import { Container } from 'postcss';
import { Resolver, ImportParams } from './index';

export default class RecursiveProcessor {
  private resolver: Resolver;
  public ruleExtractor?: any;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  public async process(importParams: ImportParams): Promise<Container> {
    if (!this.resolver) {
      throw new Error('Cannot process an import without a resolver');
    }

    // call the resolver, get string content, process it, and hand it back to the ruleExtractor
    const content = await this.resolver.resolve(importParams);

  }
}
