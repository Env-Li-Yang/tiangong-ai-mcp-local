FROM node:22-alpine

RUN npm install -g @tiangong-ai/mcp-server@0.0.13

EXPOSE 9279

CMD ["npx", "-p", "@tiangong-ai-mcp-server", "tiangong-ai-mcp-http"]
