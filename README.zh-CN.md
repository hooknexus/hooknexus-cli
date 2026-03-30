# HookNexus CLI

**语言：** [English](README.md) · [简体中文](README.zh-CN.md)

HookNexus 官方命令行工具，用于登录账号、管理 endpoint、监听 webhook、查看请求，以及把线上 webhook 转发到本地服务。

## 环境要求

- [Node.js](https://nodejs.org/) **18 及以上**

## 安装

```bash
npm install -g hooknexus
```

全局安装后，终端中可使用 `hooknexus`（部分环境也可使用别名 `hnx`，与 `package.json` 中 `bin` 配置一致）。

## 快速开始

```bash
# 1. 登录（当前只支持 GitHub OAuth）
hooknexus login

# 2. 创建 endpoint
hooknexus endpoints create

# 3. 开始监听
hooknexus listen

# 4. 转发到本地
hooknexus forward --to http://localhost:3000/webhook
```

## 命令概览

### 认证

```bash
hooknexus login
hooknexus logout
hooknexus whoami
```

- `login` 当前固定走 GitHub OAuth
- 如果本地已有登录态，会先提示是否切换账号

### Endpoint 管理

```bash
hooknexus endpoints
hooknexus endpoints ls
hooknexus endpoints create
hooknexus endpoints create --permanent
hooknexus endpoints info <endpoint-id>
hooknexus endpoints delete <endpoint-id>
```

说明：

- `endpoints` 裸跑时会显示该命令组的帮助
- `--permanent` 是 `Plus` 功能

### 监听请求

```bash
hooknexus listen
hooknexus listen <endpoint-id>
hooknexus listen <endpoint-id-1> <endpoint-id-2>
hooknexus listen --all
hooknexus listen --json
hooknexus listen --quiet
```

说明：

- 不传 endpoint 时，CLI 会先尝试读取你账号下的 endpoint
- 如果只有一个 endpoint，会自动使用它
- 如果有多个 endpoint，交互终端下会让你选择
- 如果一个都没有，会自动创建一个普通 endpoint 再继续

### 转发到本地

```bash
hooknexus forward --to http://localhost:3000/webhook
hooknexus forward <endpoint-id> --to http://localhost:3000/webhook
hooknexus forward --to http://localhost:3000 --preserve-path
hooknexus forward --to http://192.168.1.100:8080 --allow-external
```

说明：

- `Free` 和 `Plus` 都可以使用本地转发
- 默认只允许转发到 `localhost / 127.0.0.1 / .local`
- 需要转发到远端地址时，显式加 `--allow-external`
- 不传 endpoint 时，选择逻辑与 `listen` 相同

### 请求查看与重放

```bash
hooknexus requests
hooknexus requests ls <endpoint-id>
hooknexus requests show <request-id>
hooknexus requests body <request-id>
hooknexus requests replay <request-id> --to http://localhost:3000/webhook
```

说明：

- `requests` 裸跑时会显示该命令组帮助
- `requests body` 会在可解析 JSON 时自动格式化输出
- 输入了不完整的 request id 时，CLI 会提示你先用 `requests ls` 拿完整 id
- `requests replay` 当前是 `Plus` 功能

### 账户与订阅

```bash
hooknexus account info
hooknexus account subscription
hooknexus upgrade
```

### 配置

```bash
hooknexus config ls
hooknexus config get apiUrl
hooknexus config set apiUrl https://api.hooknexus.com
hooknexus config set authUrl https://api.infra-hub.hooknexus.com
hooknexus config set timeout 30000
hooknexus config reset
hooknexus config path
```

可修改的配置项：

- `apiUrl`
- `authUrl`
- `webUrl`
- `outputFormat`
- `color`
- `timeout`

## 常用选项

```bash
hooknexus --help
hooknexus --version
hooknexus --no-color
hooknexus <command> --json
```

## 套餐能力

| 功能 | Free | Plus |
|------|------|------|
| 临时 endpoint | 3 个 | 10 个 |
| 永久 endpoint | - | 1 个 |
| WebSocket 监听 | 2 个连接 / endpoint | 3 个连接 / endpoint |
| 转发到本地 | 支持 | 支持 |
| 请求重放 | - | 支持 |
| 请求保留 | 24 小时 | 30 天 |
| API Key | - | 支持 |

## 故障排查

### 1. `Not logged in`

先重新登录：

```bash
hooknexus login
```

### 2. `Request not found`

通常是 request id 不完整，先列出对应 endpoint 的请求：

```bash
hooknexus requests ls <endpoint-id>
```

### 3. `Target URL must be localhost`

如果你确实要转发到远端地址，请显式加：

```bash
hooknexus forward --to http://example.com/webhook --allow-external
```

### 4. `Request replay is available on the Plus plan and above`

当前请求重放不是 Free 功能，可执行：

```bash
hooknexus upgrade
```

## 相关说明

- CLI 使用的业务 API 默认是 `https://api.hooknexus.com`
- 认证 / 计费 API 默认是 `https://api.infra-hub.hooknexus.com`
- 登录成功后，本地保存的是 JWT
- WebSocket 连接时会同时带上 `Authorization` 和 query token

## 开发与贡献

见 [docs/development.zh-CN.md](docs/development.zh-CN.md)。  
English: [docs/development.md](docs/development.md).
