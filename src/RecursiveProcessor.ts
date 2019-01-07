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
  /** Function that triggers the processing of CSS, with inherited options from the top-level processor. */
  private processor: (css: string, from?: string) => Promise<Container>;

  constructor(resolver: ResolverOption, result: Result) {
    this.resolver = resolver;
    this.result = result;

    // Take plugins that are before this one from the top-level processor
    let plugins: Plugin<any>[] = [];
    if (result.processor !== undefined) {
      // NOTE: this means that multiple instances of this plugin within the same processor are not supported
      const ownIndex = result.processor.plugins.findIndex(p => p.postcssPlugin === 'postcss-importer');
      plugins = result.processor.plugins.slice(0, ownIndex);
    }

    const processOptions: Readonly<ProcessOptions> = result.opts !== undefined ? result.opts : {};

    if (plugins.length > 0) {
      this.processor = (css, from) => {
        return postcss(plugins).process(css, { ...processOptions, from }).then(result => result.root);
      };
    } else {
      if (processOptions.parser !== undefined) {
        this.processor = async (css, from) => {
          // TypeScript related bug: https://github.com/Microsoft/TypeScript/issues/29281
          if (processOptions.parser !== undefined) {
            // TODO: Fix type definitions to remove error "'Syntax | Parse' has no compatible call signatures"
            // @ts-ignore
            return processOptions.parser(css, { from });
          }
          throw new Error('Parser process option not found.');
        };
      } else if (processOptions.syntax !== undefined && processOptions.syntax.parse !== undefined) {
        this.processor = async (css, from) => {
          // TypeScript related bug: https://github.com/Microsoft/TypeScript/issues/29281
          if (processOptions.syntax !== undefined && processOptions.syntax.parse !== undefined) {
            // TODO: Fix type definitions to remove error "'{ from: string; }' is not assignable to parameter of type
            // 'SourceMapOptions'"
            // @ts-ignore
            return processOptions.syntax.parse(css, { from });
          }
          throw new Error('Syntax process option not found');
        };
      }
      this.processor = (css, from) => Promise.resolve(postcss.parse(css, { from }));
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
    // NOTE: not using `await` because the return value is of type LazyResult, which technically isn't a Promise
    return this.processor(content, importParams.from)
      // feed the new result back through the rule extractor for recursion.
      .then(this.ruleExtractor);
  }
}
