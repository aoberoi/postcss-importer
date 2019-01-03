import { dirname } from 'path';
import { Resolver, ImportParams } from './index';
import moduleResolve, { AsyncOpts } from 'resolve'; // tslint:disable-line:import-name
import readCache from 'read-cache';
import { Result } from 'postcss';

/**
 * Options for initializing a `NodeResolver`
 */
export interface NodeResolverOptions {
  /** Root directory to resolve relative imports from. */
  root?: string;
}

/**
 * Resolver for string identifiers that refer to files on the filesystem. This resolver uses the Node module resolution
 * algorithm to find the target files.
 *
 * TODO: should there be an alternate Resolver interface that is just a simple function?
 */
export default class NodeResolver implements Resolver {
  /**
   * Root directory to resolve relative imports from.
   *
   * TODO: change the name? root refers to other things in this codebase.
   */
  private root: string;

  constructor({ root }: NodeResolverOptions = {}) {
    // TODO: do i need to make sure the passed in option is an absolute path, or just document that?
    this.root = root !== undefined ? root : process.cwd();
  }

  /**
   * Rejects locations that look like URLs because they are not resolvable as files on the local filesystem.
   */
  public willResolve(importParams: ImportParams): boolean {
    // if the location looks like a URL, bail from trying to resolve it
    // TODO: should we attempt tp handle file:// protocol URLs?
    return !(/^(?:[a-z]+:)?\/\//i.test(importParams.location));
  }

  /**
   * Resolves the location and loads the content from the filesystem.
   */
  public resolve(importParams: ImportParams, _result: Result): Promise<string> {
    const moduleResolveOptions: AsyncOpts = {
      basedir: importParams.from !== undefined ? dirname(importParams.from) : this.root,

      // TODO: i think this allows "bare" imports like `foo` to resolve to filenames like `foo.css`. is that a good
      // thing? i think yes because this is how someone might expect the node module resolution algorithm to work, but
      // if we become more strict (with a loss of compatibility with postcss-import) then are we encouraging users to
      // be more future-proof (and more aligned with browsers)?
      extensions: ['.css'],

      packageFilter: (pkg) => {
        // allow "style" key in package.json to override "main" key
        if (pkg.style) {
          pkg.main = pkg.style;
        // otherwise, when the "main" key is not defined or doesn't reference a .css file, use "index.css" as the
        // default
        } else if (!pkg.main || !/\.css$/.test(pkg.main)) {
          pkg.main = 'index.css';
        }
        return pkg;
      },

      // align better with node's module resolution algorithm
      preserveSymlinks: false,
    };

    // NOTE: this differs from postcss-import because it doesn't attempt to resolve the module name as a local file
    // unless it starts with `./`. this _might_ cause issues for existing projects like bootstrap, so we can revisit
    // this decision later.
    // TODO: store a cache map of identifiers to their resolved path
    return moduleResolvePromise(importParams.location, moduleResolveOptions)
      .then((resolvedLocation: string) => readCache(resolvedLocation, 'utf8'));
  }
}

// ----- Helpers -----

/**
 * Promisifies `moduleResolve()`. Can replace with `util.promisify(moduleResolve)` when minimum node is v8.
 */
function moduleResolvePromise(id: string, opts: AsyncOpts = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    moduleResolve(id, opts, (error, path) => {
      if (error !== null && error !== undefined) {
        return reject(error);
      }
      resolve(path);
    });
  });
}
