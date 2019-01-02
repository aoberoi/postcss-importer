import postcss, { Result, AtRule, Container, TransformCallback } from 'postcss';
import ValueParser from 'postcss-value-parser'; // tslint:disable-line:import-name
import NodeResolver from './NodeResolver';
import ResolverChain from './ResolverChain';
import RecursiveProcessor from './RecursiveProcessor';

/**
 * The details of the `@import` rule's parsed parameters that `Resolver`s use to retrieve CSS string content
 *
 * TODO: handle media?
 */
export interface ImportParams {
  /** The identifier used in the import, either on its own or inside of the `url()` function. */
  location: string;
  /** The absolute path to the file where the import rule was seen. */
  from?: string;
}

/**
 * Resolvers are responsible for turning `ImportParams` into CSS string content. See `NodeResolver` for an example.
 */
export interface Resolver {
  /** Returns a Promise for CSS string content for the given `ImportParams` */
  resolve: (importParams: ImportParams) => Promise<string>;
  /** Returns false when the resolver can synchronously determine that it cannot resolve the given `ImportParams` */
  willResolve?: (importParams: ImportParams) => boolean;
}

/**
 * Options for initializing this plugin.
 */
export interface ImporterOptions {
  /** An ordered list of resolvers to use to find the imported style sheet. Defaults to a single NodeResolver. */
  resolvers?: Resolver[];
}

/**
 * Factory for a function that can extract rules from an AST, and start the recursive processing of all imports.
 */
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
 *
 * TODO: give a general outline of the steps
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
  return importRules.filter(r => r.nodes === undefined);
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

  // NOTE: the typings for rule.source (and its sub-properties) should be optional
  // tslint:disable-next-line:strict-boolean-expressions
  const from: string | undefined = rule.source && rule.source.input && rule.source.input.file;
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
