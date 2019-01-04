import { AtRule, Container, Result, TransformCallback } from 'postcss';
import ValueParser from 'postcss-value-parser'; // tslint:disable-line:import-name
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
 * Factory for a function that can extract rules from an AST, and start the recursive processing of all imports.
 */
export default function createRuleExtractor(processor: RecursiveProcessor, result: Result): TransformCallback {
  return async (container: Container): Promise<Container> => {
    const importRules = findImportRules(container, result);
    return Promise.all(importRules.map((rule) => {
      const params = extractImportParams(rule);
      return processor.process(params);
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

// ----- Helpers -----

/**
 * Find `@import` rules in the given container. This function is private. It is only exported for testing purposes.
 *
 * The walk methods on container are synchronous, meaning the callback can be called many times, but all before the
 * method returns. This function builds a collection and returns it so that it can be iterated on in any way we need to
 * (either synchronously or asynchronously).
 *
 * TODO: one issue would be if the result refers to the parent, and this function is working on a transitively imported
 * file, then the AtRule node wouldn't even be a part of the result (yet). right?
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/CSS/@import
 *
 * @param container a container to walk, often times a Root
 * @param result the parent result to emit warnings
 */
export function findImportRules(container: Container, result: Result): AtRule[] {
  const importRules: AtRule[] = [];
  container.walkAtRules('import', r => importRules.push(r));

  // According to the CSS spec, the `@import` syntax doesn't allow for a block of declarations following these rules.
  // However, the parser wouldn't catch that issue and we may have some of them in `importRules`. In general, this
  // plugin doesn't try to enforce the spec, but in this case it would produce a nonsense output if we ignored this.
  // So, we filter this condition out below.
  return importRules.filter((r) => {
    if (r.nodes !== undefined) {
      result.warn('Import rules cannot be followed by a block', { node: r });
      return false;
    }
    return true;
  });
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
