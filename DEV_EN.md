# TianGong-AI-MCP

[中文](https://github.com/linancn/tiangong-ai-mcp-local/blob/main/DEV_CN.md) | [English](https://github.com/linancn/tiangong-ai-mcp-local/blob/main/DEV_EN.md)

TianGong AI Model Context Protocol (MCP) Local Server supports Streamable Http protocol.

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
