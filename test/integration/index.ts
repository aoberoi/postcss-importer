import 'mocha'; // tslint:disable-line:no-implicit-dependencies
import { assert } from 'chai'; // tslint:disable-line:no-implicit-dependencies
import postcss from 'postcss';
import { readFile } from 'fs';
import { resolve } from 'path';
import importer from '../../build/index'; // tslint:disable-line:import-name

describe('plugin with default options', () => {
  it('processes a simple import', (done) => {
    const filename = resolve(__dirname, './fixtures/imports_foo.css');

    readFile(filename, (error, css) => {
      if (error) return done(error);
      postcss([importer()])
        .process(css, { from: filename, to: filename })
        .then((result) => {
          // TODO: check sourcemaps?
          // TODO: contents of imports_foo.css, foo.css copied manually, maybe read this from the files?
          assert.include(result.css, '.foo { color: blue; }');
          assert.include(result.css, '.imports_foo { color: blue; }');
          done();
        })
        .catch(done);
    });
  });

  it('should process a transitive import', (done) => {
    const filename = resolve(__dirname, './fixtures/imports_foo_transitively.css');
    readFile(filename, (error, css) => {
      if (error) return done(error);
      postcss([importer()])
        .process(css, { from: filename, to: filename })
        .then((result) => {
          // TODO: assert on the ordering
          console.log(result.css);
          assert.include(result.css, '.foo { color: blue; }');
          assert.include(result.css, '.imports_foo { color: blue; }');
          assert.include(result.css, '.imports_foo_transitively { color: orange; }');
          done();
        })
        .catch(done);
    });
  });

  it('should warn when import rule has a block', (done) => {
    const filename = resolve(__dirname, './fixtures/bad_import_with_block.css');
    readFile(filename, (error, css) => {
      if (error) return done(error);
      postcss([importer()])
        .process(css, { from: filename, to: filename })
        .then((result) => {
          const warnings = result.warnings();
          // TODO: assert more specifically the warning we want to see
          assert.isAtLeast(warnings.length, 1);
          done();
        })
        .catch(done);
    });
  });
});
