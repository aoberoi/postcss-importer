import { parse, Container } from 'postcss';
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

    // call the resolver to get string content of the file, process it, and hand it back to the ruleExtractor
    // TODO: this might throw
    const content = await this.resolver.resolve(importParams);

    // NOTE: there may be a way to get the initial Processor was used to run this plugin (which contains instances of
    // all the other plugins) so that we can process all imported files with all the preceeding plugins. the effect
    // would be that we can relax the constaint on how early this plugin should be in the chain. in order to do this,
    // this object needs access to the Result instance, to find the Result.processor, and then to search through the
    // processors plugins for all that come before this one. idenitifying this one may not be straight forward. we could
    // use the name, but then we get a new constraint that you cannot use this plugin more than once in the chain
    // (reasonable). or we could try to check for object equality if we could get a reference to the plugin instance.
    // oh yeah, this is how we would get any of the other processing options such as syntax, parser, strigifier, source
    // map options, and the `to` destination.

    // process the content through postcss to get an AST
    return parse(content, { from: importParams.location });
  }
}
