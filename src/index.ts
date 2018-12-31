import postcss, { Result, AtRule, Container, TransformCallback } from 'postcss';
import ValueParser from 'postcss-value-parser'; // tslint:disable-line:import-name
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
      const params = extractImportParams(rule);
      return recursiveProcessor.process(params);
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

  // NOTE: we might need to reconsider this return value when we want to give many objects/functions access to the
  // Result object. one idea is to only give those objects/functions access to the parts of Result that they need,
  // and to proxy the warn functions and passing those proxies.
  return ruleExtractor;
});

// ----- Helpers -----

/**
 * Find `@import` rules in the given container. This function is private. It is only exported for testing purposes.
 *
 * The walk methods on container are synchronous, meaning the callback can be called many times, but all before the
 * method returns. This function builds a collection and returns it so that it can be iterated on in any way we need to
 * (either synchronously or asynchronously).
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/CSS/@import
 *
 * @param container a container to walk, often times a Root
 */
export function findImportRules(container: Container): AtRule[] {
  const importRules: AtRule[] = [];
  container.walkAtRules('import', r => importRules.push(r));

  // According to the CSS spec, the `@import` syntax doesn't allow for a block of declarations following these rules.
  // However, the parser wouldn't catch that issue and we may have some of them in `importRules`. In general, this
  // plugin doesn't try to enforce the spec, but in this case it would produce a nonesense output if we ignored this.
  // So, we filter this condition out below.
  // TODO: warn when there's a nodes property. in order to do this i need the result instance.
  return importRules.filter(r => !r.nodes);
}

/**
 * Extracts an `ImportParams` object from an `AtRule` representing an `@import` in the CSS.
 *
 * This function throws when the `@import` rule seems malformed or otherwise not extractable by the implementation.
 * The implementation allows for bare identifiers (e.g. `@import 'foo';`) or URLs (e.g. `@import url('foo')`).
 *
 * @param rule the `@import` rule to extract parameters from
 */
export function extractImportParams(rule: AtRule): ImportParams {
  const { nodes: parsed } = new ValueParser(rule.params);
  if (parsed.length < 1) {
    // TODO: should this instead be a warning? where does this error get caught?
    throw new Error('Cannot parse @import without params');
  }

  const from = rule.source && rule.source.input && rule.source.input.file;
  const firstNode = parsed[0];

  if (firstNode.type === 'string') {
    return {
      from,
      location: firstNode.value,
    };
  }
  if (firstNode.type === 'function') {
    return {
      from,
      location: firstNode.nodes[0].value,
    };
  }
  throw new Error('Cannot parse import rule with invalid value');
}
