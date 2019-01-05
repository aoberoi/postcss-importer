import { parse, Container, Result } from 'postcss';
import { ResolverOption } from './resolvers';
import { ImportParams } from './rule-extractor';

/**
 * Processes content that comes from additional imports. Processing is turning a CSS string into an AST and running
 * it through a set of plugins. This is recursive since it will end up being run on imports within imports.
 */
export default class RecursiveProcessor {
  /** Resolver used to obtain the CSS strings */
  private resolver: ResolverOption;
  /** Rule extractor that deals with finding imports in newly loaded content from the Resolver. */
  public ruleExtractor?: any;
  /** The initial processor's result */
  private result: Result;

  constructor(resolver: ResolverOption, result: Result) {
    this.resolver = resolver;
    this.result = result;
  }

  /**
   * Begins the recursive processing of an import, returning the AST.
   */
  public async process(importParams: ImportParams): Promise<Container> {
    if (this.ruleExtractor === undefined) {
      throw new Error('Cannot process an import without a rule extractor');
    }

    // call the resolver to get string content of the file
    let content;
    let file;
    try {
      ({ content, file } = await (
        // Depending on whether we have a Resolver or a ResolverFn, it is invoked differently
        typeof this.resolver === 'function' ?
          this.resolver(importParams, this.result) :
          this.resolver.resolve(importParams, this.result))
      );
    } catch (resolverError) {
      // if the import cannot be resolved, output a warning, and return original AtRule to stay in its place
      // TODO: should there be an option about whether this is a warning or an error?
      this.result.warn(`Failed to resolve import of ${importParams.location} from ${importParams.from}`, {
        node: importParams.atrule,
      });
      return importParams.atrule;
    }

    // Log the dependency message. This is mostly use by watchers.
    if (file !== undefined) {
      this.result.messages.push({
        type: 'dependency',
        plugin: 'postcss-importer',
        // @ts-ignore
        // tslint:disable-next-line
        file,
        parent: importParams.from,
      });
    }

    // NOTE: there may be a way to get the initial Processor was used to run this plugin (which contains instances of
    // all the other plugins) so that we can process all imported files with all the preceding plugins. the effect
    // would be that we can relax the constraint on how early this plugin should be in the chain. in order to do this,
    // this object needs access to the Result instance, to find the Result.processor, and then to search through the
    // processors plugins for all that come before this one. identifying this one may not be straight forward. we could
    // use the name, but then we get a new constraint that you cannot use this plugin more than once in the chain
    // (reasonable). or we could try to check for object equality if we could get a reference to the plugin instance.
    // oh yeah, this is how we would get any of the other processing options such as syntax, parser, stringifier, source
    // map options, and the `to` destination.

    // process the content through postcss to get an AST, feed this back through the rule extractor for recursion.
    return this.ruleExtractor(parse(content, { from: importParams.from }));
  }
}
