import parser from '@babel/eslint-parser'
import { GLOB_JS, sxzz } from '@sxzz/eslint-config'

export default sxzz({
  files: [GLOB_JS],
  languageOptions: {
    parser,
    parserOptions: {
      requireConfigFile: false,
      babelOptions: {
        parserOpts: {
          plugins: ['importAttributes'],
        },
      },
    },
  },
})
