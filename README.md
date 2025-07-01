# TianGong-AI-MCP

[中文](https://github.com/linancn/tiangong-ai-mcp/blob/main/README_CN.md) | [English](https://github.com/linancn/tiangong-ai-mcp/blob/main/README.md)

TianGong AI Model Context Protocol (MCP) Server supports both STDIO, SSE and Streamable Http protocols.

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

## Development

### Environment Setup

```bash
# Install Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
nvm install 22
nvm use

# Install dependencies
npm install

# Update dependencies
npm update && npm ci
```

### Code Formatting

```bash
# Format code using the linter
npm run lint
```

### Local Testing

#### Streamable Http Server

```bash
# Launch the Streamable Http Server using MCP Inspector
npm start:server
```

#### Launch MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

### Publishing

```bash
npm login

npm run build && npm publish
```
