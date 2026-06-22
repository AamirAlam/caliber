# @helm/config

Shared developer tooling configuration for the Helm monorepo: a flat ESLint
config and a base `tsconfig` other packages extend.

## Usage

**ESLint** (`eslint.config.js` in a consuming package):

```js
import helm from '@helm/config/eslint';
export default helm;
```

**TypeScript** (`tsconfig.json`):

```json
{ "extends": "@helm/config/tsconfig" }
```
