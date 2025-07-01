# TianGong-AI-MCP

[中文](./README.md) | [English](./README_EN.md)

TianGong AI Model Context Protocol (MCP) Server 支持 STDIO 、 SSE（废止）和 Streamable Http三种协议。

## 启动 MCP 服务器

### 客户端 STDIO 服务器

```bash
npm install -g @tiangong-ai/mcp-server-local

npx dotenv -e .env -- \
npx -p @tiangong-ai/mcp-server-local tiangong-ai-mcp-http
```

### 使用 Docker

```bash
# 使用 Dockerfile 构建 MCP 服务器镜像（可选）
docker build -t linancn/tiangong-ai-mcp-server-local:0.0.13 .

# 拉取 MCP 服务器镜像
docker pull linancn/tiangong-ai-mcp-server-local:0.0.13

# 使用 Docker 启动 MCP 服务器
docker run -d \
    --name tiangong-ai-mcp-server-local \
    --publish 9279:9279 \
    --env-file .env \
    linancn/tiangong-ai-mcp-server-local:0.0.13
```

## 开发

### 环境设置

```bash
# 安装 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
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

#### STDIO 服务器

```bash
# 使用 MCP Inspector 启动 STDIO 服务器
npm run start
```

#### 启动 MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

### 发布

```bash
npm login

npm run build && npm publish
```
