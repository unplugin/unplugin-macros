import config from '@sxzz/prettier-config'
export default {
  ...config,
  overrides: [
    {
      files: '*.ts',
      options: {
        parser: 'babel-ts',
      },
    },
  ],
}
