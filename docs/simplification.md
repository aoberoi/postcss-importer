## Simplifying the design

This document outlines the differences in the design decisions in this plugin as compared to
[postcss-import](https://github.com/postcss/postcss-import). That plugin is excellent! This isn't about expressing
any negativity towards the work that people have done on that project. I'm hoping to contribute as a member of the
PostCSS community, and I'd like to offer some new ideas. This is a learning process, and I need to expose the ideas to
see what others think will, and will not, work.

Here are some of the differences:

* Use a `Resolver` interface to address specialized situations, and replace some existing plugin options. `Resolver`s
  are responsible for turning import parameters into a content string. By default, the plugin uses a `NodeResolver`,
  which encapsulates all the details of how you might load CSS as a node module from the filesystem. This also means
  developers can provide their own resolvers. Imagine building a `WebResolver` which can fetch CSS from a URL - it
  would be relatively easy to implement and would plug right into the this plugins `resolvers` option. The
  `resolvers` option takes an array of `Resolver`s and feeds all import requests to them in order. This changes
  how some existing options would be implemented.

    * The `root` option is a specific concern of the `NodeResolver`, and becomes an option on that class. I might
      provide some other convenience API for specifying this.

    * `paths` functionality can be implemented by using several `NodeResolver`s each with different `root`s. These
      can be passed to the `resolvers` option.

    * The `addModulesDirectories` options is also a specific concern of the `NodeResolver`, however I don't think the
      option is necessary. I believe the use case is to make the plugin compatible with other package managers (such
      as bower) which install modules into different directories. Most package managers which behave that way are no
      longer popular. But if this functionality is needed, it is still possible to implement a custom resolver (e.g.
      `BowerResolver`).

    * The `"web_modules"` module directory is removed from the defaults in `NodeResolver`. This directory name seems
      to come from older versions of Webpack, but is no longer commonly used. Again, this functionality could be
      regained by implementing a custom resolver.

    * `filter` functionality can be implemented by extending an existing `Resolver` and overriding a method to check
      your condition before calling `super()`. I don't plan on implementing this option. I might provide some other
      convenience API for achieving the same result.

    * `skipDuplicates` is essentially a specialized version of `filter`. You just need to do some extra bookkeeping to
      know when something has already been resolved. The example in the documentation uses `normalize.css`, which would
      be very easy to implement by storing a flag the first time you see it, and then rejecting it each time you see it
      again.

    * `load` functionality can be implemented by providing a custom `Resolver` implementation. It might also be useful
      as an option on the `NodeResolver` class. Or, it could become part of the `Resolver` interface, so that you could
      extend an existing `Resolver` implementation and override just that one detail.


* No enforcement of the CSS specification's constraint that `@import` can only be preceded by other `@import` and
  `@charset` rules. I think by nature, PostCSS is about extending the limits of CSS, rather than enforcing the
  specification. I think making sure the output is what the developer wants, is a responsibility of the developer. For
  example, its possible that a later stage plugin will process other `@rule`s differently, and leaving them in the
  source is what the developer or plugin author expects.

* The `plugins` option is removed. Ideally, we should use the set of `plugins` that come before this plugin in the
  current Processor we process another file. The same is true for other Processor options, such as `syntax`, `parser`,
  etc. The key will be identifying this plugin in the Processor's plugin list, so that we can select just the plugins
  that come before it. This ensures that we don't "over-process" a file on import, and that the rest of the plugin chain
  sees the file after its had all its imports inlined.

---

These ideas are not set in stone, and many of them will likely change before I call this project anything other than
an experiment. If you have thoughts or disagree, please
[give me some feedback](https://github.com/aoberoi/postcss-importer/issues).
