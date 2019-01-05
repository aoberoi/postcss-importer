import postcss, { Result, Root, Container } from 'postcss';
import createRuleExtractor from './rule-extractor'; // tslint:disable-line:import-name
import RecursiveProcessor from './RecursiveProcessor';
import { Resolver, ResolverOption, NodeResolver, NodeResolverOptions, ResolverChain } from './resolvers';

/**
 * Options for initializing this plugin.
 */
export interface ImporterOptions {
  /** An ordered list of resolvers to use to find the imported style sheet. Defaults to a single NodeResolver. */
  resolvers?: ResolverOption[];
}

/**
 * Importer plugin
 *
 * The incoming CSS is processed through a pipeline of functions/objects that may repeat recursively.
 *
 *      /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
 *      |                                              |
 *      ↓                                              |
 * ruleExtractor ---(may return or recurse)--→ RecursiveProcessor --→ Resolver(s)
 */
export default postcss.plugin<ImporterOptions>('postcss-importer', ({ resolvers = [] }: ImporterOptions = {}) => {
  // Build the resolver, and potentially the resolver chain
  const resolver: ResolverOption = (() => {
    if (resolvers.length === 0) {
      return new NodeResolver();
    }
    if (resolvers.length === 1) {
      return resolvers[0];
    }
    return new ResolverChain(resolvers);
  })();

  return async (root: Root, result?: Result): Promise<Container> => {
    // TODO: remove the following check if this issue gets fixed: https://github.com/postcss/postcss/issues/1213
    if (result === undefined) {
      throw new Error('postcss-importer cannot run without a result defined');
    }

    // initialize all pipeline objects, binding the result reference into them in order to report warnings and errors
    const recursiveProcessor = new RecursiveProcessor(resolver, result);
    const ruleExtractor = createRuleExtractor(recursiveProcessor, result);
    recursiveProcessor.ruleExtractor = ruleExtractor;

    // kick off processing at the root
    return ruleExtractor(root);
  };
});

// Re-exporting interfaces/values that are meant to be public
export { Resolver, ResolverOption, NodeResolver, NodeResolverOptions, ResolverChain };
