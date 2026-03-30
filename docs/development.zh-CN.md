# HookNexus CLI — 开发与测试

**语言：** [English](development.md) · [简体中文](development.zh-CN.md)

面向在本仓库中参与开发或贡献代码的维护者。

## 环境

- Node.js **>= 18**（与 `package.json` 中 `engines` 一致）
- 推荐使用 [pnpm](https://pnpm.io/)（本仓库脚本按 pnpm 编写；使用 npm/yarn 时需自行对照命令）

## 克隆与安装

```bash
git clone <本仓库 URL>
cd hooknexus-cli   # 以你实际目录名为准
pnpm install
```

## 构建

```bash
pnpm build
```

发布前会执行 `prepublishOnly` 自动构建；本地调试前请先执行一次构建，保证 `dist/` 与 `bin/` 一致。

## 本地运行 CLI

构建完成后任选其一：

```bash
pnpm start -- --help
node bin/hooknexus.js --help
```

将 `pnpm start --` 后面的参数当作 `hooknexus` 的子命令与选项即可。

## 测试

```bash
pnpm test
```

监听模式：

```bash
pnpm test:watch
```

测试脚本对应 `test:commands`（Vitest）。

## 类型检查

```bash
pnpm lint
```

## 测试覆盖范围（摘要）

当前命令相关测试主要覆盖以下命令组的关键路径：

- `auth`
- `endpoints`
- `requests`
- `account`
- `config`
- `listen`
- `forward`

并包含 **Free / Plus** 下的重要分支，例如：

- Free 不允许 `requests replay`
- Plus 允许 `requests replay`
- Plus 下永久 endpoint 的创建路径

新增命令或改动计费/权限逻辑时，请补充或更新对应测试（`src/__tests__/`）。
