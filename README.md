# PostCSS Importer

[PostCSS] plugin to inline files referenced with `@import`

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/aoberoi/postcss-importer.svg
[ci]:      https://travis-ci.org/aoberoi/postcss-importer

```css
.foo {
    /* Input example */
}
```

```css
.foo {
  /* Output example */
}
```

## Usage

```js
postcss([ require('postcss-importer') ])
```

See [PostCSS] docs for examples for your environment.

## Why?

This is an experiment to find out if I can improve on the existing postcss-import plugin by removing features I don't
feel make sense. I hope to improve both the performance, and the readability/maintainability of the code.

I'm not removing features because I don't think they have valid use cases, but rather because I think most of them can
be solved simply with a custom resolver. If we instead address those use cases by making it easier to build the resolver
of your liking, then I think we end up with an improvement.

*  No enforcement of the specification's constraint that `@import` can only be preceeded by other `@import`s and
   `@charset`s. Also, no enforcement that these atrules must be direct descendents of the root.

*  No `filter` option. Instead, provide a factory for a resolver which can wrap an array of resolvers and respond to a
   synchronous query as to whether or not the resolver can handle a specific identifier. The main difference is that
   the query wouldn't contain the path on disk (that's a specific job of the `NodeResolver`). However, the query does
   contain the parsed params of the `AtRule` and the location from where the request is being made. This information
   could be used to invoke a static method of the `NodeResolver` in order to build the same functionality.

*  The `root` option is moved to the `NodeResolver`, and is specifically positioned as an optimization. By providing a
   `root`, the user can help this plugin skip I/O with the disk to attempt to resolve the identifier in places where the
   user knows would fail.

*  The `paths` option is removed. If you need to initiate resolution from multiple locations on disk, you can initialize
   several `NodeResolver`s with different `root`s, and put them in an array.

*  The `plugins` option is removed. I don't understand the use case for this option, and I'm willing to reinstate it if
   I learn that it is needed. Ideally, we should use the set of `plugins` that come before this plugin in the postcss
   options each time we process another file. I hope there's an easy way to find that. If not, this would be a feature
   request to take to postcss. **NOTE**: I don't want to directly depend on any syntaxes or parsers. In order to
   accomplish this, we need to find a way to get those from postcss, so that the processsor can be invoked using
   the same set of syntaxes or parsers for imported files.

*  The `load` option is removed. I don't understand the use case for this option. It seems like something that either
   would be done with a custom resolver, or using some other options of the `NodeResolver`.

*  The `skipDuplicates` option is removed. In my opinion, this can be solved in the same way as use cases that require
   the `filter` option, as long as the user is willing to do the bookkeeping. For situations like `normalize.css`, as
   the documentation mentions, it may be cheaper and easier to do some basic string operations to implement the
   bookkeeping, rather than storing a large cache of all the raw content that was ever been loaded.

*  The `addModulesDirectories` option is removed. The use case for this option is likely for using custom package
   managers (such as `bower`) that place packages in a directory named something other than `node_modules`. This would
   be better addressed with a custom resolver that works in a way that suits that specific package manager's
   conventions. If it is as simple as a differently named directory, then implementing this custom resolver would be
   as simple as forking the `NodeResolver` code and replacing the property. If I learn of other use cases where it
   might make sense, it would be implemented as an option for `NodeResolver`, not this plugin.

   *  Also, the default value of `"web_modules"` is removed. I understand this comes from the webpack / browserify
      world, but I don't know if developers actually use this in practice anymore.

*  A new resolver, `WebResolver`, can be implemented to fetch files from URLs. That would being more parity with how
   browsers treat `@import` rules in CSS.
