import postcss, { Root, Result } from 'postcss';

export interface ImporterOptions {}

export default postcss.plugin<ImporterOptions>('postcss-importer', (_opts: ImporterOptions = {}) => {

  // Work with options here

  return (_root: Root, _result?: Result): Promise<void> => {
    // Transform CSS AST here
    return Promise.resolve();
  };
});
