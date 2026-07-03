# @caliber/config

Shared developer tooling configuration for the Caliber monorepo: a flat ESLint
config and a base `tsconfig` other packages extend.

## Usage

**ESLint** (`eslint.config.js` in a consuming package):

```js
import caliber from '@caliber/config/eslint';
export default caliber;
```

**TypeScript** (`tsconfig.json`):

```json
{ "extends": "@caliber/config/tsconfig" }
```
