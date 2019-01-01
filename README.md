# PostCSS Importer

[![Build Status](https://travis-ci.com/aoberoi/postcss-importer.svg?branch=master)](https://travis-ci.com/aoberoi/postcss-importer)

A [PostCSS](https://github.com/postcss/postcss) plugin to inline CSS `@import`s.

> ⚠️ This plugin is still experimental. At this time, I am [open to feedback](github.com/aoberoi/postcss-importer) about
> its design and usefulness, but its not fully documented, nor expected to work on production projects yet. Use at your
> own risk.

## Usage

```js
postcss([ require('postcss-importer')(options) ])
```

**TODO**: document options, link to PostCSS runner options in docs.

## Why?

This is an experiment to find out if I can improve on the existing
[postcss-import](https://github.com/postcss/postcss-import) plugin with substantially different design. I think that
project is great, and all the maintainers and contributors of that project deserve congratulations for putting together
such a robust piece of software. I learned a lot from reading the code, and I felt inspired. I aim to improve it in
three specific ways:

1. _Performance_: My understanding from reading the existing plugin code is that each import is processed serially. This
   strategy is probably great in most cases, because later imports benefit from the cached data from previous imports.
   This ensures that a single file is never read more than strictly necessary (only once as long as it doesn't change).
   So the experiment is to find out if an increase in parallelism, trading off the guarantee for minimum number of
   reads, would yield any measurable performance benefits. I'll eventually measure this using the
   [`postcss-benchmark`](https://github.com/postcss/benchmark) methodology.

2. _Simplified design_: I think one of the tradeoffs in making a project versatile to many use cases (which helps gain
   popularity) is that the design becomes more complex over time. This happens naturally to any good design, if the use
   cases grow organically and are solved piecemeal. In hindsight, I felt like many of the plugin options could be
   reduced or eliminated if we used different abstractions. In this experiment, I'm trying to build those abstractions
   in order to arrive at a design that addresses most (but not all) of the original use cases. I've outlined some
   specific ideas in [simplification.md](docs/simplification.md).

3. _Maintainability_: This is completely subjective, but I found the code challenging to read and follow. There are are
   some excellent resources to accelerate the job of plugin developers such as the plugin boilerplate, the eslint
   config, etc. But I think there's room for improvement by using a code style that emphasizes code comments and
   clearer APIs. I've been using [TypeScript](https://www.typescriptlang.org/) on a few projects, and I think it can
   help meet that need. Code style is checked using [tslint](https://palantir.github.io/tslint/) and its considerably
   stricter. I've noticed that PostCSS core already has TypeScript definitions in the repo, so I'm hoping to understand
   if these opinions are welcome or if they cause too much friction for community members who want to participate.

### Why not just contribute these ideas upstream?

Maybe in the future, I can! I felt that my approach was so different from the existing design, that what I created
likely wouldn't make a good PR. I started this as a learning exercise, and I didn't want to encumber that experience
with trying to fit my ideas into an existing box. I needed the freedom to be creative, so I started from scratch. If
any of these ideas catch on, I'm open to working with the community to get them where they are most effective.

PS. I will probably blog about the journey of this project later. [Follow me on Twitter](https://twitter.com/aoberoi) if
you want to know when I've published a post.

## Example

**TODO**: Add better examples

**Input**

```css
/* foo.css */
.foo {
  padding: 2em;
}

/* bar.css */
@import './foo.css';

.bar {
  margin: 0;
}
```

**Output** (processed `bar.css`)

```css
.foo {
  padding: 2em;
}

.bar {
  margin: 0;
}
```
