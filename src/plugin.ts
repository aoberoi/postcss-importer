import postcss, { Result, Root, Container, TransformCallback } from 'postcss';
import createRuleExtractor from './rule-extractor'; // tslint:disable-line:import-name
import RecursiveProcessor from './RecursiveProcessor';
import { Resolver, NodeResolver, ResolverChain } from './resolvers';

/**
 * Options for initializing this plugin.
 */
export interface ImporterOptions {
  /** An ordered list of resolvers to use to find the imported style sheet. Defaults to a single NodeResolver. */
  resolvers?: Resolver[];
}

/**
 * Importer plugin
 *
 * TODO: give a general outline of the steps
 */
export default postcss.plugin<ImporterOptions>('postcss-importer', ({ resolvers = [] }: ImporterOptions = {}) => {
  // Build the resolver, and potentially the resolver chain
  const resolver: Resolver = (() => {
    if (resolvers.length === 0) {
      return new NodeResolver();
    }
    if (resolvers.length === 1) {
      return resolvers[0];
    }
    return new ResolverChain(resolvers);
  })();

  // NOTE: we might need to reconsider this return value when we want to give many objects/functions access to the
  // Result object. one idea is to only give those objects/functions access to the parts of Result that they need,
  // and to proxy the warn functions and passing those proxies.
  // return ruleExtractor;
  const plugin: TransformCallback = async (root: Root, result?: Result): Promise<Container> => {
    // TODO: remove the following check once the type definitions are updated. result should not be optional.
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
  return plugin;
});

// Re-exporting interfaces/values that are meant to be public
export { Resolver, NodeResolver, ResolverChain };
