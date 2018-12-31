import { extractImportParams } from '../../src/index';
import { parse, AtRule } from 'postcss';
import 'mocha'; // tslint:disable-line:no-implicit-dependencies
import { assert } from 'chai'; // tslint:disable-line:no-implicit-dependencies

describe('extractImportParams', () => {
  it('should throw when the rule has no params', () => {
    const rule = atRuleFromString('@import;');
    assert.throws(() => { extractImportParams(rule); }, /Cannot parse @import without params/);
  });
});

// ----- Helpers -----

function atRuleFromString(str: string): AtRule {
  return parse(str).first as AtRule;
}
