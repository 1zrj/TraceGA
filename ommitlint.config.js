module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // 新功能
        "fix", // 修复
        "docs", // 文档
        "style", // 格式
        "refactor", // 重构
        "perf", // 性能
        "test", // 测试
        "build", // 构建
        "ci", // CI
        "chore", // 杂项
        "revert", // 回滚
      ],
    ],
    // type 不能为空
    "type-empty": [2, "never"],
    // subject 不能为空
    "subject-empty": [2, "never"],
    // 允许 subject 为中文
    "subject-case": [0], // 关闭大小写检查
  },
};
