# TianGong-AI-MCP

[中文](https://github.com/linancn/tiangong-ai-mcp/blob/main/README_CN.md) | [English](https://github.com/linancn/tiangong-ai-mcp/blob/main/README.md)

TianGong AI Model Context Protocol (MCP) Server supports both STDIO, SSE and Streamable Http protocols.

## Starting MCP Server

### Client STDIO Server

```bash
npm install -g @tiangong-ai/mcp-server

npx dotenv -e .env -- \
npx -p @tiangong-ai/mcp-server tiangong-ai-mcp-stdio
```

### Remote SSE Server

```bash
npm install -g @tiangong-ai/mcp-server
npm install -g supergateway

npx dotenv -e .env -- \
npx -y supergateway \
    --stdio "npx -y -p @tiangong-ai/mcp-server tiangong-ai-mcp-stdio" \
    --port 3001 \
    --ssePath /sse --messagePath /message
```

### Using Docker

```bash
# Build MCP server image using Dockerfile (optional)
docker build -t linancn/tiangong-ai-mcp-server:0.0.13 .

# Pull MCP server image
docker pull linancn/tiangong-ai-mcp-server:0.0.13

# Start MCP server using Docker
docker run -d \
    --name tiangong-ai-mcp-server \
    --publish 9279:9279 \
    --env-file .env \
    linancn/tiangong-ai-mcp-server:0.0.13
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

#### STDIO Server

```bash
# Launch the STDIO Server using MCP Inspector
npm start
```

#### SSE Server

```bash
# Build and package the project
npm run build && npm pack

# Optionally, install supergateway globally
npm install -g supergateway

# Launch the SSE Server (If the parameter --baseUrl is configured, it should be set to a valid IP address or domain name)
npx dotenv -e .env -- \
npx -y supergateway \
    --stdio "npx -y -p tiangong-ai-mcp-server-0.0.13.tgz tiangong-ai-mcp-stdio" \
    --port 3001 \
    --ssePath /sse \
    --messagePath /message

# Launch MCP Inspector
npx @modelcontextprotocol/inspector
```

### Publishing

```bash
npm login

npm run build && npm publish
```
