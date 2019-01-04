import { extractImportParams } from '../../src/rule-extractor';
import { parse, AtRule } from 'postcss';
import 'mocha'; // tslint:disable-line:no-implicit-dependencies
import { assert } from 'chai'; // tslint:disable-line:no-implicit-dependencies

describe('extractImportParams()', () => {
  it('should throw when the rule has no params', () => {
    const rule = atRuleFromString('@import;');
    assert.throws(() => { extractImportParams(rule); }, /Cannot parse @import without params/);
  });
  it('should extract a plain identifier location', () => {
    const identifier = 'foo';
    const rule = atRuleFromString(`@import '${identifier}';`);
    const params = extractImportParams(rule);
    assert.equal(params.location, identifier);
  });
  it('should extract a url location', () => {
    const identifier = 'foo';
    const rule = atRuleFromString(`@import url('${identifier}');`);
    const params = extractImportParams(rule);
    assert.equal(params.location, identifier);
  });
  it('should extract the source file', () => {
    const sourceFile = '/foo/bar/baz.css';
    const rule = atRuleFromString("@import 'foo';", sourceFile);
    const params = extractImportParams(rule);
    assert.equal(params.from, sourceFile);
  });
});

// ----- Helpers -----

function atRuleFromString(str: string, sourceFile?: string): AtRule {
  return parse(str, { from: sourceFile }).first as AtRule;
}
