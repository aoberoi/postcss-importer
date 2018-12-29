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
