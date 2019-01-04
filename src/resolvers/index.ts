import { Result } from 'postcss';
import { ImportParams } from '../rule-extractor';
export { default as NodeResolver, NodeResolverOptions }  from './NodeResolver';
export { default as ResolverChain }  from './ResolverChain';

/**
 * Response for a successful resolve and load of content.
 */
export interface ResolverResult {
  /** The CSS content */
  content: string;
  /** An optional file path. Should be an absolute path. When supplied, allows file watchers to monitor changes. */
  file?: string;
}

/**
 * Resolvers are responsible for turning `ImportParams` into CSS string content. See `NodeResolver` for an example.
 */
export interface Resolver {
  /** Returns a Promise for CSS string content (and optionally a file) for the given `ImportParams` */
  resolve: (importParams: ImportParams, result: Result) => Promise<ResolverResult>;
  /** Returns false when the resolver can synchronously determine that it cannot resolve the given `ImportParams` */
  willResolve?: (importParams: ImportParams, result: Result) => boolean;
}
