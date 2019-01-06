import 'mocha'; // tslint:disable-line:no-implicit-dependencies
import { assert } from 'chai'; // tslint:disable-line:no-implicit-dependencies
import sinon from 'sinon'; // tslint:disable-line:no-implicit-dependencies
import postcss, { Root } from 'postcss';
import { readFile } from 'fs';
import { resolve } from 'path';
import importer from '../../build/plugin'; // tslint:disable-line:import-name

describe('plugin with default options', () => {
  it('processes a simple import', (done) => {
    const filename = resolve(__dirname, './fixtures/imports_foo.css');
    const expectedImport = resolve(__dirname, './fixtures/foo.css');

    readFile(filename, (error, css) => {
      if (error) return done(error);
      postcss([importer()])
        .process(css, { from: filename, to: filename })
        .then((result) => {
          // TODO: check sourcemaps?
          // TODO: contents of imports_foo.css, foo.css copied manually, maybe read this from the files?
          assert.include(result.css, '.foo { color: blue; }');
          assert.include(result.css, '.imports_foo { color: blue; }');

          assert.isAtLeast(result.messages.length, 1);
          const dependencyMessage = result.messages.find(m => m.type === 'dependency');
          assert.exists(dependencyMessage);
          assert.propertyVal(dependencyMessage, 'plugin', 'postcss-importer');
          assert.propertyVal(dependencyMessage, 'file', expectedImport);
          assert.propertyVal(dependencyMessage, 'parent', filename);

          done();
        })
        .catch(done);
    });
  });

  it('should process a transitive import', (done) => {
    const filename = resolve(__dirname, './fixtures/imports_foo_transitively.css');
    const expectedDirectImport = resolve(__dirname, './fixtures/imports_foo.css');
    const expectedIndirectImport = resolve(__dirname, './fixtures/foo.css');

    readFile(filename, (error, css) => {
      if (error) return done(error);
      postcss([importer()])
        .process(css, { from: filename, to: filename })
        .then((result) => {
          // TODO: assert on the ordering
          assert.include(result.css, '.foo { color: blue; }');
          assert.include(result.css, '.imports_foo { color: blue; }');
          assert.include(result.css, '.imports_foo_transitively { color: orange; }');

          assert.isAtLeast(result.messages.length, 2);
          const dependencyMessages = result.messages.filter(m => m.type === 'dependency');
          assert.isNotEmpty(dependencyMessages);
          // @ts-ignore
          const directDependencies = dependencyMessages.filter(m => m.file === expectedDirectImport);
          assert.equal(1, directDependencies.length);
          assert.propertyVal(directDependencies[0], 'plugin', 'postcss-importer');
          assert.propertyVal(directDependencies[0], 'parent', filename);
          // @ts-ignore
          const indirectDependencies = dependencyMessages.filter(m => m.file === expectedIndirectImport);
          assert.equal(1, indirectDependencies.length);
          assert.propertyVal(indirectDependencies[0], 'plugin', 'postcss-importer');
          assert.propertyVal(indirectDependencies[0], 'parent', filename);

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
          // TODO: should we still assert the content of the output?
          // TODO: assert more specifically the warning we want to see
          assert.isAtLeast(warnings.length, 1);
          done();
        })
        .catch(done);
    });
  });

  it('should warn when transitive import rule has a block', (done) => {
    const filename = resolve(__dirname, './fixtures/imports_bad_import.css');
    readFile(filename, (error, css) => {
      if (error) return done(error);
      postcss([importer()])
        .process(css, { from: filename, to: filename })
        .then((result) => {
          const warnings = result.warnings();
          // TODO: should we still assert the content of the output?
          // TODO: assert more specifically the warning we want to see
          // TODO: assert something about the position in the source where the warning references (sourcemaps). the
          // closer the position of the warning to where the bad import occurred, the more useful it is to the user.
          assert.isAtLeast(warnings.length, 1);
          done();
        })
        .catch(done);
    });
  });

  it('should warn when import resolution fails', (done) => {
    const filename = resolve(__dirname, './fixtures/fail_to_resolve.css');
    readFile(filename, (error, css) => {
      if (error) return done(error);
      postcss([importer()])
        .process(css, { from: filename, to: filename })
        .then((result) => {
          const warnings = result.warnings();
          // TODO: assert more specifically the warning we want to see
          // TODO: assert something about the position in the source where the warning references (sourcemaps). the
          // closer the position of the warning to where the bad import occurred, the more useful it is to the user.
          assert.isAtLeast(warnings.length, 1);
          // TODO: assert on the ordering of the following
          assert.include(result.css, "@import './huh.css';");
          assert.include(result.css, '.fail_to_resolve { color: fuchsia; }');
          done();
        })
        .catch(done);
    });
  });
});

describe('plugin with resolver option', () => {
  it('should use a function as the resolver option', (done) => {
    const expectedContent = '.resolved { foo: bar; }';
    const inputCss = "@import 'foo';";
    const dummyFilename = __filename;

    // TODO: verify that the file property of the ResolverResult works
    postcss([importer({
      resolvers: [async () => { return { content: expectedContent }; }],
    })])
      .process(inputCss, { from: dummyFilename, to: dummyFilename })
      .then((result) => {
        assert.include(result.css, expectedContent);
        done();
      })
      .catch(done);
  });
});

describe('plugin when its after another plugin in processing', () => {
  it('should apply the first plugin on imported files', (done) => {
    const filename = resolve(__dirname, './fixtures/imports_foo.css');
    const expectedImport = resolve(__dirname, './fixtures/foo.css');
    const fakePlugin = sinon.fake.resolves(true);

    readFile(filename, (error, css) => {
      if (error) return done(error);
      postcss([
        fakePlugin,
        importer(),
      ])
        .process(css, { from: filename, to: filename })
        .then((result) => {
          assert.include(result.css, '.foo { color: blue; }');
          assert.include(result.css, '.imports_foo { color: blue; }');

          assert.equal(fakePlugin.callCount, 2);

          const firstRoot: Root = fakePlugin.firstCall.args[0];
          if (firstRoot.source === undefined) {
            assert(false, 'first root has no source');
          }
          assert(firstRoot.source.input.file, filename);

          const secondRoot: Root = fakePlugin.secondCall.args[0];
          if (secondRoot.source === undefined) {
            assert(false, 'second root has no source');
          }
          assert(secondRoot.source.input.file, expectedImport);

          done();
        })
        .catch(done);
    });
  });
});

afterEach(() => {
  // Restore the default sandbox here
  sinon.restore();
});
