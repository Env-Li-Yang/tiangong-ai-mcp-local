# TianGong-AI-MCP

[中文](https://github.com/linancn/tiangong-ai-mcp-local/blob/main/README_CN.md) | [English](https://github.com/linancn/tiangong-ai-mcp-local/blob/main/README.md)

TianGong AI Model Context Protocol (MCP) Local Server 支持 Streamable Http 协议。

## 启动 MCP 服务器

### Streamable Http 服务器

```bash
npm install -g @tiangong-ai/mcp-server-local

npx dotenv -e .env -- \
npx -p @tiangong-ai/mcp-server-local tiangong-ai-mcp-http
```

### 使用 Docker

```bash
# 使用 Dockerfile 构建 MCP 服务器镜像（可选）
docker build -t linancn/tiangong-ai-mcp-server-local:0.0.1 .

# 拉取 MCP 服务器镜像
docker pull linancn/tiangong-ai-mcp-server-local:0.0.1

# 使用 Docker 启动 MCP 服务器
docker run -d \
    --name tiangong-ai-mcp-server-local \
    --publish 9279:9279 \
    --env-file .env \
    linancn/tiangong-ai-mcp-server-local:0.0.1
```
