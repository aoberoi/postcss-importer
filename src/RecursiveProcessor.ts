import postcss, { Container, Result, ProcessOptions, Plugin } from 'postcss';
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
  /** Base process options for each processing pass */
  private processOptions: ProcessOptions;
  /** Plugins used for each processing pass */
  private plugins: Plugin<any>[] = [];

  constructor(resolver: ResolverOption, result: Result) {
    this.resolver = resolver;
    this.result = result;

    // Take the options from the top-level processor
    // TODO: do we need the map option?
    const topLevelProcessOptions: ProcessOptions = this.result.opts !== undefined ? this.result.opts : {};
    this.processOptions = {
      to: topLevelProcessOptions.to,
      parser: topLevelProcessOptions.parser,
      syntax: topLevelProcessOptions.syntax,
    };

    // Take plugins that are before this one from the top-level processor
    if (this.result.processor !== undefined) {
      // NOTE: this means that multiple instances of this plugin within the same processor are not supported
      const ownIndex = this.result.processor.plugins.findIndex(p => p.postcssPlugin === 'postcss-importer');
      this.plugins = this.result.processor.plugins.slice(0, ownIndex);
    }

    // Suppress no plugins warning
    // https://github.com/postcss/postcss/issues/1218
    if (this.plugins.length === 0) {
      this.plugins.push(noopPlugin);
    }
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

    // process the content through postcss to get an AST
    // NOTE: assigning "from" process option with the filename where the import rule was written in
    const result = await postcss(this.plugins).process(content, { ...this.processOptions, from: importParams.from });

    // feed the new result back through the rule extractor for recursion.
    return this.ruleExtractor(result.root);
  }
}

const noopPlugin = postcss.plugin('postcss-noop', () => {
  return async () => {}; // tslint:disable-line:no-empty
});
