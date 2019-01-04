import { AtRule, Container, Result } from 'postcss';
import ValueParser from 'postcss-value-parser'; // tslint:disable-line:import-name
import RecursiveProcessor from './RecursiveProcessor';

/**
 * The details of the `@import` rule's parsed parameters which `Resolver`s can use to retrieve CSS string content
 */
export interface ImportParams {
  /** The identifier used in the import, either on its own or inside of the `url()` function. */
  location: string;
  /** The absolute path to the file where the import rule was seen. */
  from?: string;
}

/**
 * A function that can extract rules from an CSS AST, and invoke recursive processing on each, and return the combined
 * AST when all are complete.
 */
interface RuleExtractor {
  (container: Container): Promise<Container>;
}

/**
 * Factory for a `RuleExtractor`
 *
 * @param processor the processor that can turn `ImportParams` into a CSS AST (`Container`)
 * @param result the top-level processor's `Result` instance, used for warning and error purposes
 */
export default function createRuleExtractor(processor: RecursiveProcessor, result: Result): RuleExtractor {
  return async (container: Container): Promise<Container> => {
    const importRules = findImportRules(container, result);

    return Promise.all(importRules.map((rule) => {
      const params = extractImportParams(rule);
      // Generate an AST for each import rule
      return processor.process(params);
    })).then((containers) => {
      // Merge the resulting containers in place of the import rule which generated them
      importRules.forEach((rule, index) => {
        rule.replaceWith(containers[index]);
      });
      return container;
    });
  };
}

// ----- Helpers -----

/**
 * Find `@import` rules in the given container.
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/CSS/@import
 *
 * @param container a container to walk, often times a Root
 * @param result the top-level processor's `Result` instance
 * @internal
 */
export function findImportRules(container: Container, result: Result): AtRule[] {
  // Builds a the set of `@import` rules
  const importRules: AtRule[] = [];
  container.walkAtRules('import', r => importRules.push(r));

  // According to the CSS spec, the `@import` syntax doesn't allow for a block of declarations following the rule.
  // However, the parser/walk wouldn't catch this. We're not trying to enforce the spec, but in this case it would
  // produce a nonsense output if we ignored that issue. So we filter these out, and warn the user about this issue.
  return importRules.filter((r) => {
    if (r.nodes !== undefined) {
      result.warn('Import rules cannot be followed by a block', { node: r });
      return false;
    }
    return true;
  });
}

/**
 * Extracts an `ImportParams` object from an `AtRule` object that represents an `@import` in the CSS.
 *
 * The implementation allows for bare identifiers (e.g. `@import 'foo';`) or URLs (e.g. `@import url('foo')`).
 *
 * @param rule the `@import` rule to extract parameters from
 * @internal
 */
export function extractImportParams(rule: AtRule): ImportParams {
  const { nodes: parsed } = new ValueParser(rule.params);

  if (parsed.length < 1) {
    throw rule.error('Cannot parse @import without an identifier');
  }

  // NOTE: the typings for rule.source (and its sub-properties) might be optional:
  // https://github.com/postcss/postcss/issues/1214
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
  throw rule.error(
    'Cannot parse @import rule with an invalid identifier. Must be either `[string]` or a `url([string])`.',
  );
}
