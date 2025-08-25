# TianGong-AI-MCP

[中文](https://github.com/linancn/tiangong-ai-mcp-local/blob/main/DEV_CN.md) | [English](https://github.com/linancn/tiangong-ai-mcp-local/blob/main/DEV_EN.md)

TianGong AI Model Context Protocol (MCP) Local Server 支持 Streamable Http 协议。

## 开发

### 环境设置

```bash
# 安装 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm install 22
nvm use

# 安装依赖
npm install

# 更新依赖
npm update && npm ci
```

### 代码格式化

```bash
# 使用代码检查工具格式化代码
npm run lint
```

### 本地测试

#### Streamable Http 服务器

```bash
# 使用 MCP Inspector 启动 Streamable Http 服务器
npm run start:server
```

#### 启动 MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

### 发布 NPM 包

```bash
npm login

npm run build && npm publish
```

### 发布 Docker 镜像

```bash
# 使用 Dockerfile 构建 MCP 服务器镜像
docker build -t linancn/tiangong-ai-mcp-server-local:0.0.1 .

# 推送 Docker 镜像
docker push linancn/tiangong-ai-mcp-server-local:0.0.1
```
