import 'mocha'; // tslint:disable-line:no-implicit-dependencies
import { assert } from 'chai'; // tslint:disable-line:no-implicit-dependencies
import postcss from 'postcss';
import { readFile } from 'fs';
import { resolve } from 'path';
import importer from '../../build/index'; // tslint:disable-line:import-name

describe('simple single import', () => {
  it('should work', (done) => {
    const filename = resolve(__dirname, './fixtures/single_import.css');

    readFile(filename, (error, css) => {
      if (error) return done(error);
      postcss([importer()])
        .process(css, { from: filename, to: filename })
        .then((result) => {
          // TODO: check sourcemap?
          // TODO: contents of simple_import.css, foo.css copied manually, maybe read this from the files?
          assert.include(result.css, '.foo { color: blue; }');
          assert.include(result.css, '.single { color: blue; }');
          done();
        })
        .catch(done);
    });
  });
});

describe('badly formed import', () => {
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
    })
  });
});
