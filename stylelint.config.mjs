export default {
  extends: ['stylelint-config-standard', 'stylelint-config-recommended-vue'],
  overrides: [
    {
      files: ['**/*.vue', '**/*.html'],
      customSyntax: 'postcss-html',
    },
  ],
  rules: {
    // 允许 Vue 的 deep 选择器
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['deep', 'global'],
      },
    ],
    // 允许 Vue 的 v-bind 函数
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['v-bind'],
      },
    ],
    // 颜色使用完整格式
    'color-hex-length': 'long',
    // 禁止空块
    'block-no-empty': true,
    // 禁止重复选择器
    'no-duplicate-selectors': true,
  },
}
