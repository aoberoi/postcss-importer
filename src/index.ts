import postcss, { Result, AtRule, Container, TransformCallback } from 'postcss';
import NodeResolver from './NodeResolver';
import ResolverChain from './ResolverChain';
import RecursiveProcessor from './RecursiveProcessor';

/*
 * General pipeline for how this plugin works:
 *
 * 1. Find all the `@import` rules (`AtRule`s) in the root.
 * 2. Filter out the rules that we don't want to load (like those with a scheme in the URL).
 * 3. Resolve the file on disk that should be loaded.
 * 4. Load the file (either from cache if it was previously loaded, or from disk if not).
 * 5. Go to step 1 (this will involve invoking postcss's processor once again), and continue from here if there are no
 *    `@import` rules in the file contents.
 * 6. Recombine all the ASTs into the root.
 */

export interface ImportParams {
  location: string; // this might be an identifier, or a URL
  from?: string; // this is the location for the file that is doing the import
  // TODO: handle media?
}

export interface Resolver {
  // TODO: maybe the from is optional
  willResolve?: (importParams: ImportParams) => boolean;
  // TODO: do i need to return a file path?
  resolve: (importParams: ImportParams) => Promise<string>;
}

export interface ImporterOptions {
  /** An ordered list of resolvers to use to find the imported style sheet. Defaults to a single NodeResolver. */
  resolvers?: Resolver[];
}

function createRuleExtractor(recursiveProcessor: RecursiveProcessor): TransformCallback {
  return async (container: Container, _result?: Result): Promise<Container> => {
    const importRules = findImportRules(container);
    return Promise.all(importRules.map((rule) => {
      // TODO: turn rule into importParams
      return recursiveProcessor.process({ location: '' });
    })).then((containers) => {
      // Merge the containers, which each represent the contents of the imported style sheet, in place of the import
      // rule.
      importRules.forEach((rule, index) => {
        rule.replaceWith(containers[index]);
      });
      return container;
    });
  };
}

/**
 * Importer plugin
 */
export default postcss.plugin<ImporterOptions>('postcss-importer', ({ resolvers = [] }: ImporterOptions = {}) => {
  // Build the resolver, and potentially the resolver chain
  let resolver;
  if (resolvers.length === 0) {
    resolver = new NodeResolver();
  } else if (resolvers.length === 1) {
    resolver = resolvers[0];
  } else {
    resolver = new ResolverChain(resolvers);
  }

  // Set up the recursive processor, and its dependencies (resolver and rule extractor);
  const recursiveProcessor = new RecursiveProcessor(resolver);
  const ruleExtractor = createRuleExtractor(recursiveProcessor);
  recursiveProcessor.ruleExtractor = ruleExtractor;

  return ruleExtractor;
});

// ----- Helpers -----

/**
 * Find `@import` rules in the given container.
 *
 * The walk methods on container are synchronous, meaning the callback can be called many times, but all before the
 * method returns. This function builds a collection and returns it so that it can be iterated on in any way we need to
 * (either synchronously or asynchronously).
 *
 * @param container a container to walk, often times a Root
 */
function findImportRules(container: Container): AtRule[] {
  const importRules: AtRule[] = [];
  container.walkAtRules('import', r => importRules.push(r));
  return importRules;
}
