import { dirname } from 'path';
import _nodeResolve, { AsyncOpts } from 'resolve'; // tslint:disable-line:import-name
import readCache from 'read-cache';
import promisify from 'util.promisify'; // tslint:disable-line:import-name
import { Result } from 'postcss';
import { Resolver } from './index';
import { ImportParams } from '../rule-extractor';

const nodeResolve = promisify(_nodeResolve);

/**
 * Options for initializing a `NodeResolver`
 */
export interface NodeResolverOptions {
  /** Root directory to resolve relative imports from. Must be an absolute path. Defaults to process.cwd(). */
  root?: string;
}

/**
 * Resolver for string identifiers that refer to files on the filesystem. This resolver uses the Node module resolution
 * algorithm to find a target file.
 */
export default class NodeResolver implements Resolver {
  /**
   * Root directory to resolve relative imports from.
   *
   * TODO: change the name? root refers to other things in this codebase.
   */
  private root: string;

  constructor({ root }: NodeResolverOptions = {}) {
    this.root = root !== undefined ? root : process.cwd();
  }

  /**
   * Rejects locations that look like URLs because they are not resolvable as files on the local filesystem.
   */
  public willResolve(importParams: ImportParams): boolean {
    // If it looks like there's a protocol, rejects the location.
    return !(/^(?:[a-z]+:)?\/\//i.test(importParams.location));
  }

  /**
   * Resolves the location and loads the content from the filesystem.
   */
  public resolve(importParams: ImportParams, _result: Result): Promise<string> {
    const moduleResolveOptions: AsyncOpts = {
      basedir: importParams.from !== undefined ? dirname(importParams.from) : this.root,
      extensions: [], // see: https://github.com/aoberoi/postcss-importer/issues/10
      preserveSymlinks: false, // align with node's module resolution algorithm

      // Allow resolution with packages whose package.json contains a "style" key to refer to the main .css export.
      packageFilter: (pkg) => {
        if (pkg.style) {
          pkg.main = pkg.style;
        } else if (!pkg.main || !/\.css$/.test(pkg.main)) {
          // Falls back to `index.css` when "style" and "main" are not defined or "main" doesn't end in .css
          pkg.main = 'index.css';
        }
        return pkg;
      },
    };

    // Option for relative imports. see: https://github.com/aoberoi/postcss-importer/issues/11
    // Cache ImportParams to path mapping. see: https://github.com/aoberoi/postcss-importer/issues/12
    return nodeResolve(importParams.location, moduleResolveOptions)
      .then((resolvedLocation: string) => readCache(resolvedLocation, 'utf8'));
  }
}
