import { parse, Container } from 'postcss';
import { Resolver, ImportParams } from './index';

/**
 * Processes content that comes from additional imports. Processing is turning a CSS string into an AST and running
 * it through a set of plugins. This is recursive since it will end up being run on imports within imports.
 *
 * TODO: should a method of this object be the "root" of the process?
 */
export default class RecursiveProcessor {
  /** Resolver used to obtain the CSS strings */
  private resolver: Resolver;
  /** TODO: why is this here? */
  public ruleExtractor?: any;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  /**
   * Begins the recursive processing of an import, returning the AST.
   */
  public async process(importParams: ImportParams): Promise<Container> {
    if (this.ruleExtractor === undefined) {
      throw new Error('Cannot process an import without a rule extractor');
    }

    // call the resolver to get string content of the file, process it, and hand it back to the ruleExtractor
    // TODO: this might throw
    const content = await this.resolver.resolve(importParams);

    // NOTE: there may be a way to get the initial Processor was used to run this plugin (which contains instances of
    // all the other plugins) so that we can process all imported files with all the preceding plugins. the effect
    // would be that we can relax the constraint on how early this plugin should be in the chain. in order to do this,
    // this object needs access to the Result instance, to find the Result.processor, and then to search through the
    // processors plugins for all that come before this one. identifying this one may not be straight forward. we could
    // use the name, but then we get a new constraint that you cannot use this plugin more than once in the chain
    // (reasonable). or we could try to check for object equality if we could get a reference to the plugin instance.
    // oh yeah, this is how we would get any of the other processing options such as syntax, parser, stringifier, source
    // map options, and the `to` destination.

    // process the content through postcss to get an AST
    return parse(content, { from: importParams.location });
  }
}
