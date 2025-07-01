# TianGong-AI-MCP

[中文](https://github.com/linancn/tiangong-ai-mcp-local/blob/main/README_CN.md) | [English](https://github.com/linancn/tiangong-ai-mcp-local/blob/main/README.md)

TianGong AI Model Context Protocol (MCP) Local Server supports Streamable Http protocol.

## Starting MCP Server

### Streamable Http Server

```bash
npm install -g @tiangong-ai/mcp-server-local

npx dotenv -e .env -- \
npx -p @tiangong-ai/mcp-server-local tiangong-ai-mcp-http
```

### Using Docker

```bash
# Build MCP server image using Dockerfile (optional)
docker build -t linancn/tiangong-ai-mcp-server-local:0.0.1 .

# Pull MCP server image
docker pull linancn/tiangong-ai-mcp-server-local:0.0.1

# Start MCP server using Docker
docker run -d \
    --name tiangong-ai-mcp-server-local \
    --publish 9279:9279 \
    --env-file .env \
    linancn/tiangong-ai-mcp-server-local:0.0.1
```
